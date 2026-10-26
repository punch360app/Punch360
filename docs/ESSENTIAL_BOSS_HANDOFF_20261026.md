# Transfert volontaire du Boss — Essentiel

La compagnie Essentiel a un écran de **transmission de direction** réservé au Boss et aux administrateurs, dans la gestion de l'entreprise.

1. Le Boss demande une succession vers un administrateur actif de la même compagnie. Il entre un motif et confirme les identifiants.
2. Le successeur accepte depuis son propre compte avec authentification MFA AAL2.
3. Le Boss initial confirme définitivement avec MFA AAL2. À cette étape seulement, le successeur devient Boss et l'ancien Boss devient administrateur.

La demande expire après 48 heures, est annulable et utilise des versions empêchant les validations périmées. Une seule succession ouverte est permise par compagnie. Le serveur refuse les demandes si plusieurs Boss sont déjà actifs ou si l'un des comptes change de rôle. Un journal d'audit enregistre chaque étape. Le protocole ne change ni les heures, ni la facturation, ni les dossiers des autres compagnies.

**Implémentation :** `web/live/boss-handoff.js`, `web/live/app.js`, migration `supabase/migrations/20261026032012_essential_boss_dual_consent_handoff.sql`, tests `supabase/tests/essential_boss_dual_consent_handoff.sql` et `tests/boss-handoff-ui.test.mjs`.

**Validation :** migration appliquée au projet Supabase officiel sous la version `20261026032012`; scénario SQL transactionnel rejoué et réussi avec rollback. Test Web et TypeScript en CI. Aucun transfert client réel effectué.

**Limites :** une succession volontaire n'est pas un protocole de récupération pour un Boss indisponible. Elle requiert encore une recette avec deux utilisateurs fictifs et deux appareils authentifiés, plus vérification de la rotation des sessions et de l'envoi des notifications. Aucun accès au mot de passe d'autrui.

Ce travail appartient au prompt original « Validation SQL archives ». Le prompt maître consolidé reste un chantier distinct.

## Correctif de sécurité — 26 octobre 2026

Après la fusion de la PR #62, l'interface est renforcée : chaque changement d'entreprise ou de compte efface la référence du facteur MFA, le QR, le code à usage unique et l'ancien statut de succession. Les réponses asynchrones provenant d'une ancienne entreprise ne remplacent plus le statut courant. Avant AAL2, le bouton d'actualisation des demandes n'est pas affiché; la RPC refuse toujours la lecture côté serveur.

Migration `20261026052212_boss_handoff_auth_cleanup.sql` déjà installée sur le projet Supabase officiel : les demandes privées d'un compte Auth supprimé sont effacées en cascade au lieu de bloquer la suppression de ce compte. L'audit d'entreprise doit respecter sa propre politique de conservation.

La recette SQL transactionnelle de succession a été relancée après installation avec succès. Aucune compagnie réelle n'a fait l'objet d'une succession pendant les tests. La recette de deux appareils et deux personnes réellement authentifiées reste à effectuer avant qualification terrain.
