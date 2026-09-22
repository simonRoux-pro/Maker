"""Conformite des factures electroniques: le seul produit du depot dont le
prix peut porter un objectif a quatre chiffres.

La difference avec les autres n'est pas le trafic, c'est le prix. Une API
utilitaire se vend 9 dollars par mois parce qu'elle fait gagner quelques
minutes. Une API de conformite se vend dix fois plus parce qu'elle evite une
facture rejetee, et parce que l'obligation legale ne se negocie pas.

Calendrier, verifie: reception obligatoire depuis le 1er septembre 2026 pour
toute entreprise assujettie a la TVA, emission depuis la meme date pour les
grandes entreprises et les ETI, et a partir du 1er septembre 2027 pour les
PME, TPE et micro-entreprises. La fenetre de demande est donc ouverte et
datee.
"""

from __future__ import annotations

from pathlib import Path

from ..manifest import Manifest
from ..marketplace_api import DEFAULT_ASSUMPTIONS, MarketplaceApiStrategy, project

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/facturx_api"

# Hypotheses propres a un produit de conformite: moins de visiteurs qu'un
# utilitaire, une conversion plus faible parce que la decision est reflechie,
# mais un panier et une fidelite sans commune mesure. Une entreprise ne change
# pas d'outil de conformite tous les trimestres.
ASSUMPTIONS = {
    **DEFAULT_ASSUMPTIONS,
    "listing_views_per_month": 400,
    "free_signup_rate": 0.05,
    "paid_conversion_rate": 0.03,
    "monthly_churn": 0.10,
    "arpu_eur": 39.0,
}

TIERS = [
    {"nom": "Basic", "prix_usd": 0.0, "quota_mensuel": 100},
    {"nom": "Pro", "prix_usd": 29.0, "quota_mensuel": 5000},
    {"nom": "Ultra", "prix_usd": 99.0, "quota_mensuel": 50000},
    {"nom": "Mega", "prix_usd": 299.0, "quota_mensuel": 500000},
]


class FacturxApi(MarketplaceApiStrategy):
    manifest = MANIFEST
    product_dir = PRODUCT_DIR
    assumptions = ASSUMPTIONS
    tiers = TIERS


STRATEGY = FacturxApi

__all__ = ["STRATEGY", "FacturxApi", "project", "ASSUMPTIONS", "TIERS"]
