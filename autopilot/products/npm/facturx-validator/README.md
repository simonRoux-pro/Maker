# facturx-validator

Valider une facture électronique française au format CII, celui que Factur-X
embarque dans son PDF/A-3.

Zéro dépendance. L'analyseur XML est écrit dans le paquet, en 150 lignes,
parce qu'il **refuse catégoriquement les DOCTYPE** et donc les entités
externes. C'est la faille XXE, la plus classique sur un service qui reçoit des
documents de tiers, et la plupart des analyseurs généralistes l'acceptent par
défaut.

```bash
npm install facturx-validator
```

## Pourquoi maintenant

Depuis le **1er septembre 2026**, toute entreprise établie en France et
assujettie à la TVA doit pouvoir **recevoir** une facture électronique.
L'obligation d'**émettre** touche les grandes entreprises et les ETI depuis la
même date, et les PME, TPE et micro-entreprises à partir du **1er septembre
2027**.

Un PDF envoyé par courriel n'est pas une facture électronique au sens de la
loi. Il faut un format structuré : Factur-X, UBL 2.1 ou CII.

## Utilisation

```js
import { validate, extract } from "facturx-validator";

const resultat = validate(xmlDeLaFacture);

resultat.valid;      // true ou false
resultat.profile;    // "MINIMUM", "BASIC WL", "BASIC", "EN 16931", "EXTENDED"
resultat.errors;     // [{ code: "BR-CO-15", level: "erreur", message: "..." }]
resultat.warnings;
resultat.invoice;    // numéro, date, vendeur, acheteur, totaux
```

Chaque anomalie porte son code de règle et une phrase en français qui dit
quel montant était attendu :

```
BR-CO-15  total toutes taxes attendu 1200.00, declare 999.00
BR-CO-16  net a payer attendu 1200.00, declare 1000.00
BR-CO-17  TVA a 10 pourcent: attendue 100.00 sur une base de 1000.00, declaree 200.00
```

`extract(xml)` lit la facture sans la juger, et renvoie ses données
structurées.

## Ce qui est contrôlé

| Domaine | Détail |
| --- | --- |
| Structure | document bien formé, racine `CrossIndustryInvoice` |
| Sécurité | DOCTYPE et entités externes refusées |
| Profil | les cinq profils Factur-X, lus dans le dernier segment de l'URN |
| Mentions | numéro, date, type, devise, vendeur, acheteur, TVA vendeur |
| Arithmétique | BR-CO-10, 13, 14, 15, 16 et 17 |

L'arithmétique est le cœur. Une facture rejetée l'est presque toujours parce
qu'un total ne tombe pas juste : somme des lignes différente du total déclaré,
TVA incohérente avec son taux, net à payer faux après déduction d'un acompte.

## Ce qui n'est pas contrôlé, et qui est dit

Le périmètre ne couvre pas l'intégralité des règles EN 16931.
`checksPerformed()` renvoie la liste exacte des contrôles exercés, et chaque
résultat rappelle ce périmètre dans son champ `scope`.

Annoncer ses limites est une condition pour qu'un comptable accepte de s'en
servir : un outil qui laisse croire à une conformité totale est un outil dont
on se méfie.

Le PDF lui-même n'est pas analysé, seulement le XML qu'il contient.

## Un détail qui compte

Le profil Factur-X se lit dans le **dernier segment** de l'URN, après le
dernier dièse. Chercher le nom du profil dans l'URN entière fait prendre
EN 16931 pour tout le monde, puisque toutes les URN commencent par
`urn:cen.eu:en16931:2017`.

## Licence

MIT.
