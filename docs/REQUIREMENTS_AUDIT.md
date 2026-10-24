> Dix thèmes personnels 11–20 : [ESSENTIAL_THEMES_20261024.md](ESSENTIAL_THEMES_20261024.md). Galerie Web/Expo et préférence Supabase livrées; SMS reportés à la fin à la demande de l’utilisateur.

> État actualisé : [ESSENTIAL_BILLING_20261024.md](ESSENTIAL_BILLING_20261024.md). Facturation Web/Expo et accès borne développés; configuration et recette Stripe réelle non validées. Le prompt complet reste ouvert.

> Audit actualisé pour l’organisation et les horaires : [ESSENTIAL_PLANNING_20261024.md](ESSENTIAL_PLANNING_20261024.md). Ce document antérieur conserve les constats historiques; le produit complet n’est pas déclaré terminé.

# Audit PUNCH — 24 octobre 2026

## Sources et portée

Référence : `SPEC_COMPLETE.md` (conception consolidée du 23 octobre), migrations, code Web/Expo et demandes visibles du 24 octobre. La recherche de contexte n’a pas retrouvé le texte intégral de l’autre conversation. Cet audit ne prétend donc pas certifier une relecture intégrale de cette conversation ni une validation terrain de paie.

Les statuts « codé » signifient présent dans le dépôt et vérifié avec les contrôles indiqués, pas certifié en production. Stripe a été explicitement reporté par l’utilisateur.

## Séparation des espaces livrée

| Profil | Interface | Fonction |
|---|---|---|
| Boss | Direction, navigation latérale sur PC, navigation compacte sur mobile | Gestion des employés, jobs, équipes, horaires, approbations, GPS, documents, messages. Accès volontaire à son punch, retour à la direction. |
| Admin | Bureau clair bleu/gris, sans photo chantier, météo, chronomètre, commandes personnelles ni bouton punch | Gestion opérationnelle et heures de l’équipe. Punch et pauses refusés par les trois points d’entrée API. |
| Employé / Chef | Interface terrain Construction ou zen Essentiel | Punch, heures personnelles, commandes Construction, messages, profil. Le Chef conserve les droits d’équipe déjà vérifiés par le serveur. |

Implémentations : Web `managementBase`, Expo `ManagementWorkspace`. Les outils secondaires Expo réutilisent des panneaux opérationnels sombres; leur palette n’est pas encore uniformément claire. Les vues de gestion ne constituent pas un produit fini de paie.

## Couverture du cahier des charges

| Exigence | État constaté | Limite ou travail restant |
|---|---|---|
| Marque, site de vente responsive, connexion en haut, choix Essentiel/Construction | Codé Web | Pas de validation visuelle exhaustive de toutes tailles et zooms |
| Principal sans scroll; détails/listes défilants | Parcours d’inscription réparti par étapes; gestion responsive | L’ensemble des anciens onglets terrain nécessite encore revue visuelle sur appareils |
| Clair/sombre/auto et 10 langues | Incomplet | FR, palettes par édition/rôle; pas de traduction complète/auto |
| Google, Apple, courriel | Courriel et Google intégrés; compte Boss observé en base | Apple désactivé; connexion Google complète et livraison courriel à confirmer par utilisateur |
| Boss crée entreprise; invité rejoint compagnie/rôle exact | Codé Web/Expo + RPC | Paiement actif requis pour inviter; pas d’envoi automatique SMS/courriel |
| Espaces Boss/Admin/Employé distincts | Codé dans cette livraison | Admin non pointant protégé côté serveur; aucun rôle réel modifié |
| IN/OUT, chronomètre, transfert sans interruption | Codé Web/Expo + transaction | Pas de validation APK/iPhone terrain |
| Journal hors réseau, synchronisation, conservation heure locale et réception | Codé et testé | App ouverte/réouverte et session valide; pas de garantie app fermée |
| Rayon GPS par chantier/établissement, alertes et approbations | Codé Web/Expo/SQL | Notifications internes; pas de push système |
| Anomalies doublon/chevauchement/GPS/hors ligne | Partiel | Longues journées/sortie oubliée et réconciliation de conflits avancée incomplets |
| Annuaire/recherche/filtres/itinéraires/fiche/archivage personnel | Codé | Carte Web reste indicative; carte native nécessite clés et binaire validé |
| Affichage prochaine affectation/photo chantier | Partiel | Revue du clic et composition finale; téléversement photo privé chantier incomplet |
| Mes heures / demandes / décision / audit | Codé | Corrections des bornes de session; édition interne multijob avancée incomplète |
| Fermeture/réouverture hebdomadaire | Codé et testé SQL | Contrôles GPS, pauses, corrections et sessions ouvertes bloquent la fermeture |
| Export heures CSV | Codé, pagination | Filtres période/semaine/mois/job détaillés et XLSX incomplets |
| Pauses non payées explicites | Codé Web/Expo + journal | Dîner/déductions/arrondis payés configurables et règles réglementaires incomplets |
| Horaires, quarts, congés et conflits | Codé Web/Expo + RPC | Gestion des disponibilités avancée non prévue dans cette livraison |
| Équipes multiples, chefs, affectation à job | RPC et Expo présents; contrôles Web ajoutés | Permissions personnalisées/délégation d’approbation Chef incomplètes |
| Plans PDF privés/versionnés/confirmation lecture | Codé Web/Expo + Storage/RLS | Navigation historique complète et validation binaire à compléter |
| Commandes approbation/statuts | Codé | Catalogue, panier multiligne, quantités/photos et demandes libres complètes manquants |
| Messages groupes et privé Chef | Texte/RLS/groupes codés | Pièces jointes, vocaux, lus, push et stratégie cryptographique avancée manquants |
| Profil, contacts d’urgence, métadonnées CCQ | Codé | Photos profil/cartes recto-verso et revue accès documents personnels manquants |
| Météo réelle | Non branchée | Le placeholder terrain ne constitue pas une fonctionnalité terminée |
| Tarifs/places/prorata/webhooks/sursis/résiliation | Incomplet, reporté explicitement | Stripe et Super Admin commercial non intégrés; invitations payantes restent bloquées |
| Isolation multientreprise / RLS / audit | Implémenté et tests SQL | Pas un audit de sécurité indépendant; région et rétention à valider |
| Export complet/sauvegardes/restauration testée | Non livré | Le CSV d’heures n’est pas une sauvegarde complète; définir rétention et procédure restauration |
| APK/TestFlight et validation terrain | Non livré | Compilation/distribution/signatures et tests réels nécessaires |

## Vérifications de cette livraison

- TypeScript : `npm run check`.
- Tests journal/DOM/auth : `npm test` (9 tests). Ajout de contrôles des trois interfaces et absence de punch Admin.
- JavaScript : `node --check web/live/app.js` et `web/live/sw.js`; `git diff --check`.
- SQL : `supabase/tests/admin_office_role.sql`, exécuté en transaction annulée sous rôle `authenticated` : refus Admin en ligne/hors ligne/pauses; absence d’écriture de temps; gestion GPS Admin conservée; punch Employé et Boss conservés.
- Migration `admin_office_role` appliquée à PUNCH uniquement. Aucun utilisateur réel promu, rétrogradé ou supprimé.
- Advisor : APIs SECURITY DEFINER authentifiées intentionnelles avec contrôles; invitations privées sans politique client intentionnelles. Protection contre mots de passe compromis non activée dans la configuration Auth; ce réglage n’est pas modifié par la migration.

## Conclusion technique

La séparation des rôles est désormais implémentée. **La totalité du cahier des charges n’est pas implémentée.** Les lignes incomplètes ci-dessus doivent rester ouvertes et ne doivent pas être présentées comme terminées.
