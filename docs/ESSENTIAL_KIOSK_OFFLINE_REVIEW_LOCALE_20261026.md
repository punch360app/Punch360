# PUNCH Essentiel — réconciliation hors ligne multilingue Boss/Admin

**26 octobre 2026 — poursuite du prompt original « Validation SQL archives ».**

## Code

Le module existant `web/live/kiosk-offline-review.js` réutilise le dictionnaire et la langue personnelle Essentiel. La langue active vient de `app.js` → `createEssentialController` → `createOfflineReviewController`; aucune préférence ni table supplémentaire.

Les 20 clés de `essential-locale.js` sont maintenant disponibles dans les dix langues pour : titre, conseils de réconciliation, champ du motif, actualiser, accepter/refuser, états et événements d'entrée/sortie/pauses, borne sans observations, limites d'affichage et messages d'erreur. Les heures affichées utilisent la localisation active; elles sont isolées par `<bdi dir="ltr">` pour la lecture sûre en arabe RTL.

La confirmation exige toujours un **motif de 3 caractères minimum**, puis la décision est adressée à l'unique RPC `review_kiosk_offline`. L'identité du groupe et son identifiant sont échappés. Les erreurs SQL ou Edge brutes restent cachées derrière des messages sûrs : impossible de charger, décision non enregistrée et motif requis. Le serveur conserve seul l'autorité sur les droits, la synchronisation et les heures officielles.

## Tests

`tests/kiosk-offline-review-locale.test.mjs` couvre : inventaire dix langues × vingt clés, traduction en direct EN/AR et dates numériques LTR, échappement des données de salariés et de notes, refus sans motif avant RPC, approbation envoyée à la RPC avec motif, et absence d'exposition des diagnostics serveur.

Ce code **ne modifie pas** le schéma Supabase, les rôles, les archives, le pointage, la paie, les politiques de pause ni Construction. PWA : `app.js?v=essential-45`, cache `punch-360-essential-v40` et pré-cache du dictionnaire personnel.

**État :** développé sur branche, CI/fusion/Pages à consigner après résultat. QA linguistique par locuteurs natifs, recette sur appareils et consultation réaliste de gestionnaire nécessaires avant de déclarer tous les écrans spécialistes traduits.

## Toujours ouvert

Plusieurs libellés autour de l'écran de borne du Boss restent en français : appairage, révocation, configuration. Les autres modules métiers (RH, paie, Super Admin) restent partiellement en français. Le prompt original attend également archives binaires authentifiées, Stripe sandbox, OAuth/SMTP, tests concurrents et restauration d'infrastructure. SMS/Twilio demeure l'étape finale. Le prompt maître reste séparé.
