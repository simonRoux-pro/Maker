"""Site public d'outils gratuits: la brique de distribution.

Elle ne vend rien. Son role est de capter les recherches reelles, de rendre
service tout de suite, puis de renvoyer vers l'API pour ceux qui codent et
vers le pack pour ceux qui veulent des fichiers.

Elle n'ecrit donc aucun revenu au Ledger. Lui en attribuer serait inventer un
chiffre: l'argent, s'il vient, sera enregistre sur les strategies qui vendent.
Son effet se mesure indirectement, par le trafic des fiches.

C'est aussi le seul levier actionnable sans budget et sans intervention
humaine, ce qui est exactement pourquoi elle existe.
"""

from __future__ import annotations

from pathlib import Path

from ...approvals.action import RealAction
from ..base import Context, Plan, RunResult, Step, Strategy
from ..manifest import Manifest

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/outils_web"

PAGES = [
    ("/jours-ouvres", "jours ouvrés entre deux dates"),
    ("/delai", "échéance d'un délai, report article 642"),
    ("/jours-feries", "jours fériés par année et par zone"),
    ("/iban", "vérification d'IBAN"),
    ("/siret", "SIREN, SIRET et TVA"),
    ("/rib", "clé RIB"),
]


class OutilsWeb(Strategy):
    manifest = MANIFEST

    def _options(self, ctx: Context) -> dict:
        scfg = ctx.cfg.strategies.get(self.name)
        return dict(scfg.options) if scfg else {}

    def deployed(self, ctx: Context) -> str | None:
        return self._options(ctx).get("base_url") or None

    def operator_tasks(self, ctx: Context) -> list[str]:
        return [] if self.deployed(ctx) else list(self.manifest.needs_operator)

    def plan(self, ctx: Context) -> Plan:
        base_url = self.deployed(ctx)
        steps = []
        if base_url:
            steps.append(Step("site en ligne", note=base_url))
        else:
            steps.append(
                Step(
                    "deployer le site sur Cloudflare, plan gratuit",
                    external=True,
                    note="un worker de plus, aucun compte a creer",
                )
            )
        steps += [
            Step(f"page {path}", note=sujet) for path, sujet in PAGES
        ]
        steps.append(
            Step(
                "mesurer le trafic entrant",
                note="c'est le seul chiffre qui dira si ce levier fonctionne",
            )
        )
        return Plan(
            strategy=self.name,
            steps=steps,
            estimated_cost=0.0,
            estimated_revenue=0.0,
            notes=[
                f"{len(PAGES)} outils plus une page d'accueil, dans {PRODUCT_DIR}",
                "aucun revenu propre: l'effet se lit sur les autres strategies",
                "trois a six mois avant qu'un moteur de recherche envoie du monde",
                "peut ne jamais decoller, c'est le pari assume de ce cycle",
            ],
        )

    def dry_run(self, ctx: Context) -> RunResult:
        """N'ecrit rien au Ledger. Un site qui ne vend pas n'a ni revenu ni
        cout a simuler, et inventer un chiffre fausserait la marge."""
        result = RunResult(strategy=self.name, mode="dry_run")
        result.notes += [
            "aucune ecriture: cette brique n'a pas de revenu propre",
            f"hebergement 0 EUR, {len(PAGES) + 1} pages servies depuis un seul worker",
        ]
        return result

    def execute(self, ctx: Context) -> RunResult:
        result = RunResult(strategy=self.name, mode="live")
        if self.deployed(ctx):
            result.notes.append("site en ligne, rien a publier")
            return result

        action = RealAction(
            strategy=self.name,
            kind="publish",
            summary="deployer le site public des outils gratuits",
            api="cloudflare-workers",
            estimated_cost=0.0,
            risk="low",
            payload={
                "repertoire_racine": PRODUCT_DIR,
                "nom_du_worker": "outils",
                "commande_de_deploiement": "npx wrangler deploy",
                "sans_secret": "ce site doit rester lisible par tout le monde",
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
        lines = [f"{self.name}: {self.manifest.summary}"]
        lines.append(f"  site: {self.deployed(ctx) or 'pas encore deploye'}")
        lines.append(f"  {len(PAGES)} outils, aucun revenu propre par construction")
        for need in self.operator_tasks(ctx):
            lines.append(f"  demande Simon: {need}")
        return "\n".join(lines)


STRATEGY = OutilsWeb

__all__ = ["STRATEGY", "OutilsWeb", "PAGES"]
