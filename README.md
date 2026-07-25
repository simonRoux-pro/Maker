# Maker

Assistant personnel mobile (React Native / Expo) pour organiser un projet
d'engagement personnel sur la durée : un parcours en étapes, un carnet de
contacts, une bibliothèque de repères stratégiques, et un coach qui envoie
des rappels réguliers.

Toutes les données restent en local sur l'appareil (`AsyncStorage`). Rien
n'est synchronisé vers un serveur par défaut.

## Stack

- Expo (SDK 57) + React Native + TypeScript
- `expo-router` pour la navigation (fichiers sous `app/`)
- `expo-notifications`, `expo-calendar`, `expo-contacts` pour les
  intégrations natives, chacune activée via une permission explicite
- `@react-native-async-storage/async-storage` pour la persistance locale

## Structure

```
app/
  onboarding/        bienvenue, profil, permissions
  (tabs)/            5 onglets : parcours, réseau, stratégies, coach, profil
  milestone/[id]     détail d'une étape du parcours
  strategie/[id]     détail d'un article
  contact/[id], new  fiche contact
lib/
  data/              contenu (parcours, articles, catégories, messages)
  context/           état global (AppStateContext) + persistance
  components/        composants UI partagés
  notifications.ts   planification des rappels locaux
  calendar.ts         création d'évènements dans l'agenda du téléphone
server/              stub optionnel pour relayer des webhooks externes
                     vers des notifications push (non déployé, voir
                     server/README.md)
```

## Démarrer

```bash
npm install
npm run start      # puis suivre les instructions Expo (web / iOS / Android)
```

## Permissions

Chaque permission (notifications, agenda, contacts) est demandée
explicitement, avec un texte expliquant son usage, et reste désactivable à
tout moment depuis l'onglet Profil. Aucune donnée n'est envoyée à un tiers.

## Choix volontairement non faits ici

- Pas de scraping automatisé de données personnelles de tiers : le carnet de
  contacts est rempli manuellement, à la main.
- Pas d'intégration email/agenda tiers via OAuth (Gmail, Outlook...) : ces
  intégrations demandent des identifiants d'API à configurer par toi-même,
  volontairement laissées de côté dans ce scaffold initial.
- Le stub `server/` n'est ni déployé ni connecté par défaut.

## Prochaines étapes possibles

- Widget écran de verrouillage / accueil (nécessite du code natif dédié :
  WidgetKit sur iOS, App Widgets sur Android — hors du périmètre Expo géré
  standard, à envisager via un dev client).
- Rappels de suivi automatiques par contact (relance à date fixe).
- Export/sauvegarde chiffrée des données locales.
