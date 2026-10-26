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
