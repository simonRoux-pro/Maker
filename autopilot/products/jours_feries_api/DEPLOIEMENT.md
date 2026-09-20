# Marche a suivre

Rien a installer. Deux comptes, du copier-coller, environ 20 minutes.

Les libelles exacts des menus peuvent avoir bouge depuis la redaction: cette
machine n'a pas acces a Cloudflare ni a la marketplace pour verifier. L'intention
de chaque etape reste la meme.

## Etape 1, Cloudflare: fait le 20 septembre 2026

L'API est en ligne sur https://maker.pro-simon-roux.workers.dev, palier
gratuit, cout 0 euro. Le deploiement se fait depuis GitHub: chaque push sur la
branche `claude/autopilot-revenue-system-p8k3o1` redeploie tout seul, avec
`autopilot/products/jours_feries_api` comme repertoire racine.

Verification rapide:

```
https://maker.pro-simon-roux.workers.dev/v1/zones
https://maker.pro-simon-roux.workers.dev/v1/deadline?from=2026-05-07&delay=1&calendar=calendaires
```

La marche a suivre d'origine est conservee ci-dessous, au cas ou il faudrait
repartir de zero sur un autre compte.

<details>
<summary>Deploiement manuel, si besoin un jour</summary>

Plan gratuit, sans carte bancaire.

1. Cree le compte sur `dash.cloudflare.com/sign-up`, email et mot de passe.
2. Menu `Compute` ou `Workers & Pages`, puis `Create` et `Create Worker`.
3. Nomme-le `jours-feries-france`, deploie le modele propose sans le lire.
4. Ouvre `Edit code`, selectionne tout le contenu de l'editeur, supprime.
5. Colle l'integralite du fichier `dist/worker.bundle.mjs` de ce dossier.
   Un seul fichier, 25 ko, aucune dependance.
6. `Deploy`.
7. Note l'URL donnee, du type `https://jours-feries-france.TON-SOUS-DOMAINE.workers.dev`.

Verifie tout de suite dans ton navigateur:

```
https://TON-URL/v1/holidays?year=2026
https://TON-URL/v1/deadline?from=2026-05-07&delay=1&calendar=calendaires
```

Le second doit repondre `"deadline": "2026-05-11"`, parce que le 8 mai est
ferie. Si ces deux URLs repondent, le produit est en ligne.

</details>

## Etape 2, le compte fournisseur sur la marketplace

C'est la seule etape qui demande ton identite, et c'est la raison pour laquelle
je ne peux pas la faire: encaisser exige un titulaire verifie.

1. Cree le compte fournisseur sur la marketplace d'APIs.
2. Renseigne identite, adresse et formulaire fiscal.
3. Dans les reglages de versement, choisis PayPal et mets
   `pro.simon.roux@gmail.com`. Les versements ne se font que par PayPal.
4. Ajoute une API, avec comme URL de base:

   ```
   https://maker.pro-simon-roux.workers.dev
   ```

5. Importe la specification, les endpoints et les parametres se remplissent
   tout seuls. Le plus simple est de donner l'URL, sans telecharger de fichier:

   ```
   https://maker.pro-simon-roux.workers.dev/openapi.json
   ```

   Si l'import exige un fichier, prends `dist/openapi.json` de ce dossier.
6. Reprends les textes de la section suivante.
7. Cree les paliers tarifaires de la section suivante.
8. La marketplace te donne un secret de proxy. Retour sur Cloudflare, dans les
   reglages de build du worker, ajoute une variable `RAPIDAPI_PROXY_SECRET`
   de type Secret avec cette valeur, et mets cette commande de deploiement:

   ```
   echo "$RAPIDAPI_PROXY_SECRET" | npx wrangler secret put RAPIDAPI_PROXY_SECRET && npx wrangler deploy
   ```

   Attention au piege: le tableau de bord a deux encadres "Variables and
   secrets", celui du build et celui de l'execution. Une variable de build
   n'existe que pendant la construction et le worker ne la voit pas. La
   commande ci-dessus recopie l'une dans l'autre a chaque deploiement, ce qui
   evite d'avoir a choisir le bon encadre.

   Verification: `/health` renvoie `protected: true` une fois le secret actif.

Cette derniere etape n'est pas un detail: sans elle, n'importe qui appelle
l'URL du worker directement et la facturation ne sert a rien.

## Textes de la fiche, a copier tel quel

La marketplace est anglophone, donc la fiche est en anglais.

**Nom**

```
French Public Holidays & Business Days
```

**Description courte**

```
French public holidays, business days and legal deadline calculation. Covers
mainland France, Alsace-Moselle and all overseas territories, 1982 to 2100.
```

**Description longue**

```
Every French date calculation that is annoying to do by hand, in one API.

- Legal public holidays for any year from 1982 to 2100
- Mainland France, Alsace-Moselle (Good Friday and Saint Stephen's Day) and the
  seven overseas territories, each with its own Abolition of Slavery day
- jours ouvres (Mon-Fri) vs jours ouvrables (Mon-Sat), the distinction that
  matters in French payroll, HR and commercial contracts
- Deadline calculation with rollover to the next business day, as required by
  article 642 of the French code of civil procedure
- Month-based deadlines following article 641: same day number in the target
  month, or the last day of that month when it does not exist
- Your own company closing days, which remove a working day without extending a
  calendar-day deadline
- Up to 100 calculations in a single batch call

No external data source, no scraping, no upstream rate limit. Pure computation,
so every answer is deterministic and cacheable.
```

**Categorie**: Data, ou Tools

**Tags**

```
france, holidays, business-days, dates, deadlines, payroll, hr, legal, calendar
```

**Exemple a mettre en avant**

```
GET /v1/deadline?from=2026-05-07&delay=1&calendar=calendaires

{
  "raw_deadline": "2026-05-08",
  "deadline": "2026-05-11",
  "rolled": true,
  "rollover_calendar": "ouvres"
}
```

Une echeance d'un jour a partir du 7 mai 2026 tombe le 8 mai, qui est ferie,
donc l'echeance reelle est le lundi 11 mai. C'est exactement le calcul que les
APIs gratuites de jours feries ne font pas.

## Paliers tarifaires

| Palier | Prix par mois | Quota mensuel | Pourquoi |
| --- | --- | --- | --- |
| Basic | gratuit | 500 appels | de quoi tester et integrer sans s'engager |
| Pro | 9 dollars | 20 000 appels | une application en production |
| Ultra | 29 dollars | 200 000 appels | traitement par lots, plusieurs clients |

Le palier gratuit n'est pas de la generosite: sur une marketplace, une API sans
palier gratuit n'est jamais essayee, donc jamais achetee.

## Ce qui se passe ensuite

- La marketplace prend 25 pourcent, et les frais de versement PayPal environ
  2 pourcent.
- Les transactions d'un mois sont versees debut du mois suivant le suivant.
  Le premier euro arrivera donc environ deux mois apres la premiere vente.
- L'hebergement reste a zero euro jusqu'a 100 000 appels par jour, donc il n'y
  a pas de point mort a atteindre.
