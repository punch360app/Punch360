# Essentiel Pro — postes exclusifs et affectation des quarts

## Fonction livrée sur la branche de développement

Un **poste exclusif** désigne une place de travail concrète (ex. Caisse 1, Réception A, Station 2) pour laquelle **un seul quart actif peut être affecté pendant un même intervalle**. Cette règle est différente de la « couverture minimale par qualification » déjà développée et ne la remplace pas.

- Un gestionnaire Essentiel Pro crée un poste associé à un établissement, avec département et certificat requis facultatifs. Le nom est unique parmi les postes actifs d'un établissement.
- Dans Planification, un gestionnaire peut attribuer ou retirer un poste à un quart existant. Les quarts sans poste restent valides et fonctionnent comme avant.
- Le contrôle se fait côté Supabase, y compris lors des changements directs de période/établissement/salarié sur un quart. Un verrou transactionnel par poste empêche deux affectations simultanées en concurrence.
- Dates avec intervalles demi-ouverts : 08:00–12:00 puis 12:00–16:00 peuvent occuper le même poste; 08:00–12:00 et 11:00–15:00 ne le peuvent pas.
- Les certificats exigés doivent être valides pendant toute la période locale du quart. Le refus n'altère pas le quart.
- Changement/désactivation d'un poste ayant des quarts futurs actifs est refusé tant qu'ils ne sont pas désaffectés.
- Seuls les comptes autorisés Essentiel Pro peuvent modifier; validation de compagnie, établissement, département, versions, motif et audit. Les employés et les forfaits Essentiel/Plus ne reçoivent aucun droit nouveau.
- PUNCH Construction et les historiques sans poste restent inchangés.

## Sources

- Migration : `supabase/migrations/20261025223000_essential_exclusive_positions.sql` (numéro à aligner après application Supabase).
- SQL : `supabase/tests/essential_exclusive_positions.sql`, scénario transactionnel synthétique rollback (poste créé, certificat, premier quart, double réservation refusée, second poste indépendant, version, refus salarié, désactivation bloquée).
- Web : `web/live/planning.js`, création en Organisation et attribution dans Horaire.
- DOM : `tests/exclusive-positions-ui.test.mjs`, visibilité Pro, absence Plus, envoi de version attendue et motif.

## Limites restant à couvrir

- Recette authentifiée Web et **Expo mobile** pour l'affectation de postes; non considérée terminée par des tests unitaires.
- Cas administratifs de suppression/révocation d'un certificat alors qu'un quart futur y dépend et notification responsable, catalogue de poste partagé multi-établissements, mutations de disponibilité.
- Les périodes et heures de travail sont toujours gérées par les RPC de planning existantes.
- Continuer le prompt original **Validation SQL archives**. Ne pas commencer le prompt maître séparé de 453 exigences.
