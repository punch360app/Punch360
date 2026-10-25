# Notifications — suivi du 25 octobre 2026

## Préférences personnelles

Web et Expo : cinq catégories (horaires, décisions, annonces, rappels, autres), choix push/courriel par entreprise. Valeur initiale désactivée, mise à jour avec version attendue. Le serveur déduit toujours l’utilisateur authentifié : aucun paramètre destinataire modifiable. RLS refuse la lecture des préférences d’un autre utilisateur, y compris pour un Boss. La boîte interne conserve l’historique indépendamment des canaux externes.

Migration notification_preferences appliquée. Tests SQL sur fixtures annulées : initialisation, version obsolète, mise à jour, isolation entre membres et désactivation. Tests Node/DOM : canaux indépendants, version attendue et réponse tardive ignorée après déconnexion. Source Expo TypeScript uniquement.

La livraison push et courriel reste à développer/configurer et à tester. Le projet Expo/EAS, FCM/APNs et les appareils physiques ne sont pas validés; app.json ne contient actuellement aucun projectId EAS. La documentation officielle Expo 57 précise que le push exige un build approprié, ses identifiants fournisseur et la recette de l’appareil : https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ et https://docs.expo.dev/push-notifications/push-notifications-setup/ . Aucun envoi fournisseur déclaré réussi dans ce lot.

## Navigation employé corrigée

La liste de routage Essentiel ne transmettait pas les sous-pages missingDays et supervision au routeur, bien que les liens et contrôleurs existent. Les deux écrans sont désormais accessibles depuis Plus. Le test DOM de l’application réelle vérifie les deux titres après navigation. Les gardes backend demeurent la source des autorisations.

Publication Web essential-32 par PR/CI à vérifier dans le suivi actif. Le prompt global n’est pas terminé.

## Push — lot suivant

Développé : enregistrement explicite d’appareils Expo iOS/Android, révocation personnelle Web/Expo, jetons privés et session active liée (déconnexion/expiration et désactivation contrôlées), dix appareils actifs maximum par membre/entreprise. Un même jeton repris par un autre compte révoque les anciennes associations. app.json contient le plugin expo-notifications et les modules SDK 57 compatibles sont installés; aucun projectId fournisseur n’a été inventé.

Backend appliqué : push_devices_outbox, push_session_expiry, push_delivery_expiry_cleanup. La création d’une notification interne ajoute une tâche seulement avec préférence push active et appareil/session/membre valides. Le worker service-only utilise des baux verrouillés, une clé unique notification/appareil et des reprises temporisées plafonnées. Un timeout d’envoi ou bail expiré est « unknown », sans renvoi aveugle; cela peut exiger une vérification opérateur. Une acceptation Expo est distincte du reçu FCM/APNs et n’est jamais présentée comme une lecture utilisateur. Le message verrouillé reste générique; seul un identifiant de notification et d’entreprise permet l’ouverture ultérieure du contenu autorisé.

Les tâches lues, désinscrites, révoquées ou vieilles de 24 h sont annulées. Les appareils inactifs 90 jours sont révoqués. Purge quotidienne à 03:37 UTC : métadonnées terminales de 90 jours, puis jetons révoqués de 90 jours sans tâche référente. Aucune donnée métier ou notification interne n’est supprimée par cette purge.

Edge push-delivery version 2 déployée avec JWT et vérification supplémentaire de la clé service. Le code requiert explicitement PUNCH_PUSH_ENABLED=true; aucun appel fournisseur effectué pendant les tests. Aucun cron d’envoi n’est configuré à ce stade. Les appels service doivent être programmés après recette via un ordonnanceur sécurisé, sans clé dans une URL, GitHub, client ou logs.

Testé : 116 tests Node/DOM et TypeScript; configuration Expo résolue. Handler testé avec transport injecté : authentification/activation, ticket versus reçu, message générique, appareil invalide, limite fournisseur et résultat réseau inconnu. SQL push_delivery sur fixtures annulées : consentement, absence de fuite du jeton, appels clients refusés, absence de double bail, ticket/reçu, révocation, désinscription et expiration de session. Régressions préférences et cycle de vie des comptes test réussies.

Interventions nécessaires : rattachement du projet Expo/EAS officiel, identifiants FCM v1/APNs dans les outils fournisseur, build signé/installé, essais réception/révocation/tap sur appareils, vérification des transferts fournisseur/confidentialité, puis activation et ordonnanceur du worker. L’intégration Web Push navigateur reste ouverte. Les courriels transactionnels et invitations automatiques restent ouverts. Ne pas annoncer la livraison push de bout en bout validée.
