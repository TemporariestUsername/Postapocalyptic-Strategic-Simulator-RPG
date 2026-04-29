"""Faction contracts: missions the player can accept and complete."""
from __future__ import annotations

import random
from dataclasses import dataclass
from enum import Enum

from pssrpg.faction import Faction, Ideology
from pssrpg.territory import Terrain, Territory


class ContractKind(Enum):
    SCAVENGE = "scavenge"
    COURIER = "courier"
    INTEL = "intel"
    SABOTAGE = "sabotage"


# Base success rate by kind (further modified by player reputation with issuer).
BASE_SUCCESS: dict[ContractKind, float] = {
    ContractKind.SCAVENGE: 0.80,
    ContractKind.COURIER: 0.95,
    ContractKind.INTEL: 0.65,
    ContractKind.SABOTAGE: 0.50,
}


@dataclass
class Contract:
    issuer_id: int
    kind: ContractKind
    target_id: int
    deadline_week: int   # absolute_week from Calendar
    rep_reward: int
    rep_penalty: int
    resource_reward: int
    description: str

    def is_expired(self, absolute_week: int) -> bool:
        return absolute_week > self.deadline_week


def preferred_kinds(ideology: Ideology) -> list[ContractKind]:
    return {
        Ideology.PRAGMATIST: [ContractKind.SCAVENGE, ContractKind.COURIER],
        Ideology.MILITARIST: [ContractKind.SABOTAGE, ContractKind.INTEL],
        Ideology.THEOCRAT:   [ContractKind.SCAVENGE, ContractKind.INTEL],
        Ideology.TECHNOCRAT: [ContractKind.INTEL, ContractKind.SCAVENGE],
        Ideology.RAIDER:     [ContractKind.SABOTAGE, ContractKind.SCAVENGE],
        Ideology.AGRARIAN:   [ContractKind.COURIER, ContractKind.SCAVENGE],
        Ideology.SLAVER:     [ContractKind.SABOTAGE, ContractKind.INTEL],
    }[ideology]


def generate_offer(
    issuer: Faction,
    held: list[Territory],
    all_territories: dict[int, Territory],
    current_week: int,
    rng: random.Random,
) -> Contract | None:
    """Generate a single contract offer for a faction, or None if none viable."""
    if not held:
        return None
    kind = rng.choice(preferred_kinds(issuer.ideology))
    target = _pick_target(kind, issuer, held, all_territories, rng)
    if target is None:
        return None
    deadline = current_week + rng.randint(8, 16)
    rep_reward, rep_penalty, resource_reward, desc = _terms(kind, target)
    return Contract(
        issuer_id=issuer.id,
        kind=kind,
        target_id=target.id,
        deadline_week=deadline,
        rep_reward=rep_reward,
        rep_penalty=rep_penalty,
        resource_reward=resource_reward,
        description=desc,
    )


def _pick_target(
    kind: ContractKind,
    issuer: Faction,
    held: list[Territory],
    all_territories: dict[int, Territory],
    rng: random.Random,
) -> Territory | None:
    pool = list(all_territories.values())
    if kind is ContractKind.COURIER:
        candidates = [t for t in held if len(held) <= 1 or t.id != issuer.capital_id]
        return rng.choice(candidates) if candidates else None
    if kind is ContractKind.SCAVENGE:
        candidates = [t for t in pool
                      if t.terrain in (Terrain.RUINS, Terrain.WILDS, Terrain.IRRADIATED)
                      and t.holder_id != issuer.id]
        return rng.choice(candidates) if candidates else None
    if kind is ContractKind.INTEL:
        candidates = [t for t in pool
                      if t.holder_id is not None and t.holder_id != issuer.id]
        return rng.choice(candidates) if candidates else None
    if kind is ContractKind.SABOTAGE:
        candidates = [t for t in pool
                      if t.holder_id is not None and t.holder_id != issuer.id]
        return rng.choice(candidates) if candidates else None
    return None


def _terms(kind: ContractKind, target: Territory) -> tuple[int, int, int, str]:
    if kind is ContractKind.SCAVENGE:
        return 5, 2, 4, f"Scavenge salvage from {target.name}."
    if kind is ContractKind.COURIER:
        return 4, 1, 2, f"Carry a sealed message to {target.name}."
    if kind is ContractKind.INTEL:
        return 8, 3, 3, f"Gather intelligence on {target.name}."
    if kind is ContractKind.SABOTAGE:
        return 12, 5, 5, f"Sabotage the garrison at {target.name}."
    raise ValueError(kind)
