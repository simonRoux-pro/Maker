"""Propositions pour le cycle suivant.

Deux sources: les verdicts sur l'existant, et un backlog de pistes candidates
filtre par la memoire, pour ne pas reproposer ce qui a deja echoue.
"""

from __future__ import annotations

import sqlite3

from .. import memory
from .analyze import KILL, PROMOTE, SCALE, WATCH

# Backlog des pistes retenues. Chaque entree reste une hypothese tant qu'elle
# n'a pas ete mesuree. needs_operator liste ce qui exige une identite verifiee,
# donc Simon, et rien d'autre.
BACKLOG = [
    {
        "id": "micro_api_marketplace",
        "strategy": "jours_feries_api",
        "title": "Micro-API payante sur marketplace",
        "mechanism": "abonnement mensuel par palier, la marketplace facture et reverse sur PayPal",
        "setup_cost": 0.0,
        "monthly_cost": 0.0,
        "automation": "elevee",
        "risk": "moyen",
        "needs_operator": [
            "creation du compte vendeur avec identite et formulaire fiscal",
            "liaison du compte au PayPal",
        ],
    },
    {
        "id": "veille_abonnement",
        "title": "Veille automatisee vendue en abonnement",
        "mechanism": "flux d'alertes ou newsletter payante, sources publiques ou API autorisees",
        "setup_cost": 0.0,
        "monthly_cost": 0.0,
        "automation": "tres elevee",
        "risk": "moyen",
        "needs_operator": [
            "creation du compte de paiement",
            "verification que chaque source autorise l'usage automatise",
        ],
    },
    {
        "id": "produits_numeriques",
        "title": "Produits numeriques sur plateforme de vente",
        "mechanism": "vente a l'unite, commission plateforme",
        "setup_cost": 0.0,
        "monthly_cost": 0.0,
        "automation": "moyenne",
        "risk": "moyen",
        "needs_operator": ["creation du compte vendeur", "liaison PayPal"],
    },
    {
        "id": "templates_code",
        "title": "Kits de demarrage et templates de code payants",
        "mechanism": "vente a l'unite avec licence par projet",
        "setup_cost": 0.0,
        "monthly_cost": 0.0,
        "automation": "moyenne",
        "risk": "faible",
        "needs_operator": ["creation du compte vendeur", "liaison PayPal"],
    },
]


def propose(conn_memory: sqlite3.Connection, analysis: dict) -> list[dict]:
    proposals: list[dict] = []

    for row in analysis["strategies"]:
        name = row["strategy"]
        if row["verdict"] == SCALE:
            proposals.append(
                {
                    "kind": "ajuster",
                    "target": name,
                    "action": "augmenter le budget alloue et la cadence",
                    "why": row["why"],
                }
            )
        elif row["verdict"] == KILL:
            proposals.append(
                {
                    "kind": "tuer",
                    "target": name,
                    "action": "desactiver dans config/strategies.toml",
                    "why": row["why"],
                }
            )
        elif row["verdict"] == PROMOTE:
            proposals.append(
                {
                    "kind": "promouvoir",
                    "target": name,
                    "action": "passer mode = \"live\" apres accord de l'operateur",
                    "why": row["why"],
                }
            )
        elif row["verdict"] == WATCH:
            proposals.append(
                {
                    "kind": "observer",
                    "target": name,
                    "action": "relancer un cycle de simulation",
                    "why": row["why"],
                }
            )

    tried = {a["hypothesis"] for a in memory.history(conn_memory, limit=500)}
    implemented = {row["strategy"] for row in analysis["strategies"]}
    for candidate in BACKLOG:
        if candidate["id"] in tried:
            continue
        # une piste deja portee par une strategie du depot n'est plus une piste
        if candidate.get("strategy") in implemented:
            continue
        proposals.append(
            {
                "kind": "nouvelle piste",
                "target": candidate["id"],
                "action": f"implementer {candidate['title']} en dry-run",
                "why": (
                    f"mecanisme: {candidate['mechanism']}, mise en route "
                    f"{candidate['setup_cost']} EUR, automatisation {candidate['automation']}, "
                    f"risque {candidate['risk']}"
                ),
                "needs_operator": candidate["needs_operator"],
            }
        )

    return proposals
