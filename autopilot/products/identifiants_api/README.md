# API validation des identifiants France et SEPA

IBAN, cle RIB francaise, SIREN, SIRET et TVA intracommunautaire.

Zero dependance, zero stockage, zero donnee conservee. Un IBAN qui passe par
cette API n'est ecrit nulle part: pur calcul, en memoire, puis oubli.

## Ce que cette API ne fait pas

Elle ne dit jamais si une entreprise ou un compte bancaire existe. Elle verifie
qu'un identifiant est formellement correct, par calcul de cle. C'est repete
dans la fiche, dans la racine de l'API et dans `/v1/reference`, parce que c'est
la seule confusion possible sur ce produit.

## Ce qu'elle fait exactement

| Endpoint | Verification |
| --- | --- |
| `/v1/iban` | mod 97 et longueur par pays, 37 pays de la zone SEPA |
| `/v1/rib` | cle RIB francaise, calcul ou verification, lettres converties |
| `/v1/siren` | cle de Luhn sur 9 chiffres |
| `/v1/siret` | cle de Luhn sur 14 chiffres, exception La Poste geree |
| `/v1/vat` | cle recalculee pour la France, forme seule pour les 26 autres |
| `/v1/vat-from-siren` | calcul du numero de TVA francais |
| `/v1/reference` | pays couverts et niveau de verification de chacun |
| `/v1/batch` | jusqu'a 100 validations en un appel |

Le champ `checked` de la reponse dit toujours ce qui a ete verifie:
`checksum` quand la cle a ete recalculee, `format` quand seule la forme a ete
controlee. Aucune ambiguite laissee a l'appelant.

## Les details qui coutent cher a refaire soi-meme

- La Poste echappe a Luhn: ses SIRET sont valides si la somme de leurs chiffres
  est un multiple de 5. Une implementation naive les rejette tous.
- La cle RIB convertit les lettres du numero de compte par une table officielle
  ou S vaut 2 et non 1, contrairement a ce que la logique alphabetique
  suggererait.
- Un pays absent de la table des longueurs IBAN est refuse explicitement, au
  lieu d'etre valide par defaut.
- Les anciens numeros de TVA a cle alphabetique ne se recalculent pas, et
  l'API le dit au lieu de les declarer faux.

## Utilisation

```bash
npm test          # 38 tests, aucune dependance
npm start         # http://127.0.0.1:8787
```

```
GET /v1/iban?iban=FR1420041010050500013M02606
GET /v1/rib?bank=20041&branch=01005&account=0500013M026
GET /v1/siren?siren=732829320
GET /v1/siret?siret=35600000009075
GET /v1/vat?vat=FR44732829320
```

## Deploiement

Identique a l'autre produit: Cloudflare Workers, palier gratuit. Soit la
connexion GitHub avec `autopilot/products/identifiants_api` comme repertoire
racine, soit `dist/worker.bundle.mjs` colle dans l'editeur.
