# Serveur webhook (optionnel)

Stub minimal, à héberger toi-même (Render, Fly.io, Raspberry Pi, etc.), si tu
veux recevoir des alertes externes (actualité locale, IFTTT, Zapier...) et les
transformer en notification push vers l'app.

Ce serveur **n'est pas déployé** et l'app ne s'y connecte pas par défaut. Le
champ "Webhook personnel" dans l'onglet Profil de l'app est un simple champ de
configuration côté client, désactivé tant que tu ne l'actives pas
explicitement.

## Fonctionnement prévu

1. Un service externe (ex. une alerte Google, un flux RSS via IFTTT) envoie
   un `POST /webhook` avec un payload `{ "title": "...", "body": "..." }`.
2. Le serveur relaie ce message vers l'API Expo Push
   (`https://exp.host/--/api/v2/push/send`) en utilisant le push token de
   l'appareil, obtenu via `expo-notifications` côté app (à implémenter :
   `Notifications.getExpoPushTokenAsync()` puis stockage du token ici).
3. L'app reçoit la notification push comme n'importe quelle notification.

## Démarrer en local

```bash
cd server
npm install
node index.js
```

Le serveur écoute par défaut sur `PORT=8787`.

## À faire avant un usage réel

- Ajouter une authentification sur `/webhook` (le stub actuel n'en a pas).
- Stocker le(s) push token(s) de manière sécurisée (ce stub les garde en
  mémoire uniquement, pour la démo).
- Valider strictement le payload entrant (source fiable).
