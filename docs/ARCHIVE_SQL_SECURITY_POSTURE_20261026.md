# PUNCH Essentiel — contrôle SQL de sécurité des archives (26 octobre 2026)

## Portée

Suite du prompt original **« Validation SQL archives »**, sans commencer le prompt maître. Ce lot ajoute `supabase/tests/company_archive_security_posture.sql`, un audit PostgreSQL **en transaction READ ONLY** exécutant des assertions sur le schéma de production, pas une restauration de société. Aucun enregistrement client, objet PDF, NIP, secret, session, rôle ni abonnement n'est modifié.

## Assertions (échec immédiat si une régression est détectée)

1. Les 4 tables internes (clés, exports, contexte et exécutions de restauration) existent, restent sous RLS et ne présentent aucun droit SELECT/INSERT/UPDATE/DELETE à `anon` ou `authenticated`.
2. Les RPC liées aux archives refusent l'exécution anonyme et les grants automatiques à `PUBLIC`. Le code interne en `private` reste inaccessible aux employés connectés.
3. Les routines de preuve de fichier, situées dans `public` pour l'Edge Function, ne deviennent pas exécutables par `authenticated`.
4. Les deux compartiments Storage `essential-hr` et `job-documents` restent privés.
5. Le cron `punch-expired-company-exports` reste actif avec son intervalle de 15 minutes.

**Portée de sécurité limitée :** le test des ACL n'est **pas** une preuve que toutes les fonctions `SECURITY DEFINER` valident parfaitement le tenant, la session MFA et les droits. Ces chemins sont testés séparément sur des entreprises fictives dans `company_archives.sql`, `company_archive_access.sql`, `company_archive_documents.sql` et `company_archive_conflicts.sql`. Les ACL ou buckets peuvent changer après la validation : exécuter la vérification en CI disposant d'une connexion contrôlée avant chaque release sensible.

## Mode opératoire

Exécuter le fichier intégral dans SQL Editor ou via un outil SQL autorisé **sur le seul projet `mlabstdxxwjdpfaxiwmg`**. La requête commence par `BEGIN READ ONLY`, affiche `PASS` en NOTICE ou lève une exception et finit par `ROLLBACK`. En cas d'erreur, ne jamais ouvrir les ACL pour faire passer le test sans examen de sécurité.

## Statut

- **Développé :** test de posture et documentation versionnés dans la PR de ce lot.
- **Testé :** noter ici uniquement après exécution vérifiable; aucune conclusion sur les clients réels ne peut être tirée d'un test de catalogue.
- **Déployé :** aucun changement de base ou Edge Function requis; le test appartient au dépôt.
- **Intervention externe :** toujours nécessaires pour la recette réelle PDF binaire navigateur↔Storage↔Edge, validation de restore en environnement de test isolé, charge/concurrence, exercices de reprise PostgreSQL/PITR et contrôles de confidentialité.

Le test ne remplace ni l'archive applicative, ni une sauvegarde infrastructure, ni la recette Stripe/OAuth, ni des essais Android/iPhone/iPad. Aucun SMS Twilio avant l'étape finale.
