"""Minimal desktop GUI client for the strategic simulator."""
from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, simpledialog
from pathlib import Path

from pssrpg.engine import Engine


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("PSSRPG Prototype GUI")
        self.geometry("900x600")
        self.engine = Engine.new()
        self.asset_root = Path(__file__).resolve().parents[1] / "assets" / "ui" / "icons"
        self._images: dict[str, tk.PhotoImage] = {}

        self.header = tk.StringVar()
        self.location = tk.StringVar()
        self.contract = tk.StringVar()
        self.market = tk.StringVar()
        self.log = tk.Text(self, height=18, width=90, state="disabled")
        self.neighbors = tk.Listbox(self, height=7)

        self._build()
        self.refresh()

    def _build(self) -> None:
        top = tk.Frame(self)
        top.pack(fill=tk.X, padx=10, pady=8)
        tk.Label(top, textvariable=self.header, font=("Arial", 13, "bold")).pack(anchor="w")
        tk.Label(top, textvariable=self.location).pack(anchor="w")
        tk.Label(top, textvariable=self.contract, fg="#2a2a2a").pack(anchor="w")
        tk.Label(top, textvariable=self.market, fg="#1f4d6b").pack(anchor="w")

        buttons = tk.Frame(self)
        buttons.pack(fill=tk.X, padx=10, pady=6)
        for text, key, fn in [
            ("Travel", "travel", self.on_travel),
            ("Accept", "accept", self.on_accept),
            ("Work", "work", lambda: self.step("work")),
            ("Market Buy", "buy", lambda: self.step("market_buy")),
            ("Market Sell", "sell", lambda: self.step("market_sell")),
            ("Rest", "rest", lambda: self.step("rest")),
            ("Inspect", "inspect", lambda: self.step("inspect")),
            ("News", "news", lambda: self.step("news")),
            ("Quit", "quit", lambda: self.step("quit")),
        ]:
            img = self._load_icon(key)
            tk.Button(buttons, text=text, image=img, compound=tk.LEFT, command=fn, width=110).pack(side=tk.LEFT, padx=4)

        mid = tk.Frame(self)
        mid.pack(fill=tk.BOTH, expand=True, padx=10, pady=6)
        left = tk.Frame(mid)
        left.pack(side=tk.LEFT, fill=tk.Y)
        tk.Label(left, text="Adjacent Territories").pack(anchor="w")
        self.neighbors.pack(in_=left, fill=tk.Y)
        self.log.pack(in_=mid, side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(12, 0))

    def append_log(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert(tk.END, text + "\n")
        self.log.see(tk.END)
        self.log.configure(state="disabled")

    def refresh(self) -> None:
        s = self.engine.state()
        self.header.set(
            f"{s['calendar']}   resources={s['resources']}   renown={s['renown']}   cargo={s['cargo']}"
        )
        loc = s["location"]
        self.location.set(f"Location: {loc['name']} [{loc['terrain']}] garrison={loc['garrison']}")
        self.market.set(f"Local market price: {self._market_price_hint(loc['id'])}")
        self.neighbors.delete(0, tk.END)
        for i, line in enumerate(self._neighbor_lines()):
            self.neighbors.insert(i, line)
        c = s["contract"]
        self.contract.set(
            "Contract: (none)" if c is None
            else f"Contract: [{c['kind']}] {c['description']} deadline={c['deadline_week']}"
        )
        if s["outcome"]:
            messagebox.showinfo("Outcome", s["outcome"])

    def step(self, action: str, **payload: object) -> None:
        result = self.engine.apply(action, **payload)
        self.append_log(f"> {action} {payload if payload else ''}".rstrip())
        for m in result.get("messages", []):
            if m:
                self.append_log(m)
        self.append_log(f"  advanced={result['advanced']}")
        self.refresh()
        if action == "quit":
            self.destroy()

    def on_travel(self) -> None:
        sel = self.neighbors.curselection()
        if not sel:
            idx = simpledialog.askinteger("Travel", "Neighbor index?")
            if idx is None:
                return
        else:
            idx = int(sel[0])
        if idx is None:
            return
        self.step("travel", index=idx)

    def on_accept(self) -> None:
        ok = messagebox.askyesno("Accept contract", "Accept standing local offer?")
        self.step("accept", confirm=ok)

    def _neighbor_lines(self) -> list[str]:
        s = self.engine.state()
        loc_id = s["location"]["id"]
        world = self.engine.game.world
        lines: list[str] = []
        for n in world.neighbors(loc_id):
            holder = world.factions.get(n.holder_id) if n.holder_id is not None else None
            tag = holder.short if holder else "--"
            lines.append(f"{n.name:<14} {n.terrain.value:<11} held={tag} garr={n.garrison}")
        return lines

    def _market_price_hint(self, loc_id: int) -> int:
        world = self.engine.game.world
        terrain = world.territories[loc_id].terrain.value
        week = world.calendar.absolute_week
        terrain_base = {"ruins": 5, "wilds": 4, "irradiated": 3, "fertile": 2, "fortified": 6}.get(terrain, 4)
        swing = ((loc_id * 7 + week * 3) % 5) - 2
        return max(1, terrain_base + swing)

    def _load_icon(self, name: str) -> tk.PhotoImage | str:
        path = self.asset_root / f"{name}.ppm"
        if not path.exists():
            return ""
        self._images[name] = tk.PhotoImage(file=str(path))
        return self._images[name]


def main() -> int:
    App().mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
