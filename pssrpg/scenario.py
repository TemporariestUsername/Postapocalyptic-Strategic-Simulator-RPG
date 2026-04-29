"""The starting Rust Basin scenario: 15 territories, 7 factions."""
from __future__ import annotations

from pssrpg.faction import Faction, Ideology
from pssrpg.territory import PRODUCTION_BY_TERRAIN, Terrain, Territory
from pssrpg.world import World

# id, name, terrain
TERRITORY_SPECS: list[tuple[int, str, Terrain]] = [
    (0, "Forge",       Terrain.RUINS),
    (1, "Coalspur",    Terrain.RUINS),
    (2, "Greenhollow", Terrain.FERTILE),
    (3, "Saltmarsh",   Terrain.FERTILE),
    (4, "Glasspan",    Terrain.IRRADIATED),
    (5, "Ash Reach",   Terrain.IRRADIATED),
    (6, "Vault-7",     Terrain.FORTIFIED),
    (7, "Bonefields",  Terrain.WILDS),
    (8, "Drycreek",    Terrain.WILDS),
    (9, "Tally Hold",  Terrain.FORTIFIED),
    (10, "Iron Gate",  Terrain.FORTIFIED),
    (11, "Millhouse",  Terrain.FERTILE),
    (12, "Rust Strand", Terrain.RUINS),
    (13, "Scour",      Terrain.IRRADIATED),
    (14, "Lowback",    Terrain.WILDS),
]

ADJACENCY: dict[int, list[int]] = {
    0:  [1, 11, 12],
    1:  [0, 2, 12],
    2:  [1, 3, 11],
    3:  [2, 11, 14],
    4:  [5, 6, 13],
    5:  [4, 7, 13],
    6:  [4, 10, 13],
    7:  [5, 8, 14],
    8:  [7, 9, 14],
    9:  [8, 10, 14],
    10: [6, 9, 13],
    11: [0, 2, 3],
    12: [0, 1, 13],
    13: [4, 5, 6, 10, 12],
    14: [3, 7, 8, 9],
}

# faction_id -> list of territory ids it starts holding.
# Territory 1 (Coalspur) is unclaimed contested ground.
INITIAL_HOLDINGS: dict[int, list[int]] = {
    0: [0, 12],       # Forge Pact
    1: [10],          # Iron Wreath
    2: [4, 5],        # The Glassed
    3: [6],           # Concord Enclave
    4: [7, 8],        # Bone Wolves
    5: [2, 3, 11],    # Free Holds
    6: [9, 13, 14],   # The Tally
}

FACTION_SPECS: list[Faction] = [
    Faction(id=0, name="The Forge Pact",  short="FP",
            ideology=Ideology.PRAGMATIST, leader_name="Maren Vask",
            leader_age=52, troops=60, capital_id=0),
    Faction(id=1, name="Iron Wreath",     short="IW",
            ideology=Ideology.MILITARIST, leader_name="Col. Hask",
            leader_age=58, troops=90, capital_id=10),
    Faction(id=2, name="The Glassed",     short="GL",
            ideology=Ideology.THEOCRAT,   leader_name="Sister Vell",
            leader_age=44, troops=55, capital_id=4),
    Faction(id=3, name="Concord Enclave", short="CE",
            ideology=Ideology.TECHNOCRAT, leader_name="Director Oren",
            leader_age=49, troops=40, capital_id=6),
    Faction(id=4, name="Bone Wolves",     short="BW",
            ideology=Ideology.RAIDER,     leader_name="Khor One-Eye",
            leader_age=37, troops=45, capital_id=7),
    Faction(id=5, name="Free Holds",      short="FH",
            ideology=Ideology.AGRARIAN,   leader_name="Speaker Ivin",
            leader_age=61, troops=35, capital_id=2),
    Faction(id=6, name="The Tally",       short="TT",
            ideology=Ideology.SLAVER,     leader_name="Magister Dren",
            leader_age=46, troops=120, capital_id=9),
]


def rust_basin() -> World:
    world = World()
    for tid, name, terrain in TERRITORY_SPECS:
        world.territories[tid] = Territory(
            id=tid,
            name=name,
            terrain=terrain,
            base_production=PRODUCTION_BY_TERRAIN[terrain],
            garrison=15,
        )
    world.adjacency = {k: list(v) for k, v in ADJACENCY.items()}
    for f in FACTION_SPECS:
        world.factions[f.id] = f
    for fid, tids in INITIAL_HOLDINGS.items():
        for tid in tids:
            world.territories[tid].holder_id = fid
    return world
