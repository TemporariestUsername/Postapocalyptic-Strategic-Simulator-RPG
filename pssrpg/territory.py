"""Territories: nodes on the strategic map."""
from dataclasses import dataclass
from enum import Enum


class Terrain(Enum):
    FERTILE = "fertile"
    RUINS = "ruins"
    IRRADIATED = "irradiated"
    FORTIFIED = "fortified"
    WILDS = "wilds"


PRODUCTION_BY_TERRAIN: dict[Terrain, int] = {
    Terrain.FERTILE: 8,
    Terrain.RUINS: 6,
    Terrain.FORTIFIED: 5,
    Terrain.IRRADIATED: 3,
    Terrain.WILDS: 4,
}


@dataclass
class Territory:
    id: int
    name: str
    terrain: Terrain
    holder_id: int | None = None
    garrison: int = 15
    base_production: int = 5
