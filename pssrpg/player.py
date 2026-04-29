"""The wanderer: starting state of the player layer."""
from __future__ import annotations

from dataclasses import dataclass, field

from pssrpg.contract import Contract


@dataclass
class Player:
    name: str = "Wanderer"
    location_id: int = 0
    reputation: dict[int, int] = field(default_factory=dict)
    resources: int = 10
    renown: int = 0
    cargo: int = 0
    cargo_cost_basis: int = 0
    active_contract: Contract | None = None

    def rep(self, faction_id: int) -> int:
        return self.reputation.get(faction_id, 0)

    def adjust_rep(self, faction_id: int, delta: int) -> None:
        self.reputation[faction_id] = self.reputation.get(faction_id, 0) + delta
