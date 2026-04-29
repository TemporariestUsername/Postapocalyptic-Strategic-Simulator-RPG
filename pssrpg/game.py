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
from pssrpg.io import GameIO, TerminalIO
from pssrpg.scenario import rust_basin
from pssrpg.world import World
from pssrpg.territory import Terrain

# How many open offers a faction may have queued at once.
OFFER_QUEUE_CAP = 1
# Reputation modifier on contract success: +1% per rep point, capped.
REP_BONUS_CAP = 0.20
# A reputation threshold below which a faction won't offer to the player.
HOSTILE_THRESHOLD = -10
RENOWN_SUCCESS_BONUS_CAP = 0.10


@dataclass
class Game:
    world: World = field(default_factory=rust_basin)
    player: Player = field(default_factory=lambda: Player(location_id=0))
    rng: random.Random = field(default_factory=lambda: random.Random(0xC0FFEE))
    offers: dict[int, list[Contract]] = field(default_factory=dict)
    io: GameIO = field(default_factory=TerminalIO)
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
            self.io.write()
            self.io.write(f"### {self.outcome} ###")

    def _intro(self) -> None:
        self.io.write("=" * 60)
        self.io.write("  POSTAPOCALYPTIC STRATEGIC SIMULATOR RPG  --  prototype")
        self.io.write("=" * 60)
        self.io.write("You are a wanderer in the Rust Basin. The Tally is on the march.")
        self.io.write("Type letters to choose actions. [Q] quits.")
        self.io.write()

    # -- rendering ------------------------------------------------------

    def _render(self) -> None:
        cal = self.world.calendar
        loc = self.world.territories[self.player.location_id]
        holder = self.world.factions.get(loc.holder_id) if loc.holder_id is not None else None
        holder_str = (
            f"{holder.short} ({holder.name})  rep {self._fmt_rep(self.player.rep(holder.id))}"
            if holder else "unclaimed"
        )
        self.io.write("-" * 60)
        self.io.write(f"  {cal}   resources={self.player.resources}  renown={self.player.renown}")
        self.io.write(f"  Location: {loc.name} [{loc.terrain.value}]   garrison={loc.garrison}")
        self.io.write(f"  Held by:  {holder_str}")
        if self.player.active_contract:
            c = self.player.active_contract
            issuer = self.world.factions[c.issuer_id]
            target = self.world.territories[c.target_id]
            weeks_left = c.deadline_week - cal.absolute_week
            self.io.write(f"  Contract: [{c.kind.value}] {c.description}")
            self.io.write(f"            issuer={issuer.short}  target={target.name}  "
                  f"weeks_left={weeks_left}")
        else:
            self.io.write("  Contract: (none)")
        self.io.write()

    @staticmethod
    def _fmt_rep(r: int) -> str:
        sign = "+" if r >= 0 else ""
        return f"{sign}{r}"

    # -- prompt ---------------------------------------------------------

    def _prompt(self) -> bool:
        """Read one player command. Returns True iff the world should advance."""
        self.io.write("[T]ravel  [A]ccept  [W]ork  [M]arket  [I]nspect  [R]est  [N]ews  [Q]uit")
        try:
            raw = self.io.read("> ").strip().lower()
        except EOFError:
            self.quitting = True
            return False
        if not raw:
            return False
        cmd = raw[0]
        if cmd == "q":
            return self.apply_action("quit")
        if cmd == "t":
            return self._cmd_travel()
        if cmd == "a":
            return self._cmd_accept()
        if cmd == "w":
            return self.apply_action("work")
        if cmd == "i":
            self._cmd_inspect()
            return False
        if cmd == "m":
            self._cmd_market()
            return False
        if cmd == "r":
            self.io.write("  You rest a week, eyes on the horizon.")
            return True
        if cmd == "n":
            self._cmd_news()
            return False
        self.io.write("  ?")
        return False

    def available_actions(self) -> list[str]:
        return ["travel", "accept", "work", "market_buy", "market_sell", "inspect", "rest", "news", "quit"]

    def snapshot_state(self) -> dict[str, object]:
        cal = self.world.calendar
        loc = self.world.territories[self.player.location_id]
        return {
            "calendar": str(cal),
            "week": cal.absolute_week,
            "resources": self.player.resources,
            "renown": self.player.renown,
            "cargo": self.player.cargo,
            "location": {"id": loc.id, "name": loc.name, "terrain": loc.terrain.value, "garrison": loc.garrison},
            "contract": None if self.player.active_contract is None else {
                "kind": self.player.active_contract.kind.value,
                "description": self.player.active_contract.description,
                "target_id": self.player.active_contract.target_id,
                "issuer_id": self.player.active_contract.issuer_id,
                "deadline_week": self.player.active_contract.deadline_week,
            },
            "outcome": self.outcome,
        }

    def apply_action(self, action: str, **kwargs: object) -> bool:
        if action == "quit":
            self.quitting = True
            return False
        if action == "work":
            return self._cmd_work()
        if action == "rest":
            self.io.write("  You rest a week, eyes on the horizon.")
            return True
        if action == "news":
            self._cmd_news()
            return False
        if action == "inspect":
            self._cmd_inspect()
            return False
        if action == "travel":
            return self._travel_index(int(kwargs.get("index", -1)))
        if action == "accept":
            return self._accept_offer(bool(kwargs.get("confirm", True)))
        if action == "market_buy":
            self._market_transact("buy")
            return False
        if action == "market_sell":
            self._market_transact("sell")
            return False
        self.io.write("  ?")
        return False

    def drain_output(self) -> list[str]:
        if isinstance(self.io, TerminalIO):
            out = self.io.output[:]
            self.io.output.clear()
            return out
        return []

    # -- commands -------------------------------------------------------

    def _cmd_travel(self) -> bool:
        neighbors = self.world.neighbors(self.player.location_id)
        if not neighbors:
            self.io.write("  Nowhere to go.")
            return False
        self.io.write("  Adjacent territories:")
        for i, t in enumerate(neighbors):
            holder = self.world.factions.get(t.holder_id) if t.holder_id is not None else None
            tag = holder.short if holder else "--"
            self.io.write(f"    [{i}] {t.name:<14} {t.terrain.value:<11} held={tag} garr={t.garrison}")
        try:
            raw = self.io.read("  go to> ").strip()
        except EOFError:
            return False
        if not raw.isdigit():
            return False
        return self._travel_index(int(raw))

    def _travel_index(self, idx: int) -> bool:
        neighbors = self.world.neighbors(self.player.location_id)
        if not (0 <= idx < len(neighbors)):
            return False
        dest = neighbors[idx]
        self.player.location_id = dest.id
        self.io.write(f"  You travel to {dest.name}.")
        return True

    def _cmd_accept(self) -> bool:
        loc = self.world.territories[self.player.location_id]
        if loc.holder_id is None:
            self.io.write("  No faction here to deal with.")
            return False
        if self.player.active_contract is not None:
            self.io.write("  You already have an active contract.")
            return False
        holder = self.world.factions[loc.holder_id]
        if self.player.rep(holder.id) <= HOSTILE_THRESHOLD:
            self.io.write(f"  {holder.short} will not deal with you.")
            return False
        queue = self.offers.get(holder.id, [])
        if not queue:
            self.io.write(f"  {holder.short} has no work for you right now.")
            return False
        offer = queue[0]
        target = self.world.territories[offer.target_id]
        cal_left = offer.deadline_week - self.world.calendar.absolute_week
        self.io.write(f"  {holder.short} offers: {offer.description}")
        self.io.write(f"    kind={offer.kind.value}  target={target.name}  "
              f"weeks={cal_left}  rep+{offer.rep_reward}/-{offer.rep_penalty}  "
              f"pay={offer.resource_reward}")
        try:
            raw = self.io.read("  accept? [y/N]> ").strip().lower()
        except EOFError:
            return False
        return self._accept_offer(raw.startswith("y"))

    def _accept_offer(self, confirm: bool) -> bool:
        loc = self.world.territories[self.player.location_id]
        if loc.holder_id is None:
            self.io.write("  No faction here to deal with.")
            return False
        if self.player.active_contract is not None:
            self.io.write("  You already have an active contract.")
            return False
        holder = self.world.factions[loc.holder_id]
        if self.player.rep(holder.id) <= HOSTILE_THRESHOLD:
            self.io.write(f"  {holder.short} will not deal with you.")
            return False
        queue = self.offers.get(holder.id, [])
        if not queue:
            self.io.write(f"  {holder.short} has no work for you right now.")
            return False
        if confirm:
            self.player.active_contract = queue[0]
            queue.pop(0)
            self.io.write("  Accepted.")
        else:
            self.io.write("  Declined.")
        return False

    def _cmd_work(self) -> bool:
        c = self.player.active_contract
        if c is None:
            self.io.write("  No active contract.")
            return False
        if self.player.location_id != c.target_id:
            target = self.world.territories[c.target_id]
            self.io.write(f"  You must be at {target.name} to work this contract.")
            return False
        return self._resolve_contract(c)

    def _cmd_inspect(self) -> None:
        self.io.write("  Reputation:")
        for fid, f in self.world.factions.items():
            status = "alive" if f.alive else "DEAD"
            held = len(self.world.territories_of(fid))
            self.io.write(f"    {f.short} {f.name:<18} [{status}] rep={self._fmt_rep(self.player.rep(fid)):>4} "
                  f" title={self._title_for_rep(self.player.rep(fid)):<8} "
                  f"terr={held:>2} troops={f.troops:>4}")
        self.io.write(f"  Trade cargo: {self.player.cargo} crate(s), basis={self.player.cargo_cost_basis}")
        if self.offers:
            self.io.write("  Standing offers (where you've been seen):")
            for fid, queue in self.offers.items():
                for c in queue:
                    f = self.world.factions[fid]
                    target = self.world.territories[c.target_id]
                    self.io.write(f"    {f.short}: [{c.kind.value}] -> {target.name}")

    def _cmd_news(self) -> None:
        recent = self.world.log[-15:]
        if not recent:
            self.io.write("  Quiet on the wind.")
            return
        self.io.write("  Recent events:")
        for line in recent:
            self.io.write(f"    {line}")

    # -- contract resolution -------------------------------------------

    def _resolve_contract(self, c: Contract) -> bool:
        issuer = self.world.factions[c.issuer_id]
        target = self.world.territories[c.target_id]
        target_holder_id = target.holder_id
        base = BASE_SUCCESS[c.kind]
        rep_bonus = max(-REP_BONUS_CAP, min(REP_BONUS_CAP, self.player.rep(issuer.id) * 0.01))
        renown_bonus = min(RENOWN_SUCCESS_BONUS_CAP, self.player.renown * 0.002)
        chance = max(0.05, min(0.98, base + rep_bonus + renown_bonus))
        roll = self.rng.random()
        success = roll < chance
        self.io.write(f"  You spend a week on the work. (chance {chance:.0%}, roll {roll:.2f})")

        if success:
            self.player.adjust_rep(issuer.id, c.rep_reward)
            self.player.resources += c.resource_reward
            self.player.renown += max(1, c.rep_reward // 2)
            self.io.write(f"  SUCCESS. {issuer.short} rep +{c.rep_reward}, "
                  f"+{c.resource_reward} resources.")
            if c.kind is ContractKind.INTEL and target_holder_id not in (None, issuer.id):
                self.player.adjust_rep(target_holder_id, -3)
                victim = self.world.factions[target_holder_id]
                self.io.write(f"  You were noticed; {victim.short} rep -3.")
            if c.kind is ContractKind.SABOTAGE:
                cut = max(1, int(target.garrison * 0.30))
                target.garrison = max(0, target.garrison - cut)
                self.io.write(f"  Sabotage cuts {target.name} garrison by {cut}.")
                if target_holder_id not in (None, issuer.id):
                    self.player.adjust_rep(target_holder_id, -15)
                    victim = self.world.factions[target_holder_id]
                    self.io.write(f"  {victim.short} rep -15.")
        else:
            self.player.adjust_rep(issuer.id, -c.rep_penalty)
            self.player.renown = max(0, self.player.renown - 1)
            self.io.write(f"  FAILURE. {issuer.short} rep -{c.rep_penalty}.")
            if c.kind is ContractKind.SABOTAGE and target_holder_id not in (None, issuer.id):
                self.player.adjust_rep(target_holder_id, -5)
                victim = self.world.factions[target_holder_id]
                self.io.write(f"  You were caught; {victim.short} rep -5.")

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
                self.io.write(f"  ({issuer.short} has been eliminated; contract void.)")
                self.player.active_contract = None
            elif c.is_expired(self.world.calendar.absolute_week):
                self.player.adjust_rep(c.issuer_id, -c.rep_penalty)
                self.io.write(f"  Contract expired. {issuer.short} rep -{c.rep_penalty}.")
                self.player.active_contract = None

    def _cmd_market(self) -> None:
        loc = self.world.territories[self.player.location_id]
        price = self._market_price()
        self.io.write(f"  Bazaar at {loc.name}: price={price} resources/crate.")
        self.io.write(f"  You hold {self.player.cargo} crate(s).")
        self.io.write("  [B]uy one  [S]ell one  [L]eave")
        try:
            raw = self.io.read("  market> ").strip().lower()
        except EOFError:
            return
        if not raw:
            return
        cmd = raw[0]
        if cmd == "b":
            self._market_transact("buy")
            return
        if cmd == "s":
            self._market_transact("sell")

    def _market_transact(self, mode: str) -> None:
        price = self._market_price()
        if mode == "buy":
            if self.player.resources < price:
                self.io.write("  Not enough resources.")
                return
            self.player.resources -= price
            self.player.cargo += 1
            self.player.cargo_cost_basis += price
            self.io.write(f"  Bought 1 crate for {price}.")
            return
        if self.player.cargo <= 0:
            self.io.write("  You have nothing to sell.")
            return
        avg_basis = self.player.cargo_cost_basis // self.player.cargo
        self.player.cargo -= 1
        self.player.cargo_cost_basis -= avg_basis
        self.player.resources += price
        delta = price - avg_basis
        if delta > 0:
            self.player.renown += 1
            self.io.write(f"  Sold 1 crate for {price}. Profit {delta}. Renown +1.")
        else:
            self.io.write(f"  Sold 1 crate for {price}.")

    def _market_price(self) -> int:
        loc = self.world.territories[self.player.location_id]
        terrain_base = {
            Terrain.RUINS: 5,
            Terrain.WILDS: 4,
            Terrain.IRRADIATED: 3,
            Terrain.FERTILE: 2,
            Terrain.FORTIFIED: 6,
        }.get(loc.terrain, 4)
        week = self.world.calendar.absolute_week
        swing = ((loc.id * 7 + week * 3) % 5) - 2
        return max(1, terrain_base + swing)

    @staticmethod
    def _title_for_rep(rep: int) -> str:
        if rep >= 40:
            return "champion"
        if rep >= 20:
            return "retainer"
        if rep >= 8:
            return "ally"
        if rep <= -20:
            return "nemesis"
        if rep <= -8:
            return "suspect"
        return "stranger"

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
