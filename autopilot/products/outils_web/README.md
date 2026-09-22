# Site public des outils gratuits

Sept pages qui repondent aux questions que les gens tapent vraiment, avec
l'outil qui calcule en dessous.

```bash
npm test     # 15 tests
npm start    # http://127.0.0.1:8788
```

## Le principe

Chaque page repond d'abord en texte, puis offre l'outil. Une page qui n'est
qu'un formulaire n'a rien a se faire indexer.

Le calcul se fait **entierement dans le navigateur**, avec les memes moteurs
que les APIs vendues. Consequences: aucune donnee ne quitte le poste du
visiteur, aucun appel reseau, aucun cout par visite, et rien a surveiller.
Un IBAN saisi sur la page ne part nulle part.

## Pages

| Adresse | Requete visee |
| --- | --- |
| `/jours-ouvres` | compter ou ajouter des jours ouvres |
| `/delai` | echeance d'un delai, report de l'article 642 |
| `/jours-feries` | jours feries par annee et par zone |
| `/iban` | verifier un IBAN |
| `/siret` | SIREN, SIRET, numero de TVA |
| `/rib` | calculer ou verifier une cle RIB |

## Ce que ce site est

Une brique de distribution, pas un produit. Il ne vend rien et n'aura jamais
de revenu propre. Son role est d'amener du monde vers l'API pour ceux qui
codent, et vers le pack pour ceux qui veulent des fichiers.

C'est le seul levier actionnable sans budget et sans intervention humaine.
Son effet met trois a six mois a se voir, et peut ne jamais venir.

## Verification

Les pages sont pilotees dans un vrai navigateur avant chaque livraison: les
sept outils sont remplis et leurs resultats compares aux valeurs attendues.
Un test en Node ne prouverait pas qu'un module s'execute dans un navigateur.
