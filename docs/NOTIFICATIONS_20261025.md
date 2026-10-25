# Notifications — suivi du 25 octobre 2026

## Préférences personnelles

Web et Expo : cinq catégories (horaires, décisions, annonces, rappels, autres), choix push/courriel par entreprise. Valeur initiale désactivée, mise à jour avec version attendue. Le serveur déduit toujours l’utilisateur authentifié : aucun paramètre destinataire modifiable. RLS refuse la lecture des préférences d’un autre utilisateur, y compris pour un Boss. La boîte interne conserve l’historique indépendamment des canaux externes.

Migration notification_preferences appliquée. Tests SQL sur fixtures annulées : initialisation, version obsolète, mise à jour, isolation entre membres et désactivation. Tests Node/DOM : canaux indépendants, version attendue et réponse tardive ignorée après déconnexion. Source Expo TypeScript uniquement.

La livraison push et courriel reste à développer/configurer et à tester. Le projet Expo/EAS, FCM/APNs et les appareils physiques ne sont pas validés; app.json ne contient actuellement aucun projectId EAS. La documentation officielle Expo 57 précise que le push exige un build approprié, ses identifiants fournisseur et la recette de l’appareil : https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ et https://docs.expo.dev/push-notifications/push-notifications-setup/ . Aucun envoi fournisseur déclaré réussi dans ce lot.

## Navigation employé corrigée

La liste de routage Essentiel ne transmettait pas les sous-pages missingDays et supervision au routeur, bien que les liens et contrôleurs existent. Les deux écrans sont désormais accessibles depuis Plus. Le test DOM de l’application réelle vérifie les deux titres après navigation. Les gardes backend demeurent la source des autorisations.

Publication Web essential-32 par PR/CI à vérifier dans le suivi actif. Le prompt global n’est pas terminé.
