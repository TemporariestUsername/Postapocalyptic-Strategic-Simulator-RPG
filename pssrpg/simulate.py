"""Headless runner: simulate the Rust Basin and print yearly summaries."""
from __future__ import annotations

import argparse

from pssrpg.calendar import WEEKS_PER_YEAR
from pssrpg.scenario import rust_basin


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate the Rust Basin.")
    parser.add_argument(
        "--years", type=int, default=5,
        help="Number of years to simulate (default: 5).",
    )
    parser.add_argument(
        "--log", action="store_true",
        help="Print the per-event log after the run.",
    )
    args = parser.parse_args()

    world = rust_basin()
    print(world.political_summary())
    print()

    total_turns = WEEKS_PER_YEAR * args.years
    for _ in range(total_turns):
        world.tick()
        if world.calendar.month == 1 and world.calendar.week == 1:
            print(world.political_summary())
            print()

    print("=== final state ===")
    print(world.political_summary())

    if args.log:
        print("\n--- event log ---")
        for line in world.log:
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
