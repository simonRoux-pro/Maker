# Actions manuelles

Genere le 2026-09-22 par `python3 -m autopilot.cli actions`.
Ne pas modifier a la main: ce fichier est reecrit a chaque cycle et les
etapes deja faites en disparaissent.

**4 action(s), environ 34 minutes en tout.**
Tout peut se faire d'une traite. Aucune carte bancaire nulle part.

## 1. Coller deux jetons dans les secrets du depot

Duree: 6 min.

Ce seul geste remplace quatre configurations manuelles dans le tableau de bord Cloudflare, et rend tous les deploiements suivants automatiques. Ma machine ne peut pas joindre Cloudflare, mais GitHub Actions le peut.

- Secrets du depot: https://github.com/simonRoux-pro/Maker/settings/secrets/actions
- Creer le jeton Cloudflare, modele Edit Cloudflare Workers: https://dash.cloudflare.com/profile/api-tokens
- Creer le jeton npm, type Automation: https://www.npmjs.com/settings/~/tokens

Etapes:

- [ ] Cloudflare, My Profile, API Tokens, Create Token, modele Edit Cloudflare Workers, copier la valeur
- [ ] Dans les secrets du depot, New repository secret, nom CLOUDFLARE_API_TOKEN, coller la valeur
- [ ] Ajouter aussi CLOUDFLARE_ACCOUNT_ID si le jeton voit plusieurs comptes, l'identifiant est en bas de la page d'accueil Cloudflare
- [ ] npm, Access Tokens, Generate New Token, type Automation
- [ ] Second secret, nom NPM_TOKEN, coller la valeur

Verification:

- onglet Actions du depot, relancer le workflow deploy: https://github.com/simonRoux-pro/Maker/actions/workflows/deploy.yml
- les quatre workers doivent se deployer et repondre sur /health

A me renvoyer: un message: les jetons sont poses

## 2. Publier la fiche facturation electronique, la plus rentable

Duree: 10 min.

Plafond modelise 168 EUR par mois contre 43 pour la premiere API, parce que la conformite se vend 29 a 299 dollars la ou un utilitaire se vend 9. L'obligation legale est entree en vigueur le 1er septembre 2026.
A faire apres: Coller deux jetons dans les secrets du depot.

- Rapid Studio: https://rapidapi.com/studio

Etapes:

- [ ] Add API Project, import OpenAPI par fichier
- [ ] Telecharger d'abord la specification: https://facturx.pro-simon-roux.workers.dev/openapi.json?download=1
- [ ] Categorie: Business
- [ ] Paliers: Basic 0 USD / 100, Pro 29 USD / 5000, Ultra 99 USD / 50000, Mega 299 USD / 500000, Pro marque Recommended
- [ ] Ligne Requests: 100, 5000, 50000, 500000. hard-limit BASIC: 100
- [ ] Health Check URL: /health
- [ ] Visibility: public, apres les tarifs
- [ ] Recuperer le Proxy Secret et le coller dans un secret du depot nomme RAPIDAPI_PROXY_SECRET_FACTURX, le workflow s'occupe du reste

Verification:

- https://facturx.pro-simon-roux.workers.dev/health doit passer a protected:true apres le prochain deploiement

A me renvoyer: le lien public View in Hub

Textes a copier tels quels:

**Nom**

```
French E-Invoice Compliance Check
```

**Description courte**

```
Validate a French electronic invoice in CII format, the one embedded in Factur-X. Mandatory business terms and arithmetic consistency of totals, with errors reported in plain French.
```

**Description longue**

```
Receiving electronic invoices became mandatory in France on 1 September 2026 for every VAT-registered business. Issuing them follows on 1 September 2027 for small and medium companies.

This API validates the CII XML that Factur-X embeds:

- well-formedness, with DOCTYPE and external entities rejected outright, which closes the classic XXE hole in invoice processing
- Factur-X profile detection: MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED
- mandatory business terms: invoice number, issue date, type code, currency, seller and buyer identification, VAT registration
- arithmetic consistency, which is where real invoices fail: sum of lines against declared line total, taxable base, VAT per rate, grand total, and amount due after prepayments

Every finding carries its rule code and a sentence stating which amount was expected. The exact list of checks performed is published on /v1/checks: this API does not claim full EN 16931 coverage, and says so.

No storage, no database, no external call. An invoice sent here is parsed in memory and forgotten.
```

**Tags**

```
facture-electronique, factur-x, e-invoicing, france, cii, en16931, compliance, invoice-validation, tva
```

## 3. Publier la fiche identifiants

Duree: 8 min.
A faire apres: Coller deux jetons dans les secrets du depot.

- Rapid Studio: https://rapidapi.com/studio

Etapes:

- [ ] Add API Project, import OpenAPI par fichier
- [ ] Specification: https://identifiants.pro-simon-roux.workers.dev/openapi.json?download=1
- [ ] Paliers: Basic 0 USD / 500, Pro 9 USD / 25000, Ultra 29 USD / 250000
- [ ] Health Check URL: /health
- [ ] Visibility: public, apres les tarifs
- [ ] Proxy Secret a coller dans le secret de depot RAPIDAPI_PROXY_SECRET_IDENTIFIANTS

Verification:

- https://identifiants.pro-simon-roux.workers.dev/v1/siret?siret=35600000009075 doit repondre valid:true avec rule:la_poste

A me renvoyer: le lien public View in Hub

Textes a copier tels quels:

**Nom**

```
French Business Identifiers Validation
```

**Description courte**

```
Validate French and SEPA business identifiers: IBAN, RIB key, SIREN, SIRET, EU VAT number and social security number, plus VAT amount breakdown. Pure computation, no database lookup.
```

**Description longue**

```
Every French identifier check that is easy to get wrong, in one API.

- IBAN: checksum and per-country length for 37 SEPA countries
- French RIB key: computed or verified, letter conversion table included
- SIREN and SIRET with the La Poste exception, whose numbers fail the Luhn check every naive implementation applies
- EU VAT numbers for all 27 member states, with the French key recomputed and the verification level always stated
- French social security number, including Corsican departments 2A and 2B which must be substituted before the checksum
- VAT breakdown between net, tax and gross, rounded so the three amounts always add up
- up to 100 validations in a single batch call

No database, no external source, no upstream rate limit. Every answer is deterministic and cacheable. This API never claims that a company or a bank account exists: it validates form, and says so.
```

**Tags**

```
france, iban, siret, siren, vat, validation, sepa, invoicing, payroll
```

## 4. Vendre le pack calendrier, versement PayPal immediat

Duree: 10 min.

- Payhip, versement PayPal instantane: https://payhip.com/

Etapes:

- [ ] Creer le compte vendeur et relier le PayPal
- [ ] Nouveau produit numerique, prix 9 EUR
- [ ] Televerser le contenu de autopilot/products/pack_calendrier/dist compresse en un seul fichier zip
- [ ] Reprendre les textes de la section Textes plus bas

Verification:

- acheter soi-meme une fois pour verifier le telechargement, ou non

A me renvoyer: le lien public de la fiche produit

Textes a copier tels quels:

**Titre**

```
Jours feries et jours ouvres France 2026-2035
```

**Description**

```
Dix ans de calendriers prets a l'emploi, pour les neuf zones francaises.

Contenu, pour chaque zone:
- un fichier ICS a importer dans Outlook, Google Agenda ou Apple Calendrier, d'un seul clic
- la liste des jours feries en CSV, ouvrable directement dans Excel
- le nombre de jours ouvres et de jours ouvrables de chaque mois, de 2026 a 2035

Les neuf zones: France metropolitaine, Alsace-Moselle avec ses deux jours supplementaires, et les sept collectivites d'outre-mer avec leur date propre d'abolition de l'esclavage.

Les CSV utilisent le point-virgule, ce qu'attend Excel en configuration francaise: ils s'ouvrent d'un double-clic, sans assistant d'importation.

Usage libre au sein de votre organisation, y compris commercial.
```

**Prix**

```
9 EUR
```

## Ce qui tourne deja

- jours_feries_api: https://rapidapi.com/prosimonroux/api/french-public-holidays-business-days
