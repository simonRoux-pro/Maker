# Pack calendrier France 2026-2035

Produit numerique vendu en telechargement: jours feries et jours ouvres des
neuf zones francaises, en ICS et en CSV.

```bash
npm test          # 17 tests
node generate.mjs # -> dist/, 28 fichiers, 317 ko
```

## Contenu

| Dossier | Fichiers | Usage |
| --- | --- | --- |
| `ics/` | 9 | a importer dans Outlook, Google Agenda, Apple Calendrier |
| `csv/` | 9 | liste des jours feries, ouvrable directement dans Excel |
| `mensuel/` | 9 | jours ouvres et ouvrables de chaque mois, de 2026 a 2035 |

Plus `LISEZ-MOI.txt`, qui explique la distinction entre jours ouvres et jours
ouvrables, parce que c'est la source d'erreur la plus courante.

## Choix qui ont une raison

- **Le meme moteur que l'API.** Les regles ne sont ecrites qu'une fois. Si une
  regle change, les deux produits suivent.
- **Point-virgule dans les CSV.** C'est ce qu'attend Excel en configuration
  francaise: le fichier s'ouvre d'un double-clic, sans assistant d'import.
- **Accents retablis.** Le moteur renvoie des noms sans accent, par surete en
  ASCII dans une reponse d'API. Un produit payant doit etre en francais
  correct, donc le generateur les remet.
- **ICS replie a 75 octets.** La RFC 5545 l'exige, et le repli ne coupe jamais
  au milieu d'un caractere accentue.
- **Sortie reproductible.** Deux executions donnent des fichiers identiques,
  ce qui rend le pack verifiable.

## Pourquoi ce produit existe

Une marketplace d'APIs verse environ deux mois apres la transaction. Ici
l'argent arrive sur le PayPal des la vente. Le but est de raccourcir la boucle
de mesure: savoir en jours, pas en trimestres, si quelque chose se vend.
