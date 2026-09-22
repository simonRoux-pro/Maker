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

    seuil = summary.get("min_monthly_margin", 0.0)
    if summary.get("viability"):
        lines += ["", f"## Viabilite, seuil de {seuil} EUR nets par mois", ""]
        for row in sorted(summary["viability"], key=lambda r: -(r["ceiling"] or 0)):
            verdict = "tient le seuil" if row["viable"] else "sous le seuil"
            besoin = (
                f"{row['views_needed']} visites par mois suffisent"
                if row["views_needed"] is not None
                else "seuil hors d'atteinte"
            )
            lines.append(
                f"- {row['strategy']}: plafond {row['ceiling']:.2f} EUR par mois, "
                f"{verdict}, {besoin}"
            )
            cible = summary.get("target_monthly_margin", 0.0)
            if cible and row.get("views_for_target") is not None:
                lines.append(
                    f"  - pour {cible:.0f} EUR par mois il faudrait "
                    f"{row['views_for_target']} visites mensuelles"
                )
            elif cible:
                lines.append(
                    f"  - {cible:.0f} EUR par mois sont hors d'atteinte avec ce modele"
                )

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
        lines.append("- aucune action en file")
    for a in summary["pending_approvals"]:
        lines.append(
            f"- #{a['id']} {a['strategy']} [{a['kind']}] {a['summary']} "
            f"cout estime {a['estimated_cost']} EUR, risque {a['risk']}"
        )

    lines += ["", "## Ce que le code ne peut pas faire a ta place", ""]
    tasks = summary.get("operator_tasks", [])
    if not tasks:
        lines.append("- rien")
    for t in tasks:
        lines.append(f"- {t['strategy']}: {t['task']}")

    lines.append("")
    return "\n".join(lines)


def write(cycle: int, summary: dict) -> Path:
    path = journal_dir() / f"{date.today().isoformat()}-cycle-{cycle:02d}.md"
    path.write_text(render(cycle, summary), encoding="utf-8")
    return path
