"""Generate every missing image declared in manifest.py (parallel)."""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from manifest import ASSETS
from orgen import gen_image, spend

RAW = Path(__file__).resolve().parent / "raw"
BUDGET = 40.0  # hard stop for image generation, USD


def main() -> int:
    cats = sys.argv[1:] or list(ASSETS)
    todo = [(c, a) for c in cats for a in ASSETS[c] if not (RAW / c / f"{a[0]}.png").exists()]
    print(f"{len(todo)} images to generate; spent so far ${spend():.2f}", flush=True)

    def job(item):
        cat, (id_, prompt, aspect, size) = item
        if spend() > BUDGET:
            return f"SKIP budget {cat}/{id_}"
        gen_image(prompt, RAW / cat / f"{id_}.png", aspect=aspect, size=size)
        return f"ok {cat}/{id_}"

    with ThreadPoolExecutor(8) as ex:
        futs = [ex.submit(job, t) for t in todo]
        for f in as_completed(futs):
            try:
                print(f.result(), flush=True)
            except Exception as e:  # noqa: BLE001
                print("FAIL", e, flush=True)
    print(f"done; total spend ${spend():.2f}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
