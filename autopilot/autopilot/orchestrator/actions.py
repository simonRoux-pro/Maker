"""Genere ACTIONS.md, la feuille de route des actions manuelles.

Elle est produite a partir de l'etat reel du systeme, jamais ecrite a la main:
une etape deja faite disparait toute seule au cycle suivant. Elle contient les
liens, les reglages exacts et les textes a coller, pour que tout puisse etre
fait d'une traite sans rien chercher.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from ..config import Config
from ..paths import home
from ..strategies import Context, registry

# Chaque bloc decrit une action manuelle: comment savoir si elle est faite,
# et tout ce qu'il faut sous la main pour la faire.
BLOCKS = [
    {
        "id": "secrets_depot",
        "state": True,
        "strategy": None,
        "titre": "Coller deux jetons dans les secrets du depot",
        "duree": "6 min",
        "done": lambda s: bool(s.get("cloudflare_token")),
        "liens": [
            (
                "Secrets du depot",
                "https://github.com/simonRoux-pro/Maker/settings/secrets/actions",
            ),
            (
                "Creer le jeton Cloudflare, modele Edit Cloudflare Workers",
                "https://dash.cloudflare.com/profile/api-tokens",
            ),
            ("Creer le jeton npm, type Automation", "https://www.npmjs.com/settings/~/tokens"),
        ],
        "etapes": [
            "Cloudflare, My Profile, API Tokens, Create Token,"
            " modele Edit Cloudflare Workers, copier la valeur",
            "Dans les secrets du depot, New repository secret,"
            " nom CLOUDFLARE_API_TOKEN, coller la valeur",
            "Ajouter aussi CLOUDFLARE_ACCOUNT_ID si le jeton voit plusieurs comptes,"
            " l'identifiant est en bas de la page d'accueil Cloudflare",
            "npm, Access Tokens, Generate New Token, type Automation",
            "Second secret, nom NPM_TOKEN, coller la valeur",
        ],
        "verif": [
            "onglet Actions du depot, relancer le workflow deploy:"
            " https://github.com/simonRoux-pro/Maker/actions/workflows/deploy.yml",
            "les quatre workers doivent se deployer et repondre sur /health",
        ],
        "rendre": ["un message: les jetons sont poses"],
        "pourquoi": (
            "Ce seul geste remplace quatre configurations manuelles dans le tableau "
            "de bord Cloudflare, et rend tous les deploiements suivants automatiques. "
            "Ma machine ne peut pas joindre Cloudflare, mais GitHub Actions le peut."
        ),
    },
    {
        "id": "fiche_facturx",
        "strategy": "facturx_api",
        "titre": "Publier la fiche facturation electronique, la plus rentable",
        "duree": "10 min",
        "done": lambda o: bool(o.get("listing_url")),
        "depend": "secrets_depot",
        "liens": [("Rapid Studio", "https://rapidapi.com/studio")],
        "etapes": [
            "Add API Project, import OpenAPI par fichier",
            "Telecharger d'abord la specification:"
            " https://facturx.pro-simon-roux.workers.dev/openapi.json?download=1",
            "Categorie: Business",
            "Paliers: Basic 0 USD / 100, Pro 29 USD / 5000, Ultra 99 USD / 50000,"
            " Mega 299 USD / 500000, Pro marque Recommended",
            "Ligne Requests: 100, 5000, 50000, 500000. hard-limit BASIC: 100",
            "Health Check URL: /health",
            "Visibility: public, apres les tarifs",
            "Recuperer le Proxy Secret et le coller dans un secret du depot nomme"
            " RAPIDAPI_PROXY_SECRET_FACTURX, le workflow s'occupe du reste",
        ],
        "verif": [
            "https://facturx.pro-simon-roux.workers.dev/health"
            " doit passer a protected:true apres le prochain deploiement",
        ],
        "rendre": ["le lien public View in Hub"],
        "pourquoi": (
            "Plafond modelise 168 EUR par mois contre 43 pour la premiere API, "
            "parce que la conformite se vend 29 a 299 dollars la ou un utilitaire "
            "se vend 9. L'obligation legale est entree en vigueur le 1er septembre "
            "2026."
        ),
    },
    {
        "id": "fiche_identifiants",
        "strategy": "identifiants_api",
        "titre": "Publier la fiche identifiants",
        "duree": "8 min",
        "done": lambda o: bool(o.get("listing_url")),
        "depend": "secrets_depot",
        "liens": [("Rapid Studio", "https://rapidapi.com/studio")],
        "etapes": [
            "Add API Project, import OpenAPI par fichier",
            "Specification: https://identifiants.pro-simon-roux.workers.dev/openapi.json?download=1",
            "Paliers: Basic 0 USD / 500, Pro 9 USD / 25000, Ultra 29 USD / 250000",
            "Health Check URL: /health",
            "Visibility: public, apres les tarifs",
            "Proxy Secret a coller dans le secret de depot"
            " RAPIDAPI_PROXY_SECRET_IDENTIFIANTS",
        ],
        "verif": [
            "https://identifiants.pro-simon-roux.workers.dev/v1/siret?siret=35600000009075"
            " doit repondre valid:true avec rule:la_poste",
        ],
        "rendre": ["le lien public View in Hub"],
    },
    {
        "id": "fiche_pack",
        "strategy": "pack_calendrier",
        "titre": "Vendre le pack calendrier, versement PayPal immediat",
        "duree": "10 min",
        "done": lambda o: bool(o.get("listing_url")),
        "liens": [("Payhip, versement PayPal instantane", "https://payhip.com/")],
        "etapes": [
            "Creer le compte vendeur et relier le PayPal",
            "Nouveau produit numerique, prix 9 EUR",
            "Televerser le contenu de autopilot/products/pack_calendrier/dist"
            " compresse en un seul fichier zip",
            "Reprendre les textes de la section Textes plus bas",
        ],
        "verif": ["acheter soi-meme une fois pour verifier le telechargement, ou non"],
        "rendre": ["le lien public de la fiche produit"],
    },
]

TEXTES = {
    "fiche_identifiants": {
        "Nom": "French Business Identifiers Validation",
        "Description courte": (
            "Validate French and SEPA business identifiers: IBAN, RIB key, SIREN, "
            "SIRET, EU VAT number and social security number, plus VAT amount "
            "breakdown. Pure computation, no database lookup."
        ),
        "Description longue": (
            "Every French identifier check that is easy to get wrong, in one API.\n\n"
            "- IBAN: checksum and per-country length for 37 SEPA countries\n"
            "- French RIB key: computed or verified, letter conversion table included\n"
            "- SIREN and SIRET with the La Poste exception, whose numbers fail the "
            "Luhn check every naive implementation applies\n"
            "- EU VAT numbers for all 27 member states, with the French key "
            "recomputed and the verification level always stated\n"
            "- French social security number, including Corsican departments 2A and "
            "2B which must be substituted before the checksum\n"
            "- VAT breakdown between net, tax and gross, rounded so the three "
            "amounts always add up\n"
            "- up to 100 validations in a single batch call\n\n"
            "No database, no external source, no upstream rate limit. Every answer "
            "is deterministic and cacheable. This API never claims that a company "
            "or a bank account exists: it validates form, and says so."
        ),
        "Tags": "france, iban, siret, siren, vat, validation, sepa, invoicing, payroll",
    },
    "fiche_facturx": {
        "Nom": "French E-Invoice Compliance Check",
        "Description courte": (
            "Validate a French electronic invoice in CII format, the one embedded "
            "in Factur-X. Mandatory business terms and arithmetic consistency of "
            "totals, with errors reported in plain French."
        ),
        "Description longue": (
            "Receiving electronic invoices became mandatory in France on "
            "1 September 2026 for every VAT-registered business. Issuing them "
            "follows on 1 September 2027 for small and medium companies.\n\n"
            "This API validates the CII XML that Factur-X embeds:\n\n"
            "- well-formedness, with DOCTYPE and external entities rejected "
            "outright, which closes the classic XXE hole in invoice processing\n"
            "- Factur-X profile detection: MINIMUM, BASIC WL, BASIC, EN 16931, "
            "EXTENDED\n"
            "- mandatory business terms: invoice number, issue date, type code, "
            "currency, seller and buyer identification, VAT registration\n"
            "- arithmetic consistency, which is where real invoices fail: sum of "
            "lines against declared line total, taxable base, VAT per rate, grand "
            "total, and amount due after prepayments\n\n"
            "Every finding carries its rule code and a sentence stating which "
            "amount was expected. The exact list of checks performed is published "
            "on /v1/checks: this API does not claim full EN 16931 coverage, and "
            "says so.\n\n"
            "No storage, no database, no external call. An invoice sent here is "
            "parsed in memory and forgotten."
        ),
        "Tags": (
            "facture-electronique, factur-x, e-invoicing, france, cii, en16931, "
            "compliance, invoice-validation, tva"
        ),
    },
    "fiche_pack": {
        "Titre": "Jours feries et jours ouvres France 2026-2035",
        "Description": (
            "Dix ans de calendriers prets a l'emploi, pour les neuf zones "
            "francaises.\n\n"
            "Contenu, pour chaque zone:\n"
            "- un fichier ICS a importer dans Outlook, Google Agenda ou Apple "
            "Calendrier, d'un seul clic\n"
            "- la liste des jours feries en CSV, ouvrable directement dans Excel\n"
            "- le nombre de jours ouvres et de jours ouvrables de chaque mois, de "
            "2026 a 2035\n\n"
            "Les neuf zones: France metropolitaine, Alsace-Moselle avec ses deux "
            "jours supplementaires, et les sept collectivites d'outre-mer avec leur "
            "date propre d'abolition de l'esclavage.\n\n"
            "Les CSV utilisent le point-virgule, ce qu'attend Excel en "
            "configuration francaise: ils s'ouvrent d'un double-clic, sans "
            "assistant d'importation.\n\n"
            "Usage libre au sein de votre organisation, y compris commercial."
        ),
        "Prix": "9 EUR",
    },
}


def _options(cfg: Config, block: dict) -> dict:
    """Le contexte dans lequel un bloc juge s'il est fait: soit les options de
    sa strategie, soit l'etat operationnel du depot."""
    if block.get("state"):
        return dict(cfg.state)
    scfg = cfg.strategies.get(block["strategy"])
    return dict(scfg.options) if scfg else {}


def render(cfg: Config, ctx: Context) -> str:
    faits = []
    restants = []
    for block in BLOCKS:
        (faits if block["done"](_options(cfg, block)) else restants).append(block)

    total = sum(int(b["duree"].split()[0]) for b in restants)
    lines = [
        "# Actions manuelles",
        "",
        f"Genere le {date.today().isoformat()} par `python3 -m autopilot.cli actions`.",
        "Ne pas modifier a la main: ce fichier est reecrit a chaque cycle et les",
        "etapes deja faites en disparaissent.",
        "",
        f"**{len(restants)} action(s), environ {total} minutes en tout.**",
        "Tout peut se faire d'une traite. Aucune carte bancaire nulle part.",
        "",
    ]

    if not restants:
        lines += ["Rien a faire. Tout ce qui demandait une identite verifiee est fait.", ""]

    for index, block in enumerate(restants, start=1):
        lines += [
            f"## {index}. {block['titre']}",
            "",
            f"Duree: {block['duree']}.",
        ]
        if block.get("pourquoi"):
            lines += ["", block["pourquoi"]]
        if block.get("depend"):
            nom = next(b["titre"] for b in BLOCKS if b["id"] == block["depend"])
            lines.append(f"A faire apres: {nom}.")
        lines.append("")
        for label, url in block["liens"]:
            lines.append(f"- {label}: {url}")
        lines += ["", "Etapes:", ""]
        for etape in block["etapes"]:
            lines.append(f"- [ ] {etape}")
        lines += ["", "Verification:", ""]
        for verif in block["verif"]:
            lines.append(f"- {verif}")
        lines += ["", "A me renvoyer: " + ", ".join(block["rendre"]), ""]

        textes = TEXTES.get(block["id"])
        if textes:
            lines += ["Textes a copier tels quels:", ""]
            for champ, valeur in textes.items():
                lines += [f"**{champ}**", "", "```", valeur, "```", ""]

    if faits:
        lines += ["## Deja fait", ""]
        for block in faits:
            lines.append(f"- {block['titre']}")
        lines.append("")

    lines += [
        "## Ce qui tourne deja",
        "",
    ]
    for name, strategy in sorted(registry.discover().items()):
        scfg = cfg.strategies.get(name)
        options = dict(scfg.options) if scfg else {}
        url = options.get("listing_url") or options.get("base_url")
        if url:
            lines.append(f"- {name}: {url}")
    lines.append("")
    return "\n".join(lines)


def write(cfg: Config, ctx: Context) -> Path:
    path = home() / "ACTIONS.md"
    path.write_text(render(cfg, ctx), encoding="utf-8")
    return path
