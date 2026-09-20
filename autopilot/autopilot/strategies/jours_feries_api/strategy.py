"""Vente de l'API jours feries et delais France sur une marketplace d'APIs.

Le produit est dans products/jours_feries_api: pur calcul, aucune dependance
externe, 69 tests. Il tourne sur le palier gratuit de Cloudflare Workers, donc
le cout d'infrastructure est nul jusqu'a 100 000 requetes par jour.

Toute la mecanique de vente est dans marketplace_api.py. Ce module ne declare
que ce qui est propre a ce produit.
"""

from __future__ import annotations

from pathlib import Path

from ..manifest import Manifest
from ..marketplace_api import DEFAULT_ASSUMPTIONS, MarketplaceApiStrategy, project

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/jours_feries_api"

# Hypotheses de depart. Elles sont fausses par construction et seront
# remplacees par des mesures des le premier chiffre reel.
ASSUMPTIONS = dict(DEFAULT_ASSUMPTIONS)

TIERS = [
    {"nom": "Basic", "prix_usd": 0.0, "quota_mensuel": 500},
    {"nom": "Pro", "prix_usd": 9.0, "quota_mensuel": 20000},
    {"nom": "Ultra", "prix_usd": 29.0, "quota_mensuel": 200000},
]


class JoursFeriesApi(MarketplaceApiStrategy):
    manifest = MANIFEST
    product_dir = PRODUCT_DIR
    assumptions = ASSUMPTIONS
    tiers = TIERS


STRATEGY = JoursFeriesApi

__all__ = ["STRATEGY", "JoursFeriesApi", "project", "ASSUMPTIONS", "TIERS"]
