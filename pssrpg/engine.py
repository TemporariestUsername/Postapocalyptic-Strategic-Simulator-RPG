"""Headless engine facade for non-terminal clients."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pssrpg.game import Game


@dataclass
class Engine:
    game: Game

    @classmethod
    def new(cls) -> "Engine":
        return cls(game=Game())

    def state(self) -> dict[str, Any]:
        return self.game.snapshot_state()

    def actions(self) -> list[str]:
        return self.game.available_actions()

    def apply(self, action: str, **payload: Any) -> dict[str, Any]:
        advanced = self.game.apply_action(action, **payload)
        if advanced:
            self.game._advance_world()
            self.game._check_outcome()
        return {
            "advanced": advanced,
            "state": self.state(),
            "actions": self.actions(),
            "outcome": self.game.outcome,
            "messages": self.game.drain_output(),
        }
