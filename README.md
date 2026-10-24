# PUNCH 360°

> **Nouveau collaborateur ou ChatGPT Work ? Commence par [le guide de démarrage officiel](docs/README_COLLABORATEUR_WORK.md).** Il regroupe les accès GitHub/Supabase, les deux éditions, les fichiers importants, le travail déjà effectué, les tâches restantes et le processus de branche/PR. Vérifier le code et les documents récents avant de réutiliser les indications historiques ci-dessous.

Plateforme de gestion du temps et des équipes avec **PUNCH Essentiel** (établissements) et **PUNCH Construction** (chantiers), supervisées par un Super Admin commun.

**État : prototype Expo / React Native, non prêt à être utilisé pour les heures officielles.**

Ce dépôt est le dépôt officiel PUNCH 360°.

## Développement actif — noyau PUNCH connecté

La base **Supabase PUNCH** a maintenant ses tables réelles, règles RLS, fonctions de pointage serveur, équipes et conversations. L’application Expo utilise l’authentification Supabase et les données de compagnie : **les heures enregistrées par RPC sont des événements serveur**, mais le produit n’a pas encore passé de tests terrain ni de tests de paie. Ne pas utiliser pour la paie officielle.

Fonctions connectées : comptes, compagnies, jobs, punchs avec contrôle GPS, journal hors ligne et synchronisation idempotente, corrections approuvées, fermeture des semaines, exports CSV, horaires, congés, suivi des commandes, PDF privés et lecture, invitations par lien, équipes et messagerie. Plusieurs modules restent incomplets; Google/Apple et Stripe nécessitent encore une configuration.

Consulte **[l’état précis par fonctionnalité](docs/IMPLEMENTATION_STATUS.md)** avant de tester. La base est hébergée actuellement dans la région AWS US East; évaluer les exigences québécoises de protection des données avant de traiter des informations personnelles réelles.

## Deux éditions
- **PUNCH Essentiel** : bureau/manufacture/commerce, interface claire vert sauge, Punch/Heures/Horaire/Plus, sans commande ni numéro de job. Forfaits décidés : **19/39/69 CAD/mois**, cinq membres compris, +3/+4/+5 CAD par personne supplémentaire; annuel −15 %; bornes 1/3/illimitées.
- **PUNCH Construction** : gestion des chantiers et du matériel, avec ses **tarifs propres** et sans reprise des prix Essentiel.
- **État commercial :** intégration Web/Expo et fonctions Stripe développées en partie; configuration et recette fournisseur encore à valider. Voir [le suivi facturation et borne](docs/ESSENTIAL_BILLING_20261024.md).

## Accès aux nouveaux modules
- **Web** : https://punch360app.github.io/Punch360/
- **Admin → Plus → Rayon de punch et validation GPS** : coordonnées et rayon maximal par job, punchs à valider.
- **Notifications** : cloche dans l’entête Web et Expo.
- **Sans réseau** : entrée, sortie et transfert conservés sur l’appareil; synchronisation au retour du réseau, application ouverte ou réouverte. Première connexion nécessaire pour charger les jobs. Les heures hors ligne attendent une validation.
- **Plus** : approbations, fermeture, export, horaires, documents et invitations.
- La navigation reste **Accueil · Mes heures · Commande · Message · Plus**.

## Démarrage local
```sh
npm install
npx expo start
```

## Backend PUNCH
Supabase dédié : `mlabstdxxwjdpfaxiwmg` (`https://mlabstdxxwjdpfaxiwmg.supabase.co`). Les migrations du dépôt ont été exécutées sur le projet PUNCH; le moteur doit encore être validé sur les appareils et en conditions terrain. Les clés privées et secrets ne doivent jamais être publiés.

Voir `docs/SPEC_COMPLETE.md`, `docs/JOBS.md`, `docs/BILLING.md`.
