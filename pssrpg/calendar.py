"""Post-Collapse calendar: 13 months of 4 weeks = 52 weeks per year."""
from dataclasses import dataclass

WEEKS_PER_MONTH = 4
MONTHS_PER_YEAR = 13
WEEKS_PER_YEAR = WEEKS_PER_MONTH * MONTHS_PER_YEAR


@dataclass
class Calendar:
    year: int = 73
    month: int = 1
    week: int = 1

    def tick(self) -> tuple[bool, bool]:
        """Advance one week. Returns (month_rolled, year_rolled)."""
        self.week += 1
        month_rolled = False
        year_rolled = False
        if self.week > WEEKS_PER_MONTH:
            self.week = 1
            self.month += 1
            month_rolled = True
            if self.month > MONTHS_PER_YEAR:
                self.month = 1
                self.year += 1
                year_rolled = True
        return month_rolled, year_rolled

    def __str__(self) -> str:
        return f"PC{self.year:03d}-M{self.month:02d}-W{self.week}"
