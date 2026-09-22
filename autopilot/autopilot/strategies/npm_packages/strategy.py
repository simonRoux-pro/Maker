"""Publication de bibliotheques gratuites sur npm.

Pourquoi donner le moteur alors qu'on vend l'API: ce ne sont pas les memes
acheteurs. Une bibliotheque sert un developpeur JavaScript qui heberge son
code lui-meme. L'API sert ceux qui travaillent en Python, en PHP, ou dans un
outil sans code, et ceux qui ne veulent rien maintenir. Le paquet gratuit
apporte ce qui manque vraiment: de la visibilite, un referencement durable et
un lien vers la version hebergee.

C'est aussi le seul canal de distribution que cette machine peut actionner
seule: le registre npm est joignable, contrairement a Cloudflare et a la
marketplace d'APIs.
"""

from __future__ import annotations

from pathlib import Path

from ...approvals.action import RealAction
from ..base import Context, Plan, RunResult, Step, Strategy
from ..manifest import Manifest

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/npm"

PACKAGES = [
    {
        "name": "jours-ouvres-france",
        "version": "1.0.0",
        "cible": "jours ouvrés, délais, article 642",
        "note": "le paquet jours-feries-france existe deja et ne fait que les feries",
    },
    {
        "name": "identifiants-france",
        "version": "1.0.0",
        "cible": "IBAN, RIB, SIREN, SIRET, TVA",
        "note": "nom libre au moment de la verification",
    },
]


class NpmPackages(Strategy):
    manifest = MANIFEST

    def _options(self, ctx: Context) -> dict:
        scfg = ctx.cfg.strategies.get(self.name)
        return dict(scfg.options) if scfg else {}

    def published(self, ctx: Context) -> list[str]:
        raw = self._options(ctx).get("published", "")
        return [name.strip() for name in str(raw).split(",") if name.strip()]

    def pending(self, ctx: Context) -> list[dict]:
        done = set(self.published(ctx))
        return [p for p in PACKAGES if p["name"] not in done]

    def operator_tasks(self, ctx: Context) -> list[str]:
        if self._options(ctx).get("token_ready"):
            return []
        return list(self.manifest.needs_operator)

    def plan(self, ctx: Context) -> Plan:
        steps = []
        for pkg in PACKAGES:
            deja = pkg["name"] in self.published(ctx)
            steps.append(
                Step(
                    f"{pkg['name']} {pkg['version']}",
                    external=not deja,
                    note="publie" if deja else f"a publier, cible {pkg['cible']}",
                )
            )
        steps.append(
            Step(
                "suivre les telechargements chaque cycle",
                note="un paquet telecharge est un lien de plus vers l'API",
            )
        )
        return Plan(
            strategy=self.name,
            steps=steps,
            estimated_cost=0.0,
            estimated_revenue=0.0,
            notes=[
                f"paquets assembles dans {PRODUCT_DIR}, moteur copie, pas reecrit",
                "gratuits par construction: ils vendent la version hebergee, pas eux-memes",
                "npm est le seul canal que cette machine peut actionner elle-meme",
            ],
        )

    def dry_run(self, ctx: Context) -> RunResult:
        result = RunResult(strategy=self.name, mode="dry_run")
        restants = self.pending(ctx)
        result.notes += [
            "aucune ecriture: une bibliotheque gratuite n'a pas de revenu propre",
            f"{len(PACKAGES) - len(restants)} paquet(s) publie(s) sur {len(PACKAGES)}",
        ]
        return result

    def execute(self, ctx: Context) -> RunResult:
        result = RunResult(strategy=self.name, mode="live")
        restants = self.pending(ctx)
        if not restants:
            result.notes.append("les deux paquets sont publies, rien a faire")
            return result

        for pkg in restants:
            action = RealAction(
                strategy=self.name,
                kind="publish",
                summary=f"publier {pkg['name']} {pkg['version']} sur npm",
                platform="npm",
                estimated_cost=0.0,
                risk="medium",
                payload={
                    "dossier": f"{PRODUCT_DIR}/{pkg['name']}",
                    "commande": "npm publish --access public",
                    "jeton": "lu depuis NPM_TOKEN, jamais ecrit dans le depot",
                    "irreversible": "une version publiee ne se retire pas apres 72 heures",
                },
            )
            decision = self.request(ctx, action)
            if decision.allowed:
                result.actions_taken.append(action.describe())
            else:
                result.actions_blocked.append(f"{action.describe()} refuse: {decision.reason}")
                if decision.queued and decision.approval_id:
                    result.pending_approvals.append(decision.approval_id)
        return result

    def report(self, ctx: Context) -> str:
        publies = self.published(ctx)
        lines = [f"{self.name}: {self.manifest.summary}"]
        for pkg in PACKAGES:
            etat = "publie" if pkg["name"] in publies else "en attente"
            lines.append(f"  {pkg['name']} {pkg['version']}: {etat}")
        for need in self.operator_tasks(ctx):
            lines.append(f"  demande Simon: {need}")
        return "\n".join(lines)


STRATEGY = NpmPackages

__all__ = ["STRATEGY", "NpmPackages", "PACKAGES"]
