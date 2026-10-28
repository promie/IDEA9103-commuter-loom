"""Create the full Commuter Loom dataset from raw Transport for NSW Opal trip data."""

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
RAW_DATA_PATH = PROJECT_DIR / "data" / "train.csv"
OUTPUT_PATH = PROJECT_DIR / "data" / "monthly_line_trips_full.csv"
LINE_FAMILIES = tuple(f"T{line_number}" for line_number in range(1, 10))


def parse_month(raw_month: str) -> str:
    """Convert raw Jul-16 and Apr-2024 values into sortable YYYY-MM values."""
    month_name, raw_year = raw_month.split("-")
    year = int(raw_year)
    if year < 100:
        year += 2000
    month = datetime.strptime(month_name, "%b").month
    return f"{year:04d}-{month:02d}"


def get_line_family(raw_line: str) -> str | None:
    """Return a T1-T9 family when a historical CSV service label starts with it."""
    for family in LINE_FAMILIES:
        if raw_line == family or raw_line.startswith(f"{family} "):
            return family
    return None


def main() -> None:
    totals = defaultdict(int)

    with RAW_DATA_PATH.open(encoding="utf-8-sig", newline="") as raw_file:
        for row in csv.DictReader(raw_file):
            month = parse_month(row["Year_Month"])
            family = get_line_family(row["Line"])
            if family is None:
                continue
            totals[(month, family)] += int(row["Trip"].replace(",", ""))

    months = sorted({month for month, _ in totals})
    previous_totals = {family: 0 for family in LINE_FAMILIES}

    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.DictWriter(
            output_file,
            fieldnames=["month", "line", "totalTrips", "previousTrips", "changeTrips"],
        )
        writer.writeheader()
        for month in months:
            for family in LINE_FAMILIES:
                total_trips = totals[(month, family)]
                previous_trips = previous_totals[family]
                writer.writerow(
                    {
                        "month": month,
                        "line": family,
                        "totalTrips": total_trips,
                        "previousTrips": previous_trips,
                        "changeTrips": total_trips - previous_trips,
                    }
                )
                previous_totals[family] = total_trips

    print(f"Wrote {len(months) * len(LINE_FAMILIES)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
