> Organisation et planification Essentiel : voir [ESSENTIAL_PLANNING_20261024.md](ESSENTIAL_PLANNING_20261024.md). Départements, établissements, périmètres superviseurs, récurrences/rotations, échanges et couverture sont reliés au serveur. Produit complet toujours en développement.

> Lot borne en ligne ajouté : registre worker_id, appairage, enrôlement NIP, révocation et échanges téléphone/borne testés SQL. 25 tests locaux et huit scripts SQL passent. Voir ESSENTIAL_PROGRESS_20261024.md pour les limites.

> État actualisé : [ESSENTIAL_PROGRESS_20261024.md](ESSENTIAL_PROGRESS_20261024.md). Trois migrations appliquées, deux fonctions SMS déployées, 24 tests locaux et sept scripts SQL passés. Le produit complet n’est pas terminé.

> Lot local Essentiel du 24 octobre : voir [ESSENTIAL_DELIVERY_20261024.md](ESSENTIAL_DELIVERY_20261024.md). Adaptateur Twilio et graines des trois forfaits testés; non déployés.

> Mise à jour rôles et couverture : voir [REQUIREMENTS_AUDIT.md](REQUIREMENTS_AUDIT.md). Les sections ci-dessous décrivent aussi les livraisons précédentes.

# PUNCH 360° — état réel du 24 octobre 2026

Dépôt officiel : `punch360app/Punch360`. Supabase : `mlabstdxxwjdpfaxiwmg`.
Application en développement : les validations ci-dessous ne constituent pas une validation de paie ou un test terrain.

## Ajouts de cette livraison

Les migrations `workforce_workflows`, `schedules_invitations_documents`, `punch_geofence_review`, `offline_punch_journal`, `offline_event_dependencies` et `harden_payroll_location_events` ont été appliquées sur le projet PUNCH.

| Fonction | Serveur | Interface |
| --- | --- | --- |
| Demande de correction d’entrée/sortie | Valeurs officielles inchangées avant décision; contrôle des chevauchements, audit avant/après et conservation des transferts multijobs | Web : Mes heures. Expo : Plus → Corrections, approbations et exports |
| Approbation/refus | Admin/Boss; autoapprobation interdite; motif obligatoire | Web et Expo |
| Fermeture/réouverture de semaine | Lundi et fuseau America/Toronto; semaine terminée seulement; bloque si punch actif, correction en attente ou contrôle GPS/hors ligne non validé | Web et Expo |
| Export CSV | Lecture RLS, pagination des segments, heures brutes sans déductions automatiques | Fichier téléchargeable Web; fichier partageable Android/iOS |
| Congés | Approbation/refus audités; conflits avec horaires vérifiés | Web et Expo |
| Commandes | Demandé → Approuvé/Refusé → Commandé → Livré; transitions et motifs vérifiés | Web et Expo |
| Horaires | Quarts datés; empêche chevauchements et conflits de congé; annulation motivée | Web et Expo |
| Invitations | Courriel confirmé exact, rôle employee/lead/admin, jeton haché à usage unique, expiration 1–168 h, places réservées; paiement actif requis | Création et partage d’un lien; acceptation Web et Expo. Aucun envoi automatique SMS/courriel |
| Plans PDF | Bucket privé, maximum 25 Mo, chemins compagnie/job vérifiés, nouveaux objets pour nouvelles révisions | Publication et ouverture par URL signée courte Web/Expo |
| Lecture des plans | Confirmation distincte pour chaque document/révision, horodatage serveur | Web et Expo |
| Rayon de punch | Par job, 10–10 000 m, défaut 200 m; calcul de distance serveur; conserve rayon/coordonnées au moment du punch | Admin → Rayon de punch; Web et Expo |
| Punch hors rayon | Temps conservé; validation en attente; position absente, imprécise ou chantier non configuré distingués | Notifications internes aux Admin/Boss; accepter ou corriger les heures d’une session terminée avec audit |
| Punch sans réseau | Journal persistant écrit avant envoi; IN/OUT/transfert; compteurs projetés localement; cache des jobs et de la dernière session | Web et Expo, après une première connexion sur cet appareil |
| Retour réseau | Rejeu ordonné, identifiant stable, accusé serveur idempotent; garde les heures locales hors ligne et l’heure de réception; validation Admin/Boss | Web : événement online et réouverture. Expo : événement réseau, retour au premier plan et vérification périodique |
| Conflits de synchronisation | Tous les événements sont conservés; une dépendance en conflit empêche l’application automatique des événements suivants | Liste des conflits consultable par le membre et l’administration; réconciliation administrative complète à terminer |

Les RPC brutes `punch_in/out/transfer` sont désormais internes. Le client passe par `sync_punch_event` et les contrôles GPS, sans pouvoir éviter la validation en appelant directement les anciennes RPC.

## Déjà présent et conservé

Navigation Accueil/Mes heures/Commande/Message/Plus; annuaire de jobs et carte; GPS demandé pendant l’utilisation, proposition avec confirmation; transfert atomique sans arrêter la journée; archives personnelles sans effacer les heures; équipes multiples et association des équipes aux jobs; groupes privés de chefs; profil, contacts d’urgence et métadonnées des certifications; RLS par compagnie et contrôle serveur des mutations de gestion après restriction d’abonnement.

## Vérifications réalisées

- `npm run check` : compilation TypeScript sans émission.
- `npm test` : sept tests du journal, plus un test d’intégration DOM utilisant un backend simulé. Ce test couvre IN/transfert/OUT hors ligne, reconstruction après fermeture, retour réseau et rendu des pages GPS/approbations/horaires/documents.
- `node --check` sur les JavaScript du client et le service worker.
- `npx expo install --check` : cohérence des dépendances Expo.
- Trois scripts SQL exécutés sur PUNCH, chacun dans une transaction annulée : `supabase/tests/workforce_workflows.sql`, `operations.sql`, `geofence_offline.sql`. Vérifient notamment isolation interentreprise sous le rôle authenticated, invitations, places réservées, GPS hors rayon, notifications, idempotence, heures hors ligne et dépendances en conflit.
- Aucun compte ni donnée de test conservé après ces scripts.

## Limites et travail restant

- Pas de test sur APK/iPhone réel, pas de validation terrain ni de validation réglementaire de paie. Le test DOM ne remplace pas un navigateur ou un appareil. Le téléchargement du navigateur de test a échoué dans cet environnement; le service worker doit être vérifié sur les appareils cibles.
- La synchronisation exige une application ouverte ou réouverte et une session serveur valide. Aucune promesse d’exécution immédiate lorsque le système suspend ou ferme l’app. Les punchs déjà enregistrés restent dans le journal.
- Les données locales peuvent disparaître si l’utilisateur efface les données du navigateur, désinstalle l’app ou perd l’appareil avant synchronisation. Une connexion préalable est requise pour préparer le cache.
- Les notifications sont internes à l’app; push système, SMS et envois automatiques de courriels ne sont pas activés.
- Les heures brutes conservées peuvent être en attente de validation GPS/hors ligne; la fermeture hebdomadaire bloque leur passage en paie tant qu’elles ne sont pas validées. Pauses/dîner, déductions, arrondis, registres CCQ et XLSX restent à implémenter et valider.
- Les corrections couvrent les bornes de session. Les modifications internes d’une journée multijobs et la réconciliation de conflits complexes nécessitent un écran dédié.
- Google/Apple : code préparé mais configuration des fournisseurs et des retours native/OAuth toujours requise. Stripe, prorata de places, portail, webhooks, sursis automatique et Super Admin commercial restent à construire/configurer. Les invitations restent bloquées tant que le serveur ne confirme pas un abonnement actif et des places.
- Permissions personnalisées et approbations déléguées aux chefs, photos de cartes CCQ/chantier, catalogue matériel multiligne, pièces jointes/vocaux/messages lus/push, tâches et rapports complets restent à compléter.
- Clair/sombre/auto et dix langues, météo réelle, design final et comparaisons visuelles aux références, site commercial et distribution APK/TestFlight restent à compléter.
- Export complet, sauvegardes et restauration testée restent à construire. Le CSV des heures ne constitue pas une sauvegarde complète.
- Région Supabase actuelle US East; traitement des données personnelles et choix d’hébergement à valider avant commercialisation.

## Revue sécurité

Toutes les nouvelles tables publiques ont RLS. Le journal d’audit n’accorde aucun droit d’écriture aux clients. Les invitations sont dans un schéma privé sans politique client, volontairement inaccessible. Les RPC privilégiées contrôlent identité, compagnie, rôle et état de facturation; leurs avertissements SECURITY DEFINER dans l’advisor sont attendus mais doivent être réévalués à chaque changement. Le stockage des plans est privé; aucune politique client ne permet d’écraser ou supprimer une révision publiée.

## Édition PUNCH Essentiel ajoutée

Une compagnie choisit maintenant **Essentiel** ou **Construction** à sa création. La version Essentiel utilise une interface claire blanc chaud/vert sauge, quatre onglets Punch/Heures/Horaire/Plus, un établissement unique et aucun numéro de job ni commande dans ses parcours. La création de commandes et de plans de chantier est également refusée côté serveur pour cette édition. Le registre de temps et la sécurité sont communs aux deux éditions; l’identifiant technique de l’établissement reste interne.

- Écrans principaux Essentiel codés pour Web et Expo. Les outils secondaires Expo réutilisent encore certains panneaux sombres : leur harmonisation zen reste à finaliser.
- Pauses **non payées explicitement saisies** : début/reprise, y compris dans le journal hors ligne; fermeture automatique d’une pause ouverte au PUNCH OUT. Les pauses payées et les règles de déduction automatiques ne sont pas décidées par cette version.
- Heures brutes, pauses saisies et heures nettes exportées séparément. Les pauses hors ligne attendent une validation du responsable avant fermeture de la semaine.
- Prix recommandés, non contractuels : Essentiel 19 CAD/mois pour 5 personnes, +3 CAD/personne; Construction 49 CAD/mois pour 5 personnes, +7 CAD/personne. Aucun paiement ni produit Stripe créé par cette livraison.
- Migrations `essential_edition_breaks` et `essential_labels` appliquées. Script transactionnel `supabase/tests/essential_breaks.sql` passé : création de l’édition, site interne, pause/reprise hors ligne, durée et idempotence, approbation et refus des commandes au niveau RLS.
- Le test DOM couvre aussi l’absence de commande/numéro de job et les quatre onglets Essentiel, ainsi que les contrôles de pause hors ligne.

## Décision Essentiel : mode mixte téléphone + tablette commune (conception, NON livré)

Référence détaillée : [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md).

- **Validé fonctionnellement** : une seule journée commune par employé entre son application personnelle et une tablette appairée à l'établissement ; NIP individuel masqué, durée de session d'écran courte, punch IN/PAUSE/REPRISE/OUT uniquement ; mêmes totaux, approbations et historiques.
- **Employé** : conserve l'interface zen blanc chaud/vert sauge `Punch · Heures · Horaire · Plus`. **Admin** : gestion des identifiants salariés, des bornes et des anomalies, sans punch personnel. **Boss** : contrôle global, permission des modes, santé des appareils, abonnements et exports.
- **Non codé à la date du document** : dossier salarié sans compte Auth obligatoire, NIP haché et vérification rate-limitée, jeton et appairage de borne, écran kiosque, synchronisation interappareils avec attribut canal, hors ligne kiosque et leurs tests. Le journal hors ligne mobile existant ne doit pas être présenté comme preuve de fonctionnement d'une borne partagée.
- **Facturation** : borne non comptée comme membre actif ; forfait Essentiel inchangé. Après restriction, les salariés actifs doivent conserver le pointage sur les appareils préalablement autorisés, pas les fonctions d'administration.

## Essentiel — compte personnel facultatif pour les salariés utilisant l'iPad
- **Décision approuvée** : un salarié pointant sur une tablette commune peut créer un compte personnel PUNCH Essentiel pour consulter horaire, heures, congés et notifications, sans être obligé de puncher sur son téléphone.
- **À développer, non livré** : invitation personnelle à usage unique, liaison sûre `auth_user_id` → `worker_id` existant (et conservation des anciennes heures), distinction entre permission de punch mobile et permission de consultation, états d'activation du compte, 20 thèmes Essentiel synchronisés.
- **Facturation** : même salarié = une place, iPad commun non facturé comme membre ; accès mobile facultatif et sans double décompte.
- **Tests prioritaires** : historique acquis sur iPad visible après inscription personnelle, activation sans duplication, refus d'association frauduleuse, mode mobile lecture seule si entreprise tablette seulement, aucun effet de la désactivation du compte sur le temps officiel.
- Spécification : [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md).


### Décision ajoutée : accès personnel à l'horaire même avec iPad commun (NON codé)
La compagnie peut activer **iPad seulement pour pointer**, mais offrir à chaque salarié existant un compte Android/iOS/Web **pour consulter son horaire et ses heures**, demander des congés et recevoir des alertes. Création de compte par invitation liée au dossier salarié interne (Google/Apple/email), sans dupliquer la place payante, sans activer Punch mobile. L'employé sans téléphone continue à pointer sur l'iPad. Les droits séparés `can_kiosk_punch` / `can_mobile_punch` / `can_view_personal_schedule` doivent être imposés côté serveur. Design personnel parmi 20 thèmes Essentiel; design borne uniforme. **Spécifié seulement, pas encore implémenté.** Voir [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md).
