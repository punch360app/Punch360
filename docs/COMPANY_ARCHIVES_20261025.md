# Archives applicatives — 25 octobre 2026

## Parcours développé

Boss (menu Archives et récupération, deux éditions) et Super Admin (onglet Archives, entreprise explicite). Session Boss vivante ou session plateforme MFA vivante vérifiée par chaque RPC. Export atomique des collections métier/historiques et des références de PDF privés; signature HMAC serveur, secret Vault existant conservé. Le snapshot signé inclut maintenant la date de version des objets Storage. Un PDF changé depuis la capture fait échouer l’export complet, sans fichier partiel présenté comme sauvegarde complète.

Le navigateur assemble les blocs, vérifie empreintes/documents, puis produit un fichier `.punch` chiffré AES-256-GCM / PBKDF2-SHA256 (600 000 itérations, sel et IV aléatoires). Aucun mot de passe d’archive ni contenu déchiffré n’est placé en stockage local, dans les journaux ou dans Git. Mot de passe 12–256 caractères conservé séparément par l’utilisateur; PUNCH ne peut pas le récupérer. Limites explicites : 20 Mo de données, 25 Mo par PDF, 100 Mo d’enveloppe déchiffrée; au-delà, procédure opérateur nécessaire, jamais de troncature.

Import : déchiffrement local, intégrité, identité entreprise/projet, vérification de la signature côté serveur. Prévisualisation des PDF (manquants / identiques / conflits) et des données. Les PDF se récupèrent séparément, avec preuve liée à l’archive et au chemin; Storage POST avec `x-upsert=false`, donc aucune réécriture d’objet actuel. Refaire la prévisualisation des données après récupération des PDF. Les lignes privées d’archive ne sont jamais accessibles directement aux clients.

La prévisualisation utilise les mêmes contraintes et triggers que la récupération dans une sous-transaction systématiquement annulée. Elle classe conflits de clés primaires/uniques, références manquantes et règles bloquantes. La récupération requiert nom actuel de l’entreprise, motif et empreinte de prévisualisation; elle refuse les plans périmés, sérialise brièvement les tables avec délai d’attente de verrou de deux secondes et reste idempotente par identifiant. Un résultat réseau inconnu peut être réessayé avec le même identifiant. Les données présentes restent intactes.

Salariés récupérés : désactivés, rôle employee, compte dissocié, canaux et accès personnel désactivés, consentement SMS non rétabli. Les sessions ouvertes sont exclues. La récupération de sessions historiques fermées utilise un contexte privé de transaction inaccessible au client, sans désactiver RLS ni les triggers. Les quarts récupérés restent annulés. Membres, droits, invitations, appareils, paiements, verrouillages de paie et conversations sont archivés pour consultation mais ne sont pas automatiquement rétablis. Les collections exclues et les lignes bloquantes sont comptées; une archive n’est pas une promesse de rétablissement automatique de tous les objets.

Copies temporaires serveur : suppression explicite après téléchargement / récupération et bouton Fermer (y compris copies retrouvées après rechargement). Expiration d’accès à 24 h; purge `pg_cron` active vérifiée toutes les 15 minutes, donc effacement physique au passage suivant. Un onglet fermé brutalement peut laisser sa copie jusqu’à cette purge. La tâche ne supprime ni documents officiels ni fichiers téléchargés par l’utilisateur.

## Validation effectivement exécutée

- TypeScript et suite Node/DOM complète : 89 tests réussis au point de validation de ce lot.
- Codec : aller-retour chiffré, mauvais mot de passe, corruption du texte/du chiffrement, KDF invalide, PDF manquant/dupliqué/modifié et chemin étranger.
- Contrôleur Web : téléchargement chiffré uniquement, blocs, nettoyage et réponse tardive après déconnexion.
- Handler Edge : téléchargement, contrôle des octets/signatures, prévisualisation sans écriture, insertion sans upsert, conflits conservés, révocation et signatures falsifiées. Transport Storage/Auth injecté, pas de preuve d’un téléversement PDF réel par un navigateur connecté.
- SQL officiel, transactions annulées sur fixtures exclusivement : `company_archives.sql`, `company_archive_access.sql`, `company_archive_conflicts.sql`, `company_archive_documents.sql`. Récupération réelle de lignes synthétiques et vérification des résultats, idempotence, absence d’écriture persistante en prévisualisation, sessions ouvertes exclues, conflits/références, révocation, signature et version de PDF, suppression/expiration.
- Régressions SQL `essential_kiosk.sql`, `operations.sql`, `essential_break_corrections.sql` réussies après modification du trigger historique.
- Advisors exécutés : tables privées fermées intentionnellement sans policy; RPC publiques SECURITY DEFINER explicitement autorisées et contrôlées côté serveur. L’alerte globale de protection des mots de passe compromis reste ouverte; pas de certification de sécurité complète.

## Déploiement et limites

Cinq migrations additives de restauration/capture/nettoyage appliquées via connecteur. Les trois migrations originales d’export n’ont pas été rejouées; clé Vault intacte. `company-archive-files` v1 ACTIVE, validation JWT activée. Web : PR #14 fusionnée (9810f1d), CI et Pages réussis, fichiers publics vérifiés identiques. Deux exécutions réelles du cron de purge réussies observées, à 12:15 et 12:30 UTC le 25 octobre.

Aucun PDF officiel récupéré ni aucune restauration d’entreprise réelle durant la recette. Pas d’essai physique Android/iPhone/iPad; pas de test de charge ou de concurrence multiconnexion à ce stade. Une recette authentifiée de bout en bout avec un véritable PDF fictif via Storage et appareil reste à exécuter. Le code du transport est testé par injection et ses preuves serveur par SQL, ce qui ne remplace pas cette recette intégrée.

## Sauvegardes d’infrastructure et reprise après sinistre

L’archive applicative ne sauvegarde pas les comptes Auth, secrets Vault, politiques RLS, configuration OAuth/SMTP/Stripe, configuration du projet, ni tous les blobs Storage d’infrastructure. Elle ne remplace ni sauvegarde PostgreSQL/PITR ni sauvegarde indépendante de Storage.

Procédure opérateur : vérifier dans le dashboard officiel le plan Supabase et la rétention/PITR disponibles; conserver séparément un export de schéma/migrations, les sauvegardes DB et une copie vérifiée des objets privés dans un stockage d’administration chiffré; sauvegarder les secrets avec le gestionnaire autorisé, jamais dans Git. Restaurer d’abord dans un environnement isolé autorisé, rétablir DB puis objets, contrôler comptes/RLS/empreintes et quelques parcours métier, mesurer RPO/RTO, documenter le résultat, puis décider d’un basculement. Ne jamais utiliser le projet réel comme environnement d’exercice de sinistre.

Accès externe restant : visibilité du plan/rétention/PITR et stockage opérateur hors projet, environnement isolé autorisé et décision RPO/RTO du propriétaire. Aucun PITR ni exercice infrastructure n’a été lancé. Région actuelle vérifiée : `us-east-1` (Postgres 17.11), donc les exigences de résidence/transferts hors Québec et d’évaluation de confidentialité restent à traiter; aucune conformité Loi 25 affirmée.

Références consultées : changelog Supabase du 25 octobre 2026 et documentation officielle Storage Standard Uploads (POST sans écrasement; TUS recommandé au-delà de 6 Mo pour la fiabilité).
