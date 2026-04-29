"""Generate placeholder postapocalyptic assets without external deps."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def write_ppm(path: Path, w: int, h: int, rgb: tuple[int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        f.write(f"P3\n{w} {h}\n255\n")
        row = " ".join(f"{rgb[0]} {rgb[1]} {rgb[2]}" for _ in range(w))
        for _ in range(h):
            f.write(row + "\n")


def main() -> int:
    palette = {
        "travel": (112, 139, 145),
        "accept": (97, 140, 84),
        "work": (161, 125, 79),
        "buy": (72, 95, 132),
        "sell": (132, 95, 72),
        "rest": (92, 92, 110),
        "inspect": (116, 116, 74),
        "news": (110, 78, 78),
        "quit": (122, 64, 64),
    }
    for name, color in palette.items():
        write_ppm(ASSETS / "ui" / "icons" / f"{name}.ppm", 24, 24, color)
    write_ppm(ASSETS / "ui" / "panels" / "hud_bg.ppm", 300, 100, (52, 50, 50))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
