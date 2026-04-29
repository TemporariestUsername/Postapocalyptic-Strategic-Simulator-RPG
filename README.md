# Postapocalyptic Strategic Simulator RPG

A turn-based RPG/strategy hybrid inspired by the **living-world simulation
of Koei's *Inindo: Way of the Ninja*** (1991), reset in a gritty, grounded
postapocalyptic setting with mild sci-fi and rare psychic elements.

You are one wanderer in the Rust Basin. Seven factions feud for territory.
A slaver empire called **The Tally** is methodically swallowing the map.
The world turns whether you act or not. Your job is to keep it from
turning all the way.

> **Status: early prototype.** The strategic simulation and a text-based
> player layer are playable. There is no combat yet, no graphics, and no
> party — see the [Roadmap](#roadmap) below. For the full concept, see
> [DESIGN.md](./DESIGN.md).

---

## Requirements

- **Python 3.11 or newer.** That's it for the current prototype — the
  game is text-only and runs in a terminal.
- A terminal that supports basic input (any modern shell on Linux,
  macOS, or Windows works).

The project declares [`tcod`](https://python-tcod.readthedocs.io/) as a
dependency for upcoming rendering / FOV / pathfinding work. It is **not
yet imported** by the v0.2 prototype, so you can run the current
version without installing it.

---

## Installation

Pick one of the two paths.

### Option A — clone and run in place (no install)

The simplest way to try the prototype:

```bash
git clone https://github.com/TemporariestUsername/Postapocalyptic-Strategic-Simulator-RPG.git
cd Postapocalyptic-Strategic-Simulator-RPG
python -m pssrpg
```

No `pip install` needed — the package has no required imports outside
the Python standard library yet.

### Option B — editable install (recommended once you start hacking)

Use this if you plan to edit the code, run the headless simulator a
lot, or want the `pssrpg` console scripts on your PATH. A virtual
environment is recommended:

```bash
git clone https://github.com/TemporariestUsername/Postapocalyptic-Strategic-Simulator-RPG.git
cd Postapocalyptic-Strategic-Simulator-RPG

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -e .
```

This installs the package in editable mode and pulls `tcod` (used by
later versions). After this you can run the game from anywhere with:

```bash
pssrpg            # text REPL
pssrpg-sim        # headless strategic simulator
```

---

## Running

There are two entry points.

### The game (text REPL)

```bash
python -m pssrpg
```

Drops you into the wanderer's seat at Forge, year PC 73, week 1. Each
turn is one week. The world advances after every action that takes
time. Quit with `Q` — there is no save/load yet.

### The headless simulator

```bash
python -m pssrpg.simulate            # 5 years
python -m pssrpg.simulate --years 20 # 20 years
python -m pssrpg.simulate --log      # print the full event log
```

Runs the strategic layer with no player input and prints a snapshot of
the political map at the start of each year. Useful for tuning faction
balance.

---

## Controls

The REPL shows a one-line menu each turn:

```
[T]ravel  [A]ccept  [W]ork  [I]nspect  [R]est  [N]ews  [Q]uit
```

| Key | Action                                                         | Costs a week? |
|-----|----------------------------------------------------------------|---------------|
| T   | Travel to an adjacent territory (you'll be shown a list).      | yes           |
| A   | Accept the standing contract offer from the local faction.    | no            |
| W   | Work your active contract (must be at its target territory).  | yes           |
| I   | Inspect: faction status, your reputation, standing offers.    | no            |
| R   | Rest one week.                                                 | yes           |
| N   | Read recent world events.                                      | no            |
| Q   | Quit.                                                          | -             |

Only the first letter of your input is read. Numeric prompts (e.g.
which adjacent territory to travel to) are 0-indexed.

### Contracts

Every faction periodically posts a contract for a wandering hand. There
are four kinds:

- **Scavenge** — pull salvage from a ruin / wilds / irradiated zone.
- **Courier** — carry a sealed message to one of the issuer's holdings.
- **Intel** — observe an enemy territory and report back. Risks rep
  with the target faction.
- **Sabotage** — degrade an enemy garrison. High pay, high risk; both
  success and failure damage your standing with the target.

Each contract has a deadline (in weeks), a reputation reward, a
reputation penalty for failure or expiry, and a small resource payout.
Resolve a contract by being at its target territory and pressing `W`.
Success chance is the contract's base rate (50–95% depending on kind)
modified up to ±20% by your reputation with the issuer.

### Win and loss

- **Win** — The Tally is eliminated.
- **Lose** — The Tally controls a majority of the basin's territories.

Otherwise play continues indefinitely.

---

## Project layout

```
.
├── DESIGN.md                  # full concept and design rationale
├── README.md                  # this file
├── pyproject.toml             # package metadata, deps, console scripts
└── pssrpg/
    ├── __init__.py
    ├── __main__.py            # python -m pssrpg  -> launches the REPL
    ├── calendar.py            # 13-month, 4-week, post-Collapse calendar
    ├── territory.py           # map nodes
    ├── faction.py             # autonomous strategic actors
    ├── world.py               # the living world: per-tick simulation
    ├── scenario.py            # the Rust Basin starting scenario
    ├── simulate.py            # headless runner (pssrpg-sim)
    ├── contract.py            # contract kinds, generation, terms
    ├── player.py              # the wanderer
    └── game.py                # the text REPL (pssrpg)
```

The simulation core (`world.py`, `faction.py`, `territory.py`,
`calendar.py`, `scenario.py`) has no external dependencies and no UI
coupling, so it can be reused by any future renderer.

---

## Roadmap

Done:

- **v0.1** — living-world simulation: 15-territory Rust Basin, 7
  factions, ideology-driven aggression, monthly production, yearly
  succession.
- **v0.2** — player layer: solo wanderer, weekly travel, faction
  reputation, contract generation/acceptance/resolution, text REPL,
  win/loss conditions.

Planned:

- **v0.3** — recruitable named NPCs and a party of up to 5.
- **v0.4** — skirmish combat on a `tcod` grid (party vs. raiders /
  patrols / mutants).
- **v0.5** — strategic diplomacy: alliances, truces, vassalage.
- **v0.6** — Resonance (rare psychic abilities with a Bleed cost) and
  Heritage tech (rare pre-Collapse items).
- **v0.7** — army-vs-army "Battle" combat layer when the player
  pledges service to a faction at war.
- **Later** — save/load, content (more factions, more territories,
  more contract kinds), proper terminal UI.

---

## Contributing / hacking

The codebase is small (~600 lines) and intentionally engine-agnostic.
Good places to poke at:

- **Faction balance** — `pssrpg/faction.py` (`AGGRESSION` table) and
  `pssrpg/world.py` (`_faction_actions`). Use `pssrpg-sim --years 20`
  to see how starting conditions evolve.
- **New contract kinds** — `pssrpg/contract.py` (`ContractKind`,
  `BASE_SUCCESS`, `_pick_target`, `_terms`, `preferred_kinds`).
- **Scenario** — edit `pssrpg/scenario.py` to add territories, change
  adjacency, or rebalance starting holdings.

There are no tests yet. Both runners exit cleanly on `python -m pssrpg`
and `python -m pssrpg.simulate --years 5`; treat those as smoke tests
until proper test coverage lands.

---

## License

Not yet specified. Treat as "all rights reserved" until a license file
is added.
