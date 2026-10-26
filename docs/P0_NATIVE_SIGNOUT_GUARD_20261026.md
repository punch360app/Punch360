# P0-C — Sécurité de déconnexion native et restauration hors ligne (2026-10-26)

**Travail proposé, non fusionné.** Branche `fix/p0-native-signout-offline-guard-20261026`, à partir de `main` `2a109fa7dcb4bbb5a87145fc093eef272f23b1d8`.

## Défaut vérifiable dans le code antérieur
Lorsqu'un événement `SIGNED_OUT` se produisait, `forgetLocalIdentity()` supprimait le cache de manière asynchrone. Un `refresh()` déjà planifié pouvait débuter ensuite en mode hors ligne et lire l'ancienne identité et l'espace d'entreprise tant que cet effacement n'était pas terminé. Le compteur de révision protégeait les anciennes requêtes, mais une nouvelle requête planifiée après l'événement pouvait avoir la nouvelle révision. Résultat potentiel : réaffichage temporaire d'un espace hors ligne après déconnexion.

## Correctif ciblé
- Bloquer **synchroniquement** toute restauration hors ligne lors de `SIGNED_OUT`, avant de démarrer la suppression asynchrone du cache.
- Revérifier le drapeau et la génération Auth après chaque lecture asynchrone d'identité et de compagnie; ne pas modifier les journaux de pointage hors ligne ni les données clients.
- Réautoriser la récupération hors ligne uniquement après un nouvel événement Auth non déconnexion.
- Lors du changement de compagnie, confirmer que la réponse Auth serveur appartient toujours à l'identité de la session affichée avant la lecture des appartenances.
- Tests de régression `tests/native-signout-offline-cache.test.mjs` : fonctions pures, ordre des gardes asynchrones et compilation TypeScript. Les tests logiciels ne remplacent pas une recette réelle Android/iPhone.

## P0-A/P0-B — blocage fournisseur distinct
Lecture seule sur l'unique Supabase `mlabstdxxwjdpfaxiwmg` : migration `20261026110100_billing_confirm_intent` non appliquée au moment de l'audit; définitions live `billing_service_save` / `billing_service_resolve_order` sans `submitting`. Voir [issue #35](https://github.com/punch360app/Punch360/issues/35). **Ne pas déployer** le nouveau `essential-billing` avant migration, recette isolée et validation Stripe sandbox.

## Tableau de validation
| Étape | Développé | Testé | Déployé | Intervention externe |
|---|---|---|---|---|
| Garde native SIGNED_OUT et vérification identité | Sur branche | À confirmer par CI sur SHA exact | Non (Expo) | Essai Android/iOS physique |
| Compatibilité Stripe/SQL P0-A | Diagnostic lecture seule | SQL live vérifié sans mutation | Non | Migration revue + Stripe sandbox |

## Reprise exacte
1. Surveiller la PR de cette branche et la CI `PUNCH TypeScript` jusqu'à `completed / success` pour son SHA, lire logs/corriger sinon.
2. Ne pas fusionner sans tests verts et revue; ne pas déclarer la version native publiée par une simple réussite CI.
3. Vérifier le dernier `main`, les autres PR, puis revenir aux P0 restant (Stripe sandbox/SQL, MFA multientreprise, OAuth fournisseur). SMS/Twilio en dernier.
