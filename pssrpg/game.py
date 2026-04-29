"""Text REPL: the playable shell over the living-world simulation."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from pssrpg.contract import (
    BASE_SUCCESS,
    Contract,
    ContractKind,
    generate_offer,
)
from pssrpg.player import Player
from pssrpg.scenario import rust_basin
from pssrpg.world import World

# How many open offers a faction may have queued at once.
OFFER_QUEUE_CAP = 1
# Reputation modifier on contract success: +1% per rep point, capped.
REP_BONUS_CAP = 0.20
# A reputation threshold below which a faction won't offer to the player.
HOSTILE_THRESHOLD = -10


@dataclass
class Game:
    world: World = field(default_factory=rust_basin)
    player: Player = field(default_factory=lambda: Player(location_id=0))
    rng: random.Random = field(default_factory=lambda: random.Random(0xC0FFEE))
    offers: dict[int, list[Contract]] = field(default_factory=dict)
    quitting: bool = False
    outcome: str | None = None

    def __post_init__(self) -> None:
        for fid in self.world.factions:
            self.player.reputation.setdefault(fid, 0)
            self.offers.setdefault(fid, [])
        self._refresh_offers()

    # -- top-level loop -------------------------------------------------

    def run(self) -> None:
        self._intro()
        while not self.quitting and self.outcome is None:
            self._render()
            advanced = self._prompt()
            if advanced:
                self._advance_world()
                self._check_outcome()
        if self.outcome:
            print()
            print(f"### {self.outcome} ###")

    def _intro(self) -> None:
        print("=" * 60)
        print("  POSTAPOCALYPTIC STRATEGIC SIMULATOR RPG  --  prototype")
        print("=" * 60)
        print("You are a wanderer in the Rust Basin. The Tally is on the march.")
        print("Type letters to choose actions. [Q] quits.")
        print()

    # -- rendering ------------------------------------------------------

    def _render(self) -> None:
        cal = self.world.calendar
        loc = self.world.territories[self.player.location_id]
        holder = self.world.factions.get(loc.holder_id) if loc.holder_id is not None else None
        holder_str = (
            f"{holder.short} ({holder.name})  rep {self._fmt_rep(self.player.rep(holder.id))}"
            if holder else "unclaimed"
        )
        print("-" * 60)
        print(f"  {cal}   resources={self.player.resources}")
        print(f"  Location: {loc.name} [{loc.terrain.value}]   garrison={loc.garrison}")
        print(f"  Held by:  {holder_str}")
        if self.player.active_contract:
            c = self.player.active_contract
            issuer = self.world.factions[c.issuer_id]
            target = self.world.territories[c.target_id]
            weeks_left = c.deadline_week - cal.absolute_week
            print(f"  Contract: [{c.kind.value}] {c.description}")
            print(f"            issuer={issuer.short}  target={target.name}  "
                  f"weeks_left={weeks_left}")
        else:
            print("  Contract: (none)")
        print()

    @staticmethod
    def _fmt_rep(r: int) -> str:
        sign = "+" if r >= 0 else ""
        return f"{sign}{r}"

    # -- prompt ---------------------------------------------------------

    def _prompt(self) -> bool:
        """Read one player command. Returns True iff the world should advance."""
        print("[T]ravel  [A]ccept  [W]ork  [I]nspect  [R]est  [N]ews  [Q]uit")
        try:
            raw = input("> ").strip().lower()
        except EOFError:
            self.quitting = True
            return False
        if not raw:
            return False
        cmd = raw[0]
        if cmd == "q":
            self.quitting = True
            return False
        if cmd == "t":
            return self._cmd_travel()
        if cmd == "a":
            return self._cmd_accept()
        if cmd == "w":
            return self._cmd_work()
        if cmd == "i":
            self._cmd_inspect()
            return False
        if cmd == "r":
            print("  You rest a week, eyes on the horizon.")
            return True
        if cmd == "n":
            self._cmd_news()
            return False
        print("  ?")
        return False

    # -- commands -------------------------------------------------------

    def _cmd_travel(self) -> bool:
        neighbors = self.world.neighbors(self.player.location_id)
        if not neighbors:
            print("  Nowhere to go.")
            return False
        print("  Adjacent territories:")
        for i, t in enumerate(neighbors):
            holder = self.world.factions.get(t.holder_id) if t.holder_id is not None else None
            tag = holder.short if holder else "--"
            print(f"    [{i}] {t.name:<14} {t.terrain.value:<11} held={tag} garr={t.garrison}")
        try:
            raw = input("  go to> ").strip()
        except EOFError:
            return False
        if not raw.isdigit():
            return False
        idx = int(raw)
        if not (0 <= idx < len(neighbors)):
            return False
        dest = neighbors[idx]
        self.player.location_id = dest.id
        print(f"  You travel to {dest.name}.")
        return True

    def _cmd_accept(self) -> bool:
        loc = self.world.territories[self.player.location_id]
        if loc.holder_id is None:
            print("  No faction here to deal with.")
            return False
        if self.player.active_contract is not None:
            print("  You already have an active contract.")
            return False
        holder = self.world.factions[loc.holder_id]
        if self.player.rep(holder.id) <= HOSTILE_THRESHOLD:
            print(f"  {holder.short} will not deal with you.")
            return False
        queue = self.offers.get(holder.id, [])
        if not queue:
            print(f"  {holder.short} has no work for you right now.")
            return False
        offer = queue[0]
        target = self.world.territories[offer.target_id]
        cal_left = offer.deadline_week - self.world.calendar.absolute_week
        print(f"  {holder.short} offers: {offer.description}")
        print(f"    kind={offer.kind.value}  target={target.name}  "
              f"weeks={cal_left}  rep+{offer.rep_reward}/-{offer.rep_penalty}  "
              f"pay={offer.resource_reward}")
        try:
            raw = input("  accept? [y/N]> ").strip().lower()
        except EOFError:
            return False
        if raw.startswith("y"):
            self.player.active_contract = offer
            queue.pop(0)
            print("  Accepted.")
        else:
            print("  Declined.")
        return False

    def _cmd_work(self) -> bool:
        c = self.player.active_contract
        if c is None:
            print("  No active contract.")
            return False
        if self.player.location_id != c.target_id:
            target = self.world.territories[c.target_id]
            print(f"  You must be at {target.name} to work this contract.")
            return False
        return self._resolve_contract(c)

    def _cmd_inspect(self) -> None:
        print("  Reputation:")
        for fid, f in self.world.factions.items():
            status = "alive" if f.alive else "DEAD"
            held = len(self.world.territories_of(fid))
            print(f"    {f.short} {f.name:<18} [{status}] rep={self._fmt_rep(self.player.rep(fid)):>4} "
                  f"terr={held:>2} troops={f.troops:>4}")
        if self.offers:
            print("  Standing offers (where you've been seen):")
            for fid, queue in self.offers.items():
                for c in queue:
                    f = self.world.factions[fid]
                    target = self.world.territories[c.target_id]
                    print(f"    {f.short}: [{c.kind.value}] -> {target.name}")

    def _cmd_news(self) -> None:
        recent = self.world.log[-15:]
        if not recent:
            print("  Quiet on the wind.")
            return
        print("  Recent events:")
        for line in recent:
            print(f"    {line}")

    # -- contract resolution -------------------------------------------

    def _resolve_contract(self, c: Contract) -> bool:
        issuer = self.world.factions[c.issuer_id]
        target = self.world.territories[c.target_id]
        target_holder_id = target.holder_id
        base = BASE_SUCCESS[c.kind]
        rep_bonus = max(-REP_BONUS_CAP, min(REP_BONUS_CAP, self.player.rep(issuer.id) * 0.01))
        chance = max(0.05, min(0.98, base + rep_bonus))
        roll = self.rng.random()
        success = roll < chance
        print(f"  You spend a week on the work. (chance {chance:.0%}, roll {roll:.2f})")

        if success:
            self.player.adjust_rep(issuer.id, c.rep_reward)
            self.player.resources += c.resource_reward
            print(f"  SUCCESS. {issuer.short} rep +{c.rep_reward}, "
                  f"+{c.resource_reward} resources.")
            if c.kind is ContractKind.INTEL and target_holder_id not in (None, issuer.id):
                self.player.adjust_rep(target_holder_id, -3)
                victim = self.world.factions[target_holder_id]
                print(f"  You were noticed; {victim.short} rep -3.")
            if c.kind is ContractKind.SABOTAGE:
                cut = max(1, int(target.garrison * 0.30))
                target.garrison = max(0, target.garrison - cut)
                print(f"  Sabotage cuts {target.name} garrison by {cut}.")
                if target_holder_id not in (None, issuer.id):
                    self.player.adjust_rep(target_holder_id, -15)
                    victim = self.world.factions[target_holder_id]
                    print(f"  {victim.short} rep -15.")
        else:
            self.player.adjust_rep(issuer.id, -c.rep_penalty)
            print(f"  FAILURE. {issuer.short} rep -{c.rep_penalty}.")
            if c.kind is ContractKind.SABOTAGE and target_holder_id not in (None, issuer.id):
                self.player.adjust_rep(target_holder_id, -5)
                victim = self.world.factions[target_holder_id]
                print(f"  You were caught; {victim.short} rep -5.")

        self.player.active_contract = None
        return True

    # -- world advance --------------------------------------------------

    def _advance_world(self) -> None:
        month_rolled, _ = self.world.tick()
        if month_rolled:
            self._refresh_offers()
        # Drop a contract whose issuer was eliminated.
        c = self.player.active_contract
        if c is not None:
            issuer = self.world.factions[c.issuer_id]
            if not issuer.alive:
                print(f"  ({issuer.short} has been eliminated; contract void.)")
                self.player.active_contract = None
            elif c.is_expired(self.world.calendar.absolute_week):
                self.player.adjust_rep(c.issuer_id, -c.rep_penalty)
                print(f"  Contract expired. {issuer.short} rep -{c.rep_penalty}.")
                self.player.active_contract = None

    def _refresh_offers(self) -> None:
        cal_week = self.world.calendar.absolute_week
        for fid, faction in self.world.factions.items():
            if not faction.alive:
                self.offers[fid] = []
                continue
            queue = self.offers.setdefault(fid, [])
            queue[:] = [o for o in queue if not o.is_expired(cal_week)]
            if len(queue) >= OFFER_QUEUE_CAP:
                continue
            held = self.world.territories_of(fid)
            offer = generate_offer(
                faction, held, self.world.territories, cal_week, self.rng,
            )
            if offer is not None:
                queue.append(offer)

    # -- outcome --------------------------------------------------------

    def _check_outcome(self) -> None:
        tally_id = 6
        tally = self.world.factions.get(tally_id)
        if tally is not None and not tally.alive:
            self.outcome = "The Tally is broken. The basin draws breath. (You win.)"
            return
        majority = self.world.majority_holder()
        if majority == tally_id:
            self.outcome = "The Tally rules the basin. (You lose.)"


def main() -> int:
    Game().run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
