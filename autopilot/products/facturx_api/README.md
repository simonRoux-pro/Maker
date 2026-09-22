# API de conformite des factures electroniques

Controle une facture au format CII, celui que Factur-X embarque dans son
PDF/A-3. Zero dependance, zero stockage.

```bash
npm test     # 33 tests
npm start    # http://127.0.0.1:8787
```

## Pourquoi maintenant

Depuis le **1er septembre 2026**, toute entreprise etablie en France et
assujettie a la TVA doit pouvoir **recevoir** une facture electronique, sans
exception. L'obligation d'**emettre** touche les grandes entreprises et les
ETI depuis la meme date, et les PME, TPE et micro-entreprises a partir du
**1er septembre 2027**.

Un PDF envoye par courriel n'est pas une facture electronique au sens de la
loi. Il faut un format structure: Factur-X, UBL 2.1 ou CII.

## Ce qui est controle

| Domaine | Detail |
| --- | --- |
| Structure | document bien forme, racine CrossIndustryInvoice |
| Securite | DOCTYPE et entites externes refusees, c'est la faille XXE |
| Profil | MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED |
| Mentions | numero, date, type, devise, vendeur, acheteur, TVA vendeur |
| Arithmetique | BR-CO-10, 13, 14, 15, 16 et 17 |

L'arithmetique est le coeur du produit. Une facture rejetee l'est presque
toujours parce qu'un total ne tombe pas juste: somme des lignes differente du
total declare, TVA incoherente avec son taux, net a payer faux apres deduction
d'un acompte. Chaque anomalie est rendue avec son code de regle et le montant
qui etait attendu.

## Ce qui n'est pas controle, et qui est dit

Le perimetre ne couvre pas l'integralite des regles EN 16931. La liste exacte
des controles exerces est publiee sur `/v1/checks` et rappelee dans chaque
reponse. Le PDF lui-meme n'est pas analyse, seulement le XML qu'il contient.

Annoncer son perimetre est une condition pour qu'un comptable accepte de s'en
servir: un outil qui laisse croire a une conformite totale est un outil dont
on se mefie.

## Detail d'implementation qui compte

L'analyseur XML est ecrit ici, en 150 lignes, plutot qu'emprunte. Raison: il
refuse categoriquement les DOCTYPE, donc les entites externes, alors que la
plupart des analyseurs generalistes les acceptent par defaut. Un service qui
recoit des factures d'inconnus ne peut pas se le permettre.

## Endpoints

```
POST /v1/validate    corps: le XML de la facture, ou {"xml": "..."}
POST /v1/extract     lecture structuree, sans jugement
GET  /v1/checks      liste des controles exerces
GET  /openapi.json   specification, ?download=1 pour la telecharger
```
