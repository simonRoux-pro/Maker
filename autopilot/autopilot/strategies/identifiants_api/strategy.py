"""Vente de l'API de validation des identifiants France et SEPA.

Deuxieme produit sur les memes rails que jours_feries_api. Le chemin complet,
compte fournisseur, versements PayPal, commande de deploiement, secret de
proxy, a deja ete parcouru: il ne reste qu'un worker a creer et une fiche a
publier.

Hypotheses de revenu volontairement differentes du premier produit: la
validation d'IBAN est un terme beaucoup plus cherche, donc plus de visites,
mais la concurrence gratuite y est aussi plus forte, donc une conversion
payante plus faible. Ces deux ajustements se compensent en partie, ce qui est
exactement le genre de pari qu'il faut mesurer plutot que croire.
"""

from __future__ import annotations

from pathlib import Path

from ..manifest import Manifest
from ..marketplace_api import DEFAULT_ASSUMPTIONS, MarketplaceApiStrategy, project

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/identifiants_api"

ASSUMPTIONS = {
    **DEFAULT_ASSUMPTIONS,
    "listing_views_per_month": 900,   # sujet plus cherche que les jours feries
    "paid_conversion_rate": 0.03,     # mais davantage d'alternatives gratuites
    "arpu_eur": 9.0,                  # panier plus bas, le besoin est ponctuel
}

TIERS = [
    {"nom": "Basic", "prix_usd": 0.0, "quota_mensuel": 500},
    {"nom": "Pro", "prix_usd": 9.0, "quota_mensuel": 25000},
    {"nom": "Ultra", "prix_usd": 29.0, "quota_mensuel": 250000},
]


class IdentifiantsApi(MarketplaceApiStrategy):
    manifest = MANIFEST
    product_dir = PRODUCT_DIR
    assumptions = ASSUMPTIONS
    tiers = TIERS


STRATEGY = IdentifiantsApi

__all__ = ["STRATEGY", "IdentifiantsApi", "project", "ASSUMPTIONS", "TIERS"]
