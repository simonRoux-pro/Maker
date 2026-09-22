# jours-ouvres-france

Jours ouvrés, jours ouvrables, jours fériés et calcul d'échéances en droit
français. Zéro dépendance, calcul pur, résultats déterministes.

La plupart des bibliothèques françaises s'arrêtent à la liste des jours
fériés. Celle-ci fait le travail qui vient après : l'arithmétique de dates et
les règles de report qui font qu'une échéance tombe un jour plutôt qu'un
autre.

```bash
npm install jours-ouvres-france
```

## Exemples

```js
import { countDays, addDays, deadline, holidays } from "jours-ouvres-france";

// Combien de jours ouvrés dans cette semaine de mai 2026 ?
countDays("2026-05-11", "2026-05-15").count;
// 4, parce que le jeudi 14 mai est l'Ascension

// Trois jours ouvrés après le mercredi 6 mai 2026
addDays("2026-05-06", 3).result;
// "2026-05-12", le vendredi 8 mai étant férié

// Un délai d'un jour à partir du 7 mai 2026
deadline("2026-05-07", { delay: 1, calendar: "calendaires" });
// { raw_deadline: "2026-05-08", deadline: "2026-05-11", rolled: true }
// Le 8 mai est férié : l'échéance est reportée au lundi, article 642 du CPC

// Jours fériés d'Alsace-Moselle
holidays(2026, "alsace-moselle").length;
// 13, avec le Vendredi saint et la Saint Étienne
```

## Ce que la bibliothèque sait faire

| Fonction | Rôle |
| --- | --- |
| `holidays(year, zone)` | jours fériés légaux, 1982 à 2100 |
| `isBusinessDay(date, opts)` | jour ouvré ou non, avec le motif |
| `addDays(date, n, opts)` | ajouter ou retirer des jours, dans le calendrier choisi |
| `countDays(from, to, opts)` | compter les jours entre deux dates |
| `deadline(from, opts)` | échéance d'un délai, avec report légal |
| `nextBusinessDay` / `previousBusinessDay` | jour ouvré adjacent |

## Les règles implémentées

**Jours ouvrés contre jours ouvrables.** Les premiers vont du lundi au
vendredi, les seconds du lundi au samedi, les jours fériés étant déduits dans
les deux cas. Confondre les deux sur un délai de 30 jours crée un écart d'une
semaine. Passez `calendar: "ouvres"`, `"ouvrables"` ou `"calendaires"`.

**Article 642 du code de procédure civile.** Une échéance qui tombe un samedi,
un dimanche ou un jour férié est reportée au premier jour ouvrable suivant.
Le report ne suit jamais le calendrier du décompte : un délai compté en jours
calendaires se reporte quand même sur un jour ouvré, sinon la règle ne sert à
rien.

**Article 641.** Un délai en mois expire le jour du mois d'arrivée qui porte le
même chiffre, ou le dernier jour de ce mois quand ce chiffre n'existe pas. Un
mois à partir du 31 janvier 2026 échoit donc le 28 février.

**Neuf zones.** Métropole, Alsace-Moselle avec ses deux jours supplémentaires,
et les sept collectivités d'outre-mer avec leur date propre d'abolition de
l'esclavage.

**Fermetures d'entreprise.** L'option `closed` retire des jours ouvrés sans
rallonger un délai calendaire, et décale le report d'échéance.

## Périmètre assumé : 1982 à 2100

Le 8 mai n'est férié sans interruption que depuis la loi du 2 octobre 1981.
Avant 1982, un calcul automatique serait faux, donc la bibliothèque refuse de
répondre plutôt que de se tromper.

## Version hébergée

Si vous ne travaillez pas en JavaScript, ou si vous préférez ne rien héberger,
les mêmes calculs existent en API :
[French Public Holidays & Business Days](https://rapidapi.com/prosimonroux/api/french-public-holidays-business-days).

## Licence

MIT.
