# Support et journal Super Admin — 25 octobre 2026

Support Web et Expo intégré aux espaces Essentiel personnels et de gestion, et à la console Super Admin. Demandes par entreprise avec réponses, statut, clôture et réouverture. Le serveur vérifie l’appartenance active, l’auteur ou la permission de gestion, et une session MFA encore présente pour tout accès plateforme. Les tables privées sont fermées aux clients; seules les RPC contrôlées sont exécutables. Le support reste accessible pendant une restriction de facturation.

Création et réponses idempotentes par UUID; les reprises réseau dans la même session gardent le même identifiant et refusent un contenu modifié. Les modifications de statut et les réponses vérifient la version du ticket. Les réponses plateforme sont auditées sans recopier le contenu du message dans l’audit. Aucun courriel ou SMS envoyé par ce module.

Journal plateforme : filtres sur action, objet et intervalle de dates; pagination de 100 lignes avec curseur date/UUID; détails de l’événement et export CSV des lignes chargées. Le filtre de pagination reste celui de la recherche initiale. Aucun accès direct aux tables et aucune modification d’événement depuis l’interface. Les réponses tardives sont ignorées après déconnexion.

Validation locale : 71 tests Node/DOM et TypeScript. Scénarios SQL transactionnels dédiés support et audit exécutés sur le projet PUNCH : isolation interentreprise, refus de boîte plateforme à un employé, idempotence, versions périmées, clôture/réouverture, session révoquée et pagination à horodatage identique.

Limites : pas encore de notification push ni de pièce jointe support; interfaces Expo compilées TypeScript, essais sur appareils restants. Les fils montrent les 200 messages les plus récents. Les brouillons et identifiants de reprise ne survivent pas au rechargement du navigateur. L’export d’audit couvre seulement les lignes chargées; ce n’est pas une sauvegarde complète. Le cahier des charges reste ouvert.
