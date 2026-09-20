# API jours feries et delais France

Jours feries legaux francais, jours ouvres et ouvrables, arithmetique de dates
et calcul d'echeances avec report au premier jour ouvrable.

Zero dependance, zero stockage, zero donnee personnelle. Pur calcul, donc
aucune dependance a une source externe, aucun rate limit a respecter et aucune
condition d'utilisation d'un tiers a violer. C'est ce qui le rend vendable
sans surveillance.

## Pourquoi ca a une valeur

Les APIs gratuites existantes donnent la liste des jours feries. Elles ne font
pas le reste, qui est justement le travail penible:

- jours ouvres contre jours ouvrables, distinction qui change tout en paie,
  en RH et dans un contrat commercial
- Alsace-Moselle et les sept collectivites d'outre-mer, chacune avec son jour
  d'abolition de l'esclavage
- report d'echeance au premier jour ouvrable suivant, article 642 du code de
  procedure civile
- delai en mois qui expire le meme chiffre de mois, a defaut le dernier jour
  du mois, article 641
- fermetures propres a l'entreprise, qui retirent un jour ouvre sans rallonger
  un delai calendaire
- jusqu'a 100 calculs en un seul appel

## Utilisation

```bash
npm test          # 57 tests, aucune dependance
npm start         # http://127.0.0.1:8787
```

```
GET /v1/holidays?year=2026&zone=alsace-moselle
GET /v1/business-day?date=2026-05-08
GET /v1/add?date=2026-05-06&days=3&calendar=ouvres
GET /v1/count?from=2026-05-01&to=2026-05-31&calendar=ouvres
GET /v1/deadline?from=2026-05-07&delay=14&unit=days&calendar=calendaires
GET /v1/next?date=2026-05-07
GET /v1/zones
POST /v1/batch
GET /openapi.json
```

Exemple, le delai d'un jour a partir du 7 mai 2026 tombe le 8 mai, qui est
ferie, donc l'echeance reelle est le lundi 11 mai:

```json
{
  "raw_deadline": "2026-05-08",
  "deadline": "2026-05-11",
  "rolled": true,
  "rollover_calendar": "ouvres"
}
```

## Perimetre assume

1982 a 2100. Le 8 mai n'est ferie sans interruption que depuis la loi du
2 octobre 1981: avant 1982 le calcul serait faux, donc l'API refuse plutot que
de repondre a cote.

## Deploiement

Cloudflare Workers, plan gratuit, 100 000 requetes par jour, sans carte
bancaire.

Sans aucun outil a installer: `node build.mjs` produit
`dist/worker.bundle.mjs`, un fichier unique de 25 ko a coller dans l'editeur du
tableau de bord Cloudflare. Marche a suivre detaillee, textes de la fiche et
paliers tarifaires dans `DEPLOIEMENT.md`.

Avec la ligne de commande, si elle est deja installee:

```bash
npx wrangler deploy
npx wrangler secret put RAPIDAPI_PROXY_SECRET   # ferme l'acces direct
```

Tant que `RAPIDAPI_PROXY_SECRET` est defini, seules les requetes venant de la
marketplace sont servies. Sans ca, n'importe qui tape l'URL directement et la
facturation ne sert a rien.
