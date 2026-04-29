# Postapocalyptic Strategic Simulator RPG — Design v0.1

A turn-based RPG/strategy hybrid inspired by the **living-world simulation of
Koei's *Inindo: Way of the Ninja*** (1991), reset in a gritty, grounded
postapocalyptic setting with mild sci-fi and rare psychic elements.

## Premise

Seventy-three years after the Collapse (climate failure → resource wars →
limited nuclear and bioweapon exchange → infrastructure breakdown), the former
Rust Basin is a fractured watershed of feuding holds. No central authority
remains. A slaver empire called **The Tally** is methodically swallowing the
map year by year. The player is one wanderer with a small party. The world
turns whether the player acts or not.

## Tone & Genre Pillars

- **Gritty / grounded.** Hunger, infection, ammo scarcity, uneasy truces.
  No superheroes. Death is cheap and frequent.
- **Mild sci-fi.** Pre-Collapse "Heritage" tech exists but is rare, fragile,
  and largely not understood — energy weapons, working drones, autodocs,
  sealed bunkers. Treated as treasure, not gear progression.
- **Rare psychic ("Resonance").** A small fraction of post-Collapse births
  manifest abilities — read intent, brief precognition, kinetic burst.
  Every use costs **Bleed** (mental fatigue, nosebleeds, eventual breakdown).
  Resonants are feared, hunted, or worshipped depending on faction.

## Living World — the Inindo Core

The defining mechanic. The strategic layer is autonomous:

- The map is **~15–25 territories** (prototype: 15) connected by an adjacency
  graph. Each has terrain (fertile / ruins / irradiated / fortified / wilds),
  a holder faction, a garrison, and a base production.
- **5–7 factions** hold territory, troops, resources, and a named leader with
  an age. Each has an ideology that drives an aggression score and behavioural
  bias.
- Every turn, factions take strategic actions — idle, garrison, march, attack,
  recruit, (eventually) negotiate. They do this regardless of the player.
- Leaders age, die, and are succeeded. Factions can be eliminated. Territories
  change hands. The political map at year PC100 will not look like PC73.
- **The Tally** is the implicit timer. If the player ignores the world, The
  Tally consolidates the basin and the game is lost.

## Calendar & Turn Structure

Post-Collapse calendar reform: **13 months × 4 weeks = 52 weeks/year.**
Game starts at **PC 73, M01, W1.**

One turn = one week. Each turn:

1. Calendar advances one week.
2. **Player phase** — one travel/action point (move to adjacent territory,
   rest, accept contract, run a mission, train, recruit). [not in prototype]
3. **World phase** — every faction evaluates and may take a strategic action.
4. **Resolution** — combats resolve, territories may change hands.
5. **Monthly tick** (every 4 weeks) — production, recruitment, supply.
6. **Yearly tick** (every 52 weeks) — leader aging, succession, faction
   strategy reassessment, world events.

## Factions (Rust Basin starting cast)

| Tag | Name              | Ideology    | Notes                                          |
|-----|-------------------|-------------|------------------------------------------------|
| FP  | The Forge Pact    | Pragmatist  | Trader-craft hub, controls a working refinery. |
| IW  | Iron Wreath       | Militarist  | Ex-military officers, disciplined infantry.    |
| GL  | The Glassed       | Theocrat    | Radiation-mystic cult around a glass crater.   |
| CE  | Concord Enclave   | Technocrat  | Bunker descendants, hoard Heritage tech.       |
| BW  | Bone Wolves       | Raider      | Cannibal clan, weak but mobile and brutal.     |
| FH  | Free Holds        | Agrarian    | Loose alliance of farming settlements.         |
| TT  | **The Tally**     | Slaver      | Antagonist. Disciplined army, expansionist.    |

## Player Layer (post-prototype)

- A wanderer with a party of 3–5 recruited NPCs (named, with stats, gear,
  loyalty, and possibly Resonance).
- Travel the territory map; enter settlements and dungeons (vaults, ruins,
  sealed bunkers).
- Take **faction contracts**: scavenge, sabotage, assassinate, escort,
  infiltrate, steal tech, spread rumours, broker peace.
- Build per-faction reputation. Pledging service to a faction unlocks
  army-scale battles.

### Two Combat Scales

- **Skirmish** — turn-based party tactical, your 3–5 vs. raiders/patrols/
  mutants. Default combat. Grid or hex.
- **Battle** — army-vs-army when serving a faction's war. You command one
  unit (your party + attached troops); the faction commands the rest.

## Win / Loss

- **Win.** The Tally is broken: military defeat of their main host, leader
  assassinated and no viable successor, internal coup triggered, OR coalition
  war reduces them below viability.
- **Lose.** The Tally controls a majority of the basin, OR the player party
  wipes with no designated heir.

## Prototype Scope (this branch)

In scope:
- Calendar that ticks weekly with monthly/yearly rollover.
- Static Rust Basin map (15 territories, hand-authored adjacency).
- 7 factions with ideology, leader, troops, resources, holdings.
- Strategic AI: each tick, each faction may attack the weakest adjacent
  enemy territory if RNG passes its aggression check; combat resolved by
  weighted force comparison.
- Monthly production / recruitment; yearly leader aging and succession.
- Headless `python -m pssrpg` runner that simulates N years and prints
  the political map state at each year boundary.

Out of scope (later branches):
- Player character, party, inventory, skills.
- Skirmish or Battle combat.
- Map rendering (`tcod` is a declared dependency for when we add it).
- Save / load.
- Diplomacy beyond "attack or do nothing."
- Resonance and Heritage tech mechanics.

## Tech

- **Python 3.11+**, package `pssrpg`.
- **`tcod`** declared as a dependency for upcoming rendering / FOV /
  pathfinding work; not yet used by the headless prototype.
- No graphics, no engine. The simulation core is intentionally
  engine-agnostic so a future renderer (tcod terminal, then possibly
  Godot / web) can sit on top of it.
