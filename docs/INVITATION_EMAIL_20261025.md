# Invitations courriel — 25 octobre 2026

Développé Web/Expo : réglages administratifs d’envoi automatique, validité configurable 1–720 heures (72 par défaut), suivi des états et nombre de tentatives. Les nouveaux salariés sans compte, actifs, avec courriel et accès personnel autorisé déclenchent une invitation si l’option est activée. L’activation vérifie toujours le courriel/téléphone confirmé, le dossier stable, l’expiration et l’usage unique; aucune création de rôle Boss par défaut. Les SMS et leur consentement restent séparés.

La création et l’activation réutilisent les fonctions existantes. Les liens utilisés par le courriel sont identiques à ceux de l’invitation manuelle. La page Web retire déjà le code de l’URL après sa mise en session. Une invitation manuelle remplace l’ancienne; le worker annule les envois devenus invalides. Le retour de création ne signifie jamais « courriel livré ».

## Backend déployé

Cinq migrations appliquées : worker_invitation_email, invitation_email_delivery_events, worker_email_auto_creation, invitation_settings_audit_entity et invitation_settings_archive. La correction d’audit a été nécessaire après détection d’un entity_id manquant par le test SQL; elle est appliquée et le scénario complet passe.

Clé dédiée générée uniquement côté serveur dans Vault, distincte de la signature des archives. Les jetons nécessaires à la file sont chiffrés et invisibles aux clients; suppression de la copie après acceptation fournisseur ou échec définitif. La purge toutes les quinze minutes retire les jetons d’invitations expirées, activées ou révoquées, puis les métadonnées terminales de 90 jours. Les réglages figurent dans l’archive signée à titre documentaire, sans réactivation d’envoi à la restauration. Les files et jetons privés n’y figurent pas.

Edge invitation-email v1 : JWT et clé service requis, interrupteur PUNCH_INVITATION_EMAIL_ENABLED, RESEND_API_KEY et PUNCH_MAIL_FROM nécessaires. Aucun cron d’envoi activé. Corps et destinataire figés par invitation, clé d’idempotence stable; reprises plafonnées à cinq et à une fenêtre de 23 heures, inférieure aux 24 heures documentées par Resend. Après cette fenêtre, résultat inconnu sans renvoi aveugle; une nouvelle invitation doit être décidée.

Edge invitation-email-webhook v1 : JWT désactivé intentionnellement; authentification HMAC SHA-256 Svix du corps brut, fenêtre temporelle cinq minutes, signature vérifiée avec WebCrypto. RESEND_WEBHOOK_SECRET requis. Événements dédupliqués, seules les références fournisseur et le type sont conservés; aucun corps, adresse, lien ou jeton dans les événements. Une livraison arrivée avant le résultat de l’envoi est réconciliée. « Acceptée », « livrée », « ouverture signalée » et « activée » restent distinctes; les ouvertures ne sont pas une preuve de lecture humaine et ne sont pas garanties. Aucun pixel ajouté par le code.

## Validation et limites

122 tests Node/DOM et TypeScript. Tests du transport injecté, configuration/authentification, idempotence, contenu d’activation, webhook valide/altéré/ancien (vecteur officiel Svix), événements sans données privées, réglages/version, réponses tardives et états affichés. SQL invitation_email sur fixtures annulées : création automatique, validité, chiffrement, interdiction client, baux uniques, course webhook/résultat, purge du jeton, doublons et arrêt de l’automatisation. Régressions invitations existantes, comptes test et archives réussies.

Web essential-34 : publication PR/CI à vérifier dans le suivi. Expo : source TypeScript, aucun build signé/appareil. Aucun courriel ni SMS réel envoyé pendant les tests. Aucun fournisseur n’est déclaré configuré ou validé.

Interventions externes : compte Resend (ou adaptateur équivalent à convenir), domaine expéditeur vérifié avec DNS, clé et adresse expéditeur dans les secrets Supabase, secret et URL webhook dans le fournisseur, ordonnanceur sécurisé du worker, puis recette d’envoi/activation sur boîte fictive contrôlée avant activation de production. Configurer également le SMTP Auth pour les confirmations/récupérations : cette file transactionnelle ne remplace pas le courriel Supabase Auth. Confidentialité fournisseur/rétention/DNS à vérifier. L’intégration des invitations de membres legacy Construction n’est pas modifiée par ce lot.

Références fournisseur : https://resend.com/changelog/idempotency-keys ; https://resend.com/docs/webhooks/verify-webhooks-requests ; https://docs.svix.com/receiving/verifying-payloads/how-manual .
