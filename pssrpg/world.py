"""The living world: holds map state, factions, and the per-tick simulation."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from pssrpg.calendar import Calendar
from pssrpg.faction import Faction
from pssrpg.territory import Territory


@dataclass
class World:
    calendar: Calendar = field(default_factory=Calendar)
    territories: dict[int, Territory] = field(default_factory=dict)
    factions: dict[int, Faction] = field(default_factory=dict)
    adjacency: dict[int, list[int]] = field(default_factory=dict)
    rng: random.Random = field(default_factory=lambda: random.Random(0xBA5E))
    log: list[str] = field(default_factory=list)

    def territories_of(self, faction_id: int) -> list[Territory]:
        return [t for t in self.territories.values() if t.holder_id == faction_id]

    def neighbors(self, territory_id: int) -> list[Territory]:
        return [self.territories[n] for n in self.adjacency.get(territory_id, ())]

    def tick(self) -> tuple[bool, bool]:
        month_rolled, year_rolled = self.calendar.tick()
        self._faction_actions()
        if month_rolled:
            self._monthly()
        if year_rolled:
            self._yearly()
        return month_rolled, year_rolled

    def majority_holder(self) -> int | None:
        """Returns faction id holding > 50% of territories, else None."""
        held: dict[int, int] = {}
        for t in self.territories.values():
            if t.holder_id is None:
                continue
            held[t.holder_id] = held.get(t.holder_id, 0) + 1
        if not held:
            return None
        leader_id, count = max(held.items(), key=lambda kv: kv[1])
        if count * 2 > len(self.territories):
            return leader_id
        return None

    def _faction_actions(self) -> None:
        # Iterate over a snapshot so eliminations during the loop are safe.
        for faction in list(self.factions.values()):
            if not faction.alive:
                continue
            held = self.territories_of(faction.id)
            if not held:
                faction.alive = False
                self.log.append(f"{self.calendar} {faction.name} ELIMINATED.")
                continue
            if self.rng.random() > faction.aggression:
                continue

            targets: list[tuple[Territory, Territory]] = []
            for owned in held:
                for nb in self.neighbors(owned.id):
                    if nb.holder_id is not None and nb.holder_id != faction.id:
                        targets.append((owned, nb))
            if not targets:
                continue

            _, target = min(targets, key=lambda pair: pair[1].garrison)
            attack_force = max(1, int(faction.troops * 0.4))
            atk_roll = attack_force * (1.0 + self.rng.random() * 0.3)
            def_roll = max(1, target.garrison) * (1.0 + self.rng.random() * 0.3)

            old_holder = self.factions.get(target.holder_id) if target.holder_id is not None else None
            old_tag = old_holder.short if old_holder else "??"

            if atk_roll > def_roll:
                losses = max(1, int(target.garrison * 0.6))
                left_as_garrison = max(5, attack_force // 2)
                # Pay both casualties and the troops left behind to garrison the new holding.
                faction.troops = max(0, faction.troops - losses - left_as_garrison)
                target.holder_id = faction.id
                target.garrison = left_as_garrison
                self.log.append(
                    f"{self.calendar} {faction.short} took {target.name} from {old_tag} "
                    f"(-{losses} cas, -{left_as_garrison} garrison)"
                )
            else:
                losses_a = max(1, int(attack_force * 0.5))
                losses_d = max(0, int(target.garrison * 0.2))
                faction.troops = max(0, faction.troops - losses_a)
                target.garrison = max(0, target.garrison - losses_d)
                self.log.append(
                    f"{self.calendar} {faction.short} repelled at {target.name} (-{losses_a}/-{losses_d})"
                )

    def _monthly(self) -> None:
        for faction in self.factions.values():
            if not faction.alive:
                continue
            held = self.territories_of(faction.id)
            production = sum(t.base_production for t in held)
            faction.resources += production
            faction.troops += production // 2
            for t in held:
                t.garrison = min(t.garrison + 1, 60)

    def _yearly(self) -> None:
        for faction in self.factions.values():
            if not faction.alive:
                continue
            faction.leader_age += 1
            if faction.leader_age > 70 and self.rng.random() < 0.25:
                old = faction.leader_name
                faction.leader_name = f"Heir of {old.split()[-1]}"
                faction.leader_age = self.rng.randint(28, 45)
                self.log.append(
                    f"{self.calendar} {faction.name}: {old} dies; {faction.leader_name} takes the seat."
                )
        self.log.append(f"--- year PC{self.calendar.year} begins ---")

    def political_summary(self) -> str:
        lines = [f"=== {self.calendar} ==="]
        for f in self.factions.values():
            held = self.territories_of(f.id)
            status = "alive" if f.alive else "DEAD "
            lines.append(
                f"  {f.short:>2} {f.name:<18} [{status}] "
                f"terr={len(held):>2} troops={f.troops:>4} res={f.resources:>5} "
                f"lead={f.leader_name}({f.leader_age})"
            )
        return "\n".join(lines)
