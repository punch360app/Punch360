# Essentiel — organisation et planification

## Livré

Le calendrier `scheduled_shifts` existant est conservé et étendu avec le salarié stable, l’établissement, le département, le fuseau, la version et le cycle. Les quarts d’un salarié sans compte sont rattachés à son identité Auth lors de son activation, sans doublon de dossier ou de calendrier. Construction continue d’utiliser les mêmes endpoints et ses anciens contrôles.

| Fonction | Serveur et interfaces |
|---|---|
| Établissements et départements | Création et affectation des salariés Web/Expo; établissement principal automatique. Pro permet plusieurs sites; Plus/base limités à un. Pas de faux numéro de chantier dans l’interface Essentiel. |
| Superviseurs | Le Boss accorde un département et une permission lecture/planification. Révocation disponible. Le superviseur conserve son punch personnel; son roster de supervision expose noms, matricules et présence, pas les contacts privés ni salaires. |
| Quarts uniques | Salarié avec ou sans Auth, ou quart vacant si inclus au forfait. Création, modification versionnée, annulation motivée, contrôle des chevauchements/congés/indisponibilités. |
| Quarts récurrents | Jours ISO et semaines, jusqu’à 26 semaines, identifiant idempotent conservé lors d’un réessai après réponse perdue. |
| Rotations | Cycle serveur de 1–28 jours répété sur 366 jours au maximum. Interfaces jour/soir (14 jours) et jour/soir/nuit (21 jours); premier lundi demandé. |
| Fuseaux et nuit | Les heures locales sont converties côté serveur dans le fuseau de l’établissement, indépendamment du téléphone. Quart passant minuit; heures locales ambiguës/inexistantes refusées. Pour une heure ambiguë particulière, le RPC de quarts absolus accepte un instant avec décalage explicite; formulaire avancé dédié restant à faire. |
| Lecture d’horaire | Confirmation personnelle horodatée pour une version précise; une modification demande une nouvelle confirmation. |
| Disponibilités | Création/retrait personnels, visibles au salarié et aux responsables autorisés. Une indisponibilité bloque une nouvelle affectation; elle n’efface pas un quart déjà publié. |
| Quarts vacants / remplacement | Un salarié se propose sur un quart vacant ou demande à libérer son quart. L’affectation officielle attend la décision d’un responsable. |
| Échanges | Proposition entre salariés d’un même site/département, accord du collègue puis décision autorisée. Changement atomique des deux affectations; autoapprobation interdite, versions contrôlées. |
| Prévu/réel | Heures brutes sur une période UTC de 31 jours maximum et nombre de quarts vacants; aucune paie ni salaire inventé. |
| Couverture Pro | Minimum constant de personnes par département, intervalles de manque calculés aux bornes des quarts; salariés désactivés exclus de la couverture. Pas encore de règles par poste/qualification ou d’heures d’ouverture automatiques. |
| Notifications | Notifications internes dédupliquées sur une minute pour les publications d’horaire, propositions et décisions. Pas de push/SMS automatique d’horaire activé dans ce lot. |
| Bornes multisites | Appairage à un établissement précis; limites 1/3/illimitées issues de l’entitlement. Le pointage personnel choisit l’établissement affecté. |
| Exports | Matricule stable et nom de l’établissement dans les CSV Essentiel, y compris les salariés sans compte personnel. |

## Droits commerciaux

Les droits sont lus dans le snapshot contractuel confirmé par un identifiant d’abonnement Stripe lorsqu’il existe. À défaut, le noyau Essentiel est utilisé; l’interface ne peut pas se donner Plus/Pro. La console Super Admin peut simuler un forfait uniquement pour une compagnie marquée `is_test` et `test_simulated`, sous MFA. Cette simulation n’accorde jamais un paiement à une entreprise réelle.

Les contrats et données historiques ne sont pas réécrits lors d’un changement du catalogue. Les limites protègent les créations; la politique complète de transition d’un client ayant déjà trop de sites après une rétrogradation reste à finaliser avec Stripe.

## Validation réalisée

- TypeScript et 33 tests Node/DOM passent. Six tests de planification couvrent les heures locales, les réessais idempotents, le superviseur en lecture seule, le motif de décision, les confirmations versionnées et les éditions conservant ID/version. Un test supplémentaire vérifie qu’une réponse tardive ne rétablit pas des données personnelles après déconnexion.
- Treize scripts SQL en transactions annulées sur le projet officiel. Les quatre scripts ajoutés couvrent planification, workflows, intégrité temporelle et limites des forfaits. Les anciens tests Construction, borne, invitations et fermetures passent aussi.
- Cas SQL : salarié sans Auth, activation conservant l’horaire, quart de nuit, récurrence et rotation sans doublons, chevauchement refusé, congés/indisponibilités, mauvais tenant, superviseur hors périmètre, refus d’autoattribution de droits, échange avant/après consentement, prise/libération de quart, couverture, restrictions de forfait.
- Changements saisonniers Québec : nuit de 9 heures en automne, 7 heures au printemps; saisie locale ambiguë/inexistante refusée. Modification périmée refusée; annulation possible après désactivation du salarié.
- Metro produit les bundles Android et iOS. Ce ne sont pas des APK/IPA signés et ils ne prouvent pas une exécution sur appareils physiques.
- Le calendrier Web charge au maximum 1 000 quarts pour la période choisie; message invitant à réduire une période trop dense. Expo consulte 7 jours passés et 90 prochains jours, maximum 1 000. Navigation étendue de l’historique native à compléter.
- Calendrier ouvert et présences de gestion actualisés chaque minute sans écraser une saisie Web; retour au premier plan pris en charge dans le panneau Expo. Pas de garantie push lorsque l’application est fermée.
- Le mobile conserve pendant 24 h les canaux de punch et l’établissement déjà vérifiés pour préparer une ouverture hors ligne; après expiration une connexion est requise. Les contrôles serveur s’appliquent au rejeu. Les événements déjà conservés dans le journal ne sont pas supprimés.
- Advisors : nouvelles tables publiques sous RLS; snapshots/batches privés fermés aux clients. Les RPC SECURITY DEFINER sont intentionnelles, avec identité, tenant, rôle, forfait et portée contrôlés. La protection Supabase contre les mots de passe compromis reste une configuration à activer avant commercialisation : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## À terminer dans les suites du produit

Stripe et la transition commerciale réelle; signatures/paie/RH avancées; vingt thèmes et traductions; hors ligne sécurisé de la borne; sauvegardes/restauration; distribution et essais physiques. Édition/archivage des fiches d’établissement/département, modèles de rotation enregistrables, affectations par poste/qualification et calendrier externe restent à compléter. La couverture et les heures brutes ne constituent pas une validation réglementaire de paie.
