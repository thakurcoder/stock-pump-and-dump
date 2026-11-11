"""
pumpwatch.cli — Command-line entry point.

Usage:
    python -m pumpwatch.cli [OPTIONS]

Options:
    --tickers PATH      Path to ticker file (default: tickers.txt)
    --top N             Show top N results (default: 20)
    --min-score X       Hide stocks below this score (default: 0)
    --asof YYYY-MM-DD   Screen as of a past date
    --no-cache          Force fresh download
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from datetime import date
from pathlib import Path

from rich.console import Console
from rich.table import Table

from . import data, signals, scoring

DISCLAIMER = (
    "[dim]Screening tool only. Flags suspicious patterns, "
    "not proof of manipulation.[/dim]"
)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)-8s %(name)s  %(message)s",
    )


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pumpwatch",
        description="Screen NSE stocks for pump-and-dump patterns.",
    )
    p.add_argument(
        "--tickers",
        default=str(data.DEFAULT_TICKERS_PATH),
        help="Path to ticker list (default: pumpwatch/tickers.txt)",
    )
    p.add_argument("--top", type=int, default=20, help="Show top N results")
    p.add_argument(
        "--min-score", type=float, default=0, help="Hide below this score"
    )
    p.add_argument(
        "--asof",
        default=None,
        help="Run screen as-of YYYY-MM-DD (uses data up to that date)",
    )
    p.add_argument(
        "--no-cache",
        action="store_true",
        help="Force fresh download, ignore cache",
    )
    return p


def main(argv: list[str] | None = None) -> None:
    _setup_logging()
    args = _build_parser().parse_args(argv)
    console = Console()

    # ── Load tickers ─────────────────────────────────────────────────────
    tickers_path = args.tickers
    if not Path(tickers_path).exists():
        console.print(f"[red]Ticker file not found:[/red] {tickers_path}")
        sys.exit(1)

    tickers = data.load_tickers(tickers_path)
    console.print(
        f"\n[bold cyan]PumpWatch[/bold cyan]  ·  screening {len(tickers)} NSE tickers\n"
    )

    # ── Execute screening via shared pipeline ────────────────────────────
    from .screen import run_screen_with_metadata

    meta = run_screen_with_metadata(
        tickers=tickers,
        asof=args.asof,
        use_cache=not args.no_cache,
    )
    results = meta["stocks"]
    skipped = meta["skipped"]

    if skipped:
        console.print(f"[yellow]Skipped {len(skipped)} ticker(s):[/yellow]")
        for s in skipped:
            console.print(f"  [dim]• {s}[/dim]")
        console.print()

    # Apply min-score filter
    filtered = [r for r in results if r["score"] >= args.min_score]
    top = filtered[: args.top]

    # ── Rich table ───────────────────────────────────────────────────────
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    table = Table(
        title="PumpWatch — NSE Pump & Dump Screen",
        title_style="bold cyan",
        show_lines=False,
        padding=(0, 1),
    )
    table.add_column("Rank", justify="right", style="dim", width=4)
    table.add_column("Ticker", style="bold white", width=12)
    table.add_column("Score", justify="right", width=6)
    table.add_column("Level", width=8)
    table.add_column("Close (INR)", justify="right", width=12)
    table.add_column("Reasons", ratio=1)

    level_colors = {
        "Extreme": "bold magenta",
        "High": "bold red",
        "Medium": "bold yellow",
        "Low": "green",
    }

    for i, r in enumerate(top, 1):
        color = level_colors.get(r["level"], "white")
        table.add_row(
            str(i),
            r["ticker"],
            f"{r['score']:.1f}",
            f"[{color}]{r['level']}[/{color}]",
            f"INR {r['last_close']:,.2f}",
            r["reasons"],
        )

    console.print(table)
    console.print()

    # ── CSV export ───────────────────────────────────────────────────────
    out_dir = Path("output")
    out_dir.mkdir(exist_ok=True)
    asof_label = args.asof or date.today().isoformat()
    csv_path = out_dir / f"pumpwatch_{asof_label}.csv"

    fieldnames = [
        "rank", "ticker", "score", "level", "last_close", "last_date",
        "volume_ratio", "volume_zscore",
        "price_change_1d", "price_change_3d", "price_change_5d",
        "rsi", "bb_upper", "bb_lower", "bb_breach",
        "avg_daily_turnover_cr", "is_thinly_traded",
        "reasons",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for i, r in enumerate(results, 1):
            writer.writerow({
                "rank": i,
                "ticker": r["ticker"],
                "score": r["score"],
                "level": r["level"],
                "last_close": r["last_close"],
                "last_date": r["last_date"],
                "volume_ratio": r["volume_ratio"],
                "volume_zscore": r["volume_zscore"],
                "price_change_1d": r["price_change_1d"],
                "price_change_3d": r["price_change_3d"],
                "price_change_5d": r["price_change_5d"],
                "rsi": r["rsi"],
                "bb_upper": r["bb_upper"],
                "bb_lower": r["bb_lower"],
                "bb_breach": r["bb_breach"],
                "avg_daily_turnover_cr": r["avg_turnover_cr"],
                "is_thinly_traded": r["thinly_traded"],
                "reasons": r["reasons"],
            })

    console.print(f"[green]✓[/green] Full results saved to [bold]{csv_path}[/bold]")
    console.print()
    console.print(DISCLAIMER)
    console.print()


if __name__ == "__main__":
    main()
