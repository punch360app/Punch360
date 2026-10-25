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
- **CI validée** : workflow PUNCH TypeScript, run [40225728289](https://github.com/punch360app/Punch360/actions/runs/40225728289) — 146/146 tests Node/DOM réussis, TypeScript, Expo dependency check et syntaxe de tous les fichiers Web réussis.
- Vérification lecture seule Supabase : `essential_billing_summary` expose le statut calculé via `private.essential_billing_state` (inclut la suspension manuelle), l'accès Boss est vérifié côté serveur; `support_list_tickets` délègue à `private.assert_support_access` par appartenance. Aucun SQL de mutation appliqué.
- Aucun test sur session Boss suspendue réelle, aucun règlement Stripe et aucune modification Supabase.
- Recette navigateur authentifié **Boss actif → suspension test → accès abonnement/support/pointage → accès RH refusé → réactivation** requise avant fermeture complète.
- Tester aussi Admin, salariés existants, navigation profonde, panne Stripe, rafraîchissement et basculement d'entreprise.
- Réexécuter le scénario SQL des contrôles commerciaux sur **fixtures transactionnelles annulées**, puis régression Construction. Ne pas marquer la recette production ou fournisseur terminée sans preuves.

## Suite
Après CI : corriger les erreurs, vérifier la publication de la PR après fusion autorisée, confirmer le statut serveur sur vraie session de **compagnie fictive**, puis poursuivre actions Super Admin sur comptes réels et conditions tarifaires particulières. Garder SMS/Twilio à la fin.

### Extension mobile et garde serveur commune
- `src/workforce/ManagementWorkspace.tsx` : navigation Expo restreinte Boss/Admin, chargement de l'état calculé avant ouverture des modules de gestion, refus prudent si l'état serveur est indisponible.
- `src/billing/BillingPanel.tsx` : statut de facturation conservé si l'appel Stripe échoue.
- `web/live/essential.js` : lecture anticipée de `essential_entitlements`, déjà disponible à tout membre de l'entreprise. Son champ `billing_status` utilise `private.essential_billing_state` et reflète aussi la suspension Super Admin. La fonction n'a pas été changée.
- `tests/essential-ui.test.mjs` : deux nouvelles vérifications d'accès Admin et de refus prudent.
- Aucune recette physique Expo, aucun paiement, aucun changement de base. Le prompt global est toujours ouvert.
