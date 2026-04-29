"""Factions: the autonomous strategic actors of the living world."""
from dataclasses import dataclass
from enum import Enum


class Ideology(Enum):
    PRAGMATIST = "pragmatist"
    MILITARIST = "militarist"
    THEOCRAT = "theocrat"
    TECHNOCRAT = "technocrat"
    RAIDER = "raider"
    AGRARIAN = "agrarian"
    SLAVER = "slaver"


# Per-week probability that the faction takes an aggressive action.
AGGRESSION: dict[Ideology, float] = {
    Ideology.PRAGMATIST: 0.15,
    Ideology.MILITARIST: 0.55,
    Ideology.THEOCRAT: 0.35,
    Ideology.TECHNOCRAT: 0.20,
    Ideology.RAIDER: 0.70,
    Ideology.AGRARIAN: 0.05,
    Ideology.SLAVER: 0.65,
}


@dataclass
class Faction:
    id: int
    name: str
    short: str
    ideology: Ideology
    leader_name: str
    leader_age: int = 40
    troops: int = 50
    resources: int = 100
    capital_id: int | None = None
    alive: bool = True

    @property
    def aggression(self) -> float:
        return AGGRESSION[self.ideology]
