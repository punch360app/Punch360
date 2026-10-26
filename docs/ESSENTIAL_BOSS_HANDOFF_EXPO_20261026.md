# Succession Boss Essentiel — interface Android/iOS Expo

Le backend du transfert volontaire à deux confirmations MFA existe depuis la PR #62, migration Supabase `20261026032012_essential_boss_dual_consent_handoff`. Cette mise à jour complète la **même procédure** pour Expo Android et iPhone; elle ne crée pas de deuxième mécanisme de transfert.

## Parcours mobile
Le menu de gestion Essentiel (Boss ou Admin, abonnement non restreint) affiche « Transmission de direction ». Une vérification MFA TOTP AAL2 est obligatoire avant toute consultation ou modification.

- Si un facteur TOTP est déjà configuré, saisir le code à six chiffres pour obtenir AAL2. La première activation TOTP s'effectue dans PUNCH Web, où le QR d'enrôlement est disponible.
- Le Boss voit les administrateurs actifs de **cette entreprise seulement**, choisit le successeur et entre le motif du transfert. Une confirmation explicite exige de recopier `companyUUID:successorUUID`.
- Le successeur reçoit la demande dans la même page, se connecte sur son propre compte avec MFA, accepte et recopie `companyUUID:oldBossUUID`.
- Le Boss initial doit revenir avec AAL2 et confirmer définitivement avec `companyUUID:successorUUID`. Il devient Admin; le successeur devient Boss.
- Le transfert réussi déclenche une déconnexion locale pour recharger les autorisations et le rôle après une nouvelle connexion. Le client ne modifie pas lui-même les droits.
- Annulation et actualisation de version possibles; toutes les mutations sont validées en SQL dans une transaction avec audit.
- Aucune lecture ni récupération de mot de passe, aucune prise de propriété forcée par Super Admin, aucun changement Stripe.
- L'écran est masqué en mode gestion restreinte et n'existe pas pour PUNCH Construction.

## Fichiers
`src/workforce/BossHandoffPanel.tsx` (Expo), `src/workforce/ManagementWorkspace.tsx` (navigation), `web/live/boss-handoff.js` (correctif : pas de lecture d'état avant AAL2), `tests/boss-handoff-ui.test.mjs` (test de refus en AAL1).

## Vérifications
GitHub CI TypeScript/Expo et syntaxe Web; tests SQL d'origine `supabase/tests/essential_boss_dual_consent_handoff.sql` ont été exécutés après l'installation, par transaction ROLLBACK. Le correctif présent ne modifie **aucune migration, aucun compte et aucun rôle réel**.

**Recette non terminée** : deux comptes fictifs sur deux appareils réels, authentificateurs configurés, liens expirés, reconnexion, basculement de compagnie et push de notification. Le cas d'un Boss inaccessible ou décédé n'est **pas** couvert par une succession volontaire; assistance juridique séparée nécessaire.

Ce travail est une extension du **prompt original « Validation SQL archives »**, pas du prompt maître ultérieur.
