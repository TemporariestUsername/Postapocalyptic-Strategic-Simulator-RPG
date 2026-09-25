"""Turn raw generated art/audio (tools/raw) into optimized game assets (public/assets).

Images -> WebP (portraits 512 + face tokens 256, scenes 1920x1080, props with chroma-keyed alpha).
Music  -> Opus/WebM 72 kbps.  SFX -> trimmed, normalized MP3.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tools" / "raw"
OUT = ROOT / "public" / "assets"
FF = imageio_ffmpeg.get_ffmpeg_exe()


def save_webp(im: Image.Image, path: Path, q: int = 80) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)


def cover(im: Image.Image, w: int, h: int) -> Image.Image:
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def portraits() -> None:
    for cat in ("portraits", "warlords", "npcs", "enemies"):
        for f in sorted((RAW / cat).glob("*.png")):
            im = Image.open(f).convert("RGB")
            save_webp(im.resize((512, 512), Image.LANCZOS), OUT / cat / f"{f.stem}.webp", 82)
            # face token: upper-centre crop
            w, h = im.size
            box = (int(w * 0.2), int(h * 0.04), int(w * 0.8), int(h * 0.64))
            save_webp(im.crop(box).resize((256, 256), Image.LANCZOS), OUT / "tokens" / cat / f"{f.stem}.webp", 82)


def scenes() -> None:
    for cat in ("story", "towns", "interiors", "events", "delve", "battlemaps"):
        for f in sorted((RAW / cat).glob("*.png")):
            im = Image.open(f).convert("RGB")
            save_webp(cover(im, 1920, 1080), OUT / cat / f"{f.stem}.webp", 78)
    key = RAW / "key"
    save_webp(cover(Image.open(key / "title.png").convert("RGB"), 1920, 1080), OUT / "key" / "title.webp", 82)
    m = Image.open(key / "map.png").convert("RGB")
    save_webp(m, OUT / "key" / "map.webp", 82)
    # logo: flood the black background from the corners, then key it out with a soft edge
    lg = Image.open(key / "logo.png").convert("RGB")
    work = lg.copy()
    for c in [(0, 0), (lg.width - 1, 0), (0, lg.height - 1), (lg.width - 1, lg.height - 1), (lg.width // 2, 2), (lg.width // 2, lg.height - 3)]:
        ImageDraw.floodfill(work, c, (255, 0, 255), thresh=38)
    a = np.array(work)
    mask = ~((a[:, :, 0] == 255) & (a[:, :, 1] == 0) & (a[:, :, 2] == 255))
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = lg.convert("RGBA")
    rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    rgba.thumbnail((1400, 600), Image.LANCZOS)
    save_webp(rgba, OUT / "key" / "logo.webp", 88)
    fav = Image.open(RAW / "abilities" / "fireball.png").convert("RGB").resize((64, 64), Image.LANCZOS)
    (OUT / "ui").mkdir(parents=True, exist_ok=True)
    fav.save(OUT / "ui" / "favicon.png")


def chroma(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGB")).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # magenta-ness: high r & b, low g
    mag = np.clip(((r + b) / 2 - g - 60) / 80, 0, 1)
    alpha = 1 - mag
    # despill: pull magenta fringe toward neutral
    spill = np.clip((np.minimum(r, b) - g) / 255, 0, 1) * (1 - alpha * 0.5)
    a[:, :, 0] -= spill * 120
    a[:, :, 2] -= spill * 120
    out = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    al = img.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    img.putalpha(al)
    return img.crop(img.getbbox())


def props() -> None:
    for f in sorted((RAW / "props").glob("*.png")):
        im = chroma(Image.open(f))
        im.thumbnail((320, 320), Image.LANCZOS)
        save_webp(im, OUT / "props" / f"{f.stem}.webp", 85)


def icons() -> None:
    for cat, size in (("items", 160), ("abilities", 128)):
        for f in sorted((RAW / cat).glob("*.png")):
            save_webp(Image.open(f).convert("RGB").resize((size, size), Image.LANCZOS), OUT / cat / f"{f.stem}.webp", 84)
    for f in sorted((RAW / "ui").glob("*.png")):
        save_webp(Image.open(f).convert("RGB").resize((512, 512), Image.LANCZOS), OUT / "ui" / f"{f.stem}.webp", 80)


def music() -> None:
    (OUT / "music").mkdir(parents=True, exist_ok=True)
    for f in sorted((RAW / "music").glob("*.mp3")):
        out = OUT / "music" / f"{f.stem}.webm"
        if out.exists():
            continue
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(f), "-af", "loudnorm=I=-18:TP=-2",
                        "-c:a", "libopus", "-b:a", "72k", str(out)], check=True)


def pcm(path: Path) -> np.ndarray:
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "44100", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def write_mp3(x: np.ndarray, out: Path, gain_db: float = 0) -> None:
    peak = np.max(np.abs(x)) or 1
    x = x / peak * (10 ** ((-1 + gain_db) / 20))
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "f32le", "-ar", "44100", "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "96k", str(out)], input=x.astype(np.float32).tobytes(), check=True)


def shot(path: Path, length: float, which: int = 0) -> np.ndarray:
    """Cut the `which`-th transient from a long field recording."""
    x = pcm(path)
    env = np.abs(x)
    thr = env.max() * 0.35
    idx = np.where(env > thr)[0]
    onsets = [idx[0]]
    for i in idx[1:]:
        if i - onsets[-1] > 44100 * 0.4:
            onsets.append(i)
    start = max(0, onsets[min(which, len(onsets) - 1)] - 200)
    seg = x[start:start + int(44100 * length)].copy()
    fade = np.linspace(1, 0, len(seg)) ** 2
    return seg * fade


def sfx() -> None:
    S = RAW / "sfx_src"
    k = lambda pack, name: S / f"kenney_{pack}" / name  # noqa: E731
    simple = {
        "ui_click": (k("interface-sounds", "click_002.ogg"), -6),
        "ui_hover": (k("ui-audio", "rollover2.ogg"), -14),
        "ui_open": (k("interface-sounds", "maximize_004.ogg"), -6),
        "ui_close": (k("interface-sounds", "minimize_004.ogg"), -6),
        "ui_confirm": (k("interface-sounds", "confirmation_002.ogg"), -4),
        "ui_error": (k("interface-sounds", "error_004.ogg"), -6),
        "page": (k("rpg-audio", "bookFlip2.ogg"), -4),
        "coins": (k("rpg-audio", "handleCoins.ogg"), -2),
        "dice_shake": (S / "dice-shake-1.ogg", -2),
        "dice_throw": (S / "dice-throw-1.ogg", 0),
        "blade": (k("rpg-audio", "knifeSlice.ogg"), 0),
        "blade2": (k("rpg-audio", "knifeSlice2.ogg"), 0),
        "draw": (k("rpg-audio", "drawKnife2.ogg"), -3),
        "bow": (k("rpg-audio", "drawKnife1.ogg"), -2),
        "blunt": (k("impact-sounds", "impactPunch_heavy_001.ogg"), 0),
        "bite": (k("impact-sounds", "impactSoft_medium_001.ogg"), 0),
        "hit": (k("impact-sounds", "impactSoft_heavy_002.ogg"), 0),
        "hit_metal": (k("impact-sounds", "impactMetal_heavy_002.ogg"), -2),
        "death": (k("impact-sounds", "impactSoft_heavy_004.ogg"), 0),
        "flame": (k("sci-fi-sounds", "thrusterFire_001.ogg"), 0),
        "laser": (k("sci-fi-sounds", "laserLarge_001.ogg"), -2),
        "explosion": (k("sci-fi-sounds", "explosionCrunch_000.ogg"), 0),
        "boom": (k("sci-fi-sounds", "lowFrequency_explosion_000.ogg"), 0),
        "psychic": (k("sci-fi-sounds", "forceField_002.ogg"), 0),
        "glitch": (k("interface-sounds", "glitch_003.ogg"), -4),
        "heal": (k("interface-sounds", "maximize_006.ogg"), -3),
        "step": (k("rpg-audio", "footstep03.ogg"), -8),
        "miss": (k("rpg-audio", "cloth3.ogg"), -4),
        "levelup": (k("interface-sounds", "bong_001.ogg"), 0),
        "turret": (k("rpg-audio", "metalLatch.ogg"), -2),
        "door": (k("rpg-audio", "doorOpen_1.ogg"), -3),
        "engine": (k("sci-fi-sounds", "engineCircular_001.ogg"), -6),
        "equip": (k("rpg-audio", "beltHandle1.ogg"), -3),
        "drop": (k("interface-sounds", "drop_002.ogg"), -4),
    }
    for name, (src, gain) in simple.items():
        write_mp3(pcm(src), OUT / "sfx" / f"{name}.mp3", gain)
    guns = {
        "pistol": (S / "1911" / "A_34P.wav", 0.9, 0),
        "revolver": (S / "Smith & Wesson 642" / "V_22P.wav", 1.0, 0),
        "shotgun": (S / "Mossberg" / "N_26P.wav", 1.3, 0),
        "rifle": (S / "Mosin Nagant" / "M_21P.wav", 1.4, 0),
        "auto": (S / "PPSh" / "P_16P.wav", 0.9, 0),
        "assault": (S / "AK-47" / "C_27P.wav", 1.0, 0),
    }
    for name, (src, length, which) in guns.items():
        write_mp3(shot(src, length, which), OUT / "sfx" / f"{name}.mp3", -2)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["portraits", "scenes", "props", "icons", "music", "sfx"]
    for s in steps:
        print("step", s, flush=True)
        globals()[s]()
    print("done")
