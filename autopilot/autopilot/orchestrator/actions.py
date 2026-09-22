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
        "id": "worker_identifiants",
        "strategy": "identifiants_api",
        "titre": "Deployer l'API identifiants sur Cloudflare",
        "duree": "5 min",
        "done": lambda o: bool(o.get("base_url")),
        "liens": [("Tableau de bord Cloudflare", "https://dash.cloudflare.com")],
        "etapes": [
            "Workers & Pages, Create, Connect GitHub",
            "Nom de l'application: identifiants  (il doit correspondre au wrangler.toml)",
            "Depot: simonRoux-pro/Maker",
            "Branche: claude/autopilot-revenue-system-p8k3o1",
            "Root directory: autopilot/products/identifiants_api",
            "Build command: vide",
            "Deploy command: npx wrangler deploy",
        ],
        "verif": [
            "https://identifiants.pro-simon-roux.workers.dev/health"
            " doit repondre protected:false",
            "https://identifiants.pro-simon-roux.workers.dev/v1/siret?siret=35600000009075"
            " doit repondre valid:true avec rule:la_poste",
        ],
        "rendre": ["l'URL du worker"],
    },
    {
        "id": "worker_outils",
        "strategy": "outils_web",
        "titre": "Deployer le site public des outils gratuits",
        "duree": "5 min",
        "done": lambda o: bool(o.get("base_url")),
        "liens": [("Tableau de bord Cloudflare", "https://dash.cloudflare.com")],
        "etapes": [
            "Workers & Pages, Create, Connect GitHub",
            "Nom de l'application: outils",
            "Depot: simonRoux-pro/Maker",
            "Branche: claude/autopilot-revenue-system-p8k3o1",
            "Root directory: autopilot/products/outils_web",
            "Build command: vide",
            "Deploy command: npx wrangler deploy",
            "Aucun secret, aucune variable: ce site doit rester lisible par tous",
        ],
        "verif": [
            "https://outils.pro-simon-roux.workers.dev/ doit afficher les huit outils",
            "https://outils.pro-simon-roux.workers.dev/sitemap.xml doit lister les pages",
        ],
        "rendre": ["l'URL du site"],
    },
    {
        "id": "fiche_identifiants",
        "strategy": "identifiants_api",
        "titre": "Publier la fiche de l'API identifiants sur la marketplace",
        "duree": "10 min",
        "done": lambda o: bool(o.get("listing_url")),
        "depend": "worker_identifiants",
        "liens": [("Rapid Studio", "https://rapidapi.com/studio")],
        "etapes": [
            "Add API Project, import OpenAPI par fichier",
            "Telecharger d'abord la specification:"
            " https://identifiants.pro-simon-roux.workers.dev/openapi.json?download=1",
            "Reprendre les textes de la section Textes plus bas",
            "Creer les trois paliers: Basic 0 USD / 500, Pro 9 USD / 25000,"
            " Ultra 29 USD / 250000, Pro marque Recommended",
            "Ligne Requests: 500, 25000, 250000. Ligne hard-limit BASIC: 500",
            "Health Check URL: /health",
            "Visibility: public, apres les tarifs",
            "Recuperer le Proxy Secret, le poser en variable de build du worker"
            " identifiants, type Secret, nom RAPIDAPI_PROXY_SECRET",
            "Changer la Deploy command en: echo \"$RAPIDAPI_PROXY_SECRET\" |"
            " npx wrangler secret put RAPIDAPI_PROXY_SECRET && npx wrangler deploy",
            "Relancer le build",
        ],
        "verif": [
            "https://identifiants.pro-simon-roux.workers.dev/health"
            " doit passer a protected:true",
        ],
        "rendre": ["le lien public View in Hub"],
    },
    {
        "id": "npm_token",
        "strategy": "npm_packages",
        "titre": "Creer un compte npm et un jeton de publication",
        "duree": "3 min",
        "done": lambda o: bool(o.get("token_ready")),
        "liens": [
            ("Creer le compte", "https://www.npmjs.com/signup"),
            ("Generer le jeton", "https://www.npmjs.com/settings/~/tokens"),
        ],
        "etapes": [
            "Creer le compte, aucune carte bancaire demandee",
            "Access Tokens, Generate New Token, type Automation",
            "Coller le jeton dans autopilot/.env sous NPM_TOKEN=...",
            "Ce fichier est ignore par git, le jeton ne part jamais dans le depot",
        ],
        "verif": ["rien a verifier, je m'occupe de la publication ensuite"],
        "rendre": ["un simple message: le jeton est en place"],
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


def _options(cfg: Config, strategy: str) -> dict:
    scfg = cfg.strategies.get(strategy)
    return dict(scfg.options) if scfg else {}


def render(cfg: Config, ctx: Context) -> str:
    faits = []
    restants = []
    for block in BLOCKS:
        (faits if block["done"](_options(cfg, block["strategy"])) else restants).append(block)

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
        options = _options(cfg, name)
        url = options.get("listing_url") or options.get("base_url")
        if url:
            lines.append(f"- {name}: {url}")
    lines.append("")
    return "\n".join(lines)


def write(cfg: Config, ctx: Context) -> Path:
    path = home() / "ACTIONS.md"
    path.write_text(render(cfg, ctx), encoding="utf-8")
    return path
