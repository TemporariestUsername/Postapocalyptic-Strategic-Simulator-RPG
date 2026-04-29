"""I/O boundary for game clients.

The text REPL uses ``TerminalIO``. Future GUI/web clients can provide
their own implementation of the same contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


class GameIO(Protocol):
    def write(self, line: str = "") -> None:
        """Write one line to the client output."""

    def read(self, prompt: str = "") -> str:
        """Read one line of input from the client."""


@dataclass
class TerminalIO:
    """Default terminal-backed I/O."""

    output: list[str] = field(default_factory=list)

    def write(self, line: str = "") -> None:
        self.output.append(line)
        print(line)

    def read(self, prompt: str = "") -> str:
        return input(prompt)
