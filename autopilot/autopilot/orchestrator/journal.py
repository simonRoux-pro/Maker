"""Redaction du compte-rendu de cycle en markdown, dans journal/."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from ..paths import journal_dir


def render(cycle: int, summary: dict) -> str:
    totals = summary["analysis"]["totals"]
    lines = [
        f"# Cycle {cycle:02d} - {summary['day']}",
        "",
        "## Marge",
        "",
        f"- reel cumule: {totals['live']['margin']} EUR "
        f"(revenus {totals['live']['revenue']}, couts {totals['live']['cost']})",
        f"- simulation du cycle: {totals['dry_run']['margin']} EUR "
        f"(revenus {totals['dry_run']['revenue']}, couts {totals['dry_run']['cost']})",
        "",
        "## Ce qui a tourne",
        "",
    ]

    if not summary["runs"]:
        lines.append("- aucune strategie active")
    for run in summary["runs"]:
        lines.append(
            f"- {run['strategy']} en {run['mode']}: marge {run['margin']} EUR"
        )
        for taken in run["actions_taken"]:
            lines.append(f"  - fait: {taken}")
        for blocked in run["actions_blocked"]:
            lines.append(f"  - bloque: {blocked}")
        for note in run["notes"]:
            lines.append(f"  - note: {note}")

    lines += ["", "## Verdicts", ""]
    for row in summary["analysis"]["strategies"]:
        lines.append(
            f"- {row['strategy']} ({row['mode']}): {row['verdict']}, {row['why']}"
        )

    lines += ["", "## Propositions pour le cycle suivant", ""]
    if not summary["proposals"]:
        lines.append("- aucune")
    for p in summary["proposals"]:
        lines.append(f"- [{p['kind']}] {p['target']}: {p['action']}")
        lines.append(f"  - pourquoi: {p['why']}")
        for need in p.get("needs_operator", []):
            lines.append(f"  - demande une action de Simon: {need}")

    lines += ["", "## En attente de ta validation", ""]
    if not summary["pending_approvals"]:
        lines.append("- rien")
    for a in summary["pending_approvals"]:
        lines.append(
            f"- #{a['id']} {a['strategy']} [{a['kind']}] {a['summary']} "
            f"cout estime {a['estimated_cost']} EUR, risque {a['risk']}"
        )

    lines.append("")
    return "\n".join(lines)


def write(cycle: int, summary: dict) -> Path:
    path = journal_dir() / f"{date.today().isoformat()}-cycle-{cycle:02d}.md"
    path.write_text(render(cycle, summary), encoding="utf-8")
    return path
