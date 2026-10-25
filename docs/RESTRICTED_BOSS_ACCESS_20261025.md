# Reprise « Validation SQL archives » — accès Boss en restriction (25 octobre 2026)

## Contexte vérifié
- Dépôt `punch360app/Punch360`, base `main` après fusion de l'annuaire d'abonnements (`13d2920c9d97808ad619ba6e2e73d77826428f85`).
- Projet Supabase exclusif `mlabstdxxwjdpfaxiwmg`. Aucune donnée réelle modifiée par ce lot.
- PR #14 archives déjà fusionnée, PR documentaire #26 indépendante et non modifiée.
- Le dernier suivi actif `docs/PUNCH_WORK_CONTINUATION.md` continue de lister les autres lots et fournisseurs ouverts. **Le prompt maître complet n'est pas terminé.**

## Correction de continuité commerciale
La direction doit conserver une porte de sortie même pendant une suspension administrative / un abonnement restreint. L'interface de gestion Essentiel calcule la restriction d'après le statut **effectif** retourné par le bilan de facturation, avec fallback vers le statut de compagnie si le bilan n'a pas encore pu être chargé. Les restrictions de `cancelled` et `restricted` concernent seulement Essentiel; Construction n'est pas touché.

- La navigation restreinte propose seulement **Accès limité**, **Abonnement et factures** (Boss), **Support PUNCH** et **Mon pointage** (Boss).
- Les actions de gestion de la console sont bloquées côté interface. Les RPC/Edge backend restent l'autorité pour tout contrôle d'accès : **l'interface ne constitue pas une frontière de sécurité**.
- La page restreinte ne présente plus de tableau de présences, données RH ni boutons d'approbation.
- Le Boss peut rejoindre son mode de pointage personnel normal, selon les permissions/identités déjà existantes. L'Admin ne reçoit pas de droit personnel nouveau.
- Le bilan de facturation et le support sont chargés *avant* les modules de gestion pouvant être refusés.
- Si Stripe est indisponible, le statut confirmé côté RPC Supabase reste affiché et le plan de facturation ne propose pas de paiement tant que le fournisseur est indisponible.
- Les flux employés existants IN/OUT, pauses et consultation d'heures ne sont pas retirés par une suspension commerciale.

## Fichiers
- `web/live/restricted-management.js` : logique isolée et testable du statut et de la navigation.
- `web/live/app.js` : page limitée, menus autorisés, gardes d'actions.
- `web/live/essential.js` : ordre de chargement.
- `web/live/billing.js` : survie du bilan quand Stripe ne répond pas.
- `tests/restricted-management.test.mjs` et `tests/billing-ui.test.mjs` : tests de statuts/rôles/actions et indisponibilité fournisseur.

## Preuves et limites
- Tests Node/DOM, contrôle TypeScript et syntaxe Web : **en attente de CI de la PR** au moment de la rédaction.
- Aucun test sur session Boss suspendue réelle, aucun règlement Stripe et aucune modification Supabase.
- Recette navigateur authentifié **Boss actif → suspension test → accès abonnement/support/pointage → accès RH refusé → réactivation** requise avant fermeture complète.
- Tester aussi Admin, salariés existants, navigation profonde, panne Stripe, rafraîchissement et basculement d'entreprise.
- Réexécuter le scénario SQL des contrôles commerciaux sur **fixtures transactionnelles annulées**, puis régression Construction. Ne pas marquer la recette production ou fournisseur terminée sans preuves.

## Suite
Après CI : corriger les erreurs, vérifier la publication de la PR après fusion autorisée, confirmer le statut serveur sur vraie session de **compagnie fictive**, puis poursuivre actions Super Admin sur comptes réels et conditions tarifaires particulières. Garder SMS/Twilio à la fin.
