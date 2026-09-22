# Autopilot

Systeme autonome de generation de revenus, avec un humain dans la boucle
uniquement la ou la loi l'exige.

Zero dependance: Python 3.11 et la bibliotheque standard. Pas de pip install,
pas de build, pas de service externe.

## Demarrage

```bash
cd autopilot
python3 -m autopilot.cli cycle        # un cycle complet, simulation seule
python3 -m autopilot.cli dashboard    # http://127.0.0.1:8765
python3 -m unittest discover -s tests -t tests           # 58 tests

cd products/jours_feries_api && npm test                  # 57 tests, produit
```

Le cycle ecrit un compte-rendu dans `journal/`. C'est le seul fichier a lire
pour savoir ou en est le systeme.

## Les deux modes, et pourquoi ils ne se melangent pas

- `dry_run`: simulation. Aucune sortie reseau, aucune depense, autonomie
  totale. Les ecritures vont au Ledger avec `mode = 'dry_run'`.
- `live`: actions reelles. Chacune passe par `guardrails/gate.py`, qui refuse
  par defaut.

Les deux modes cohabitent dans la meme table mais ne sont jamais additionnes.
Une marge affichee comme reelle est reelle.

## Ce qu'une strategie peut et ne peut pas faire

Une strategie ne connait ni le reseau ni le porte-monnaie. Elle decrit une
`RealAction` et demande l'autorisation. Le gate controle, dans cet ordre:

1. kill switch, fichier `data/KILL` ou etat persistant
2. strategie activee et en mode live
3. liste blanche des plateformes et des APIs, vide par defaut donc tout refuse
4. plafonds de budget: total, journalier, par strategie
5. politique d'approbation

Un cout nul sur une API deja autorisee part sans validation. Tout ce qui coute
de l'argent ou publie vers l'exterieur atterrit dans la file d'approbation et
y reste.

## Le seuil de viabilite

`config/guardrails.toml`, section `[objectif]`. Une strategie dont le modele ne
peut pas atteindre cette marge nette mensuelle n'est pas developpee, et une
strategie existante qui passe dessous est tuee.

Le seuil est compare au **plafond** du modele, c'est-a-dire a ce qu'il donne au
mieux une fois le regime etabli, jamais a un espoir de croissance. Chaque
compte-rendu de cycle indique, pour chaque strategie, ce plafond et le trafic
mensuel qu'il faut pour tenir le seuil.

## Garde-fous

`config/guardrails.toml`. Valeurs de depart: tous les plafonds a zero, listes
blanches vides. Dans cet etat, aucune action reelle ne peut aboutir, quoi que
demande une strategie. Le fichier n'est jamais ecrit par le code.

Kill switch immediat, sans lancer quoi que ce soit:

```bash
touch autopilot/data/KILL
```

## Journal d'audit

`logs/audit.jsonl`, une ligne JSON par evenement: chaque decision du gate,
chaque ecriture au Ledger, chaque validation, chaque cycle. Append-only.

## Ce que le code ne peut pas faire a ta place

Encaisser de l'argent demande une identite verifiee. Aucune plateforme ne
verse sur un PayPal sans nom, adresse et formulaire fiscal du titulaire. Donc:

1. creation des comptes vendeur ou marchand, avec ton identite
2. liaison de ces comptes au PayPal
3. saisie des cles API dans `.env`, une fois

Une fois ces trois choses faites, le systeme tourne sans toi dans les limites
de `guardrails.toml`, et le dashboard te sert de poste d'observation.

## Arborescence

```
config/         garde-fous et strategies activees, edites a la main
autopilot/
  config.py     chargement et validation, objets frozen
  ledger/       SQLite, source de verite des revenus et des couts
  guardrails/   killswitch, allowlist, budget, gate
  approvals/    file d'approbation des actions reelles
  strategies/   un dossier par strategie, manifest.toml obligatoire
  orchestrator/ analyse du Ledger, propositions, compte-rendu
  memory/       ce qui a ete tente, le resultat, la lecon
  dashboard/    serveur local, bibliotheque standard
  audit/        journal append-only
  cli.py
products/       le code vendu, independant du systeme qui le pilote
journal/        un compte-rendu markdown par cycle
data/           bases SQLite, hors git
logs/           audit.jsonl, hors git
tests/          les garde-fous sont testes, un garde-fou qui ne bloque pas est un bug
```

## Etat des phases

- phase 1, squelette: fait. Ledger, garde-fous, `hello_revenue`, boucle validee
  de bout en bout.
- phase 2, dashboard avec marge nette et file d'approbation: fait.
- phase 3, orchestrateur qui lit le Ledger et ecrit des propositions: fait.
- phase 4, vraies strategies une par une, chacune d'abord en dry-run: en cours.
  Premiere strategie reelle: `jours_feries_api`, une API de jours feries et de
  delais en droit francais, produit dans `products/jours_feries_api`. Elle
  tourne en dry-run, et ses deux actions reelles restent refusees tant que les
  plateformes ne sont pas dans la liste blanche.

## Ou regarder si tu ne lis qu'une chose

`journal/` pour le dernier compte-rendu. Sa derniere section liste ce qui
demande une identite verifiee, donc toi, et rien d'autre.
