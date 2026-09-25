"""OpenRouter asset generator: images (Gemini image models) and music (Lyria).

Usage as library: gen_image(prompt, out_path, model=..., aspect=...)
Reads OPENROUTER_API_KEY from the environment. Logs spend to tools/spend.log.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

API = "https://openrouter.ai/api/v1/chat/completions"
ROOT = Path(__file__).resolve().parent
LOG = ROOT / "spend.log"


def _post(payload: dict, timeout: int = 300) -> dict:
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/TemporariestUsername/Postapocalyptic-Strategic-Simulator-RPG",
            "X-Title": "Burnlands asset pipeline",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _log(kind: str, model: str, out: str, usage: dict | None) -> None:
    cost = (usage or {}).get("cost")
    with LOG.open("a") as f:
        f.write(json.dumps({"t": time.time(), "kind": kind, "model": model, "out": out, "cost": cost}) + "\n")


def _data_url_bytes(url: str) -> bytes:
    return base64.b64decode(url.split(",", 1)[1])


def gen_image(prompt: str, out: str | Path, model: str = "google/gemini-3.1-flash-image",
              aspect: str | None = None, size: str | None = None, ref_images: list[str | Path] | None = None,
              retries: int = 3) -> Path:
    out = Path(out)
    content: list[dict] = [{"type": "text", "text": prompt}]
    for ref in ref_images or []:
        b = Path(ref).read_bytes()
        mime = "image/png" if str(ref).endswith(".png") else "image/jpeg"
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(b).decode()}"}})
    payload: dict = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "modalities": ["image", "text"],
        "usage": {"include": True},
    }
    cfg = {}
    if aspect:
        cfg["aspect_ratio"] = aspect
    if size:
        cfg["image_size"] = size
    if cfg:
        payload["image_config"] = cfg
    last = None
    for attempt in range(retries):
        try:
            d = _post(payload)
            msg = d["choices"][0]["message"]
            imgs = msg.get("images") or []
            if not imgs:
                raise RuntimeError(f"no image returned: {str(msg.get('content'))[:200]}")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(_data_url_bytes(imgs[0]["image_url"]["url"]))
            _log("image", model, str(out), d.get("usage"))
            return out
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  retry {attempt + 1} for {out.name}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed {out}: {last}")


def gen_music(prompt: str, out: str | Path, model: str = "google/lyria-3-pro-preview") -> Path:
    """Lyria requires streaming; audio arrives base64 in delta.audio.data chunks."""
    out = Path(out)
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}],
               "modalities": ["text", "audio"], "stream": True, "audio": {"format": "mp3"}}
    req = urllib.request.Request(API, data=json.dumps(payload).encode(), headers={
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}", "Content-Type": "application/json"})
    chunks: list[str] = []
    text: list[str] = []
    usage = None
    with urllib.request.urlopen(req, timeout=900) as r:
        for raw in r:
            line = raw.decode().strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            d = json.loads(line[6:])
            usage = d.get("usage") or usage
            for ch in d.get("choices", []):
                delta = ch.get("delta") or {}
                if delta.get("content"):
                    text.append(delta["content"])
                a = delta.get("audio") or {}
                if a.get("data"):
                    chunks.append(a["data"])
    if not chunks:
        raise RuntimeError(f"no audio; text={''.join(text)[:300]}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(b"".join(base64.b64decode(c) for c in chunks))
    _log("music", model, str(out), usage)
    return out


def spend() -> float:
    if not LOG.exists():
        return 0.0
    return sum((json.loads(l).get("cost") or 0) for l in LOG.read_text().splitlines() if l.strip())


if __name__ == "__main__":
    print(f"logged spend: ${spend():.3f}")
