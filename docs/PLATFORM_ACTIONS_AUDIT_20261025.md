# Super Admin — audit actif du 25 octobre 2026

La console Web reste séparée des espaces entreprise. Le propriétaire plateforme est une liaison serveur immuable et non un courriel/claim modifiable. Le lot présent renforce assert_platform_owner : rôle serveur, JWT aal2 ET session Auth existante, aal2, non expirée. Les anciens appels catalogue, snapshot et création d’entreprises test héritent de ce contrôle; les modules récents conservaient déjà un contrôle de session vivante. Aucun rôle entreprise, prix ou contrat n’est modifié par ce renforcement.

## Répertoire des entreprises

Recherche serveur par nom/identifiant, édition, réel/test et état; pages de 50 avec curseur date/UUID, sans limite totale de 200 résultats. Les filtres appliqués restent stables entre pages; une requête échouée ne déplace pas l’historique. Accès aux archives de l’entreprise sélectionnée, y compris au-delà des 200 entreprises du snapshot initial, avec affichage de sa sélection. Le bouton ne déclenche aucun export/restauration. L’ancien libellé fixe « Stripe non configuré » est retiré du répertoire; contrats et rapports sont consultables dans leurs sections.

Migration platform_session_and_search appliquée. Test SQL platform_session_search : 56 entreprises fictives, parcours 50+6 sans doublon même date, filtres, non-propriétaire, session expirée et session supprimée. Les tests legacy utilisent désormais une vraie ligne de session synthétique dans leur transaction annulée; huit régressions réussies (catalogue salariés, outils test, horaires, échanges, communications, limites de forfait, paie, RH). 124 tests Node/DOM et TypeScript, dont historique de pagination, filtres, erreurs et sélection d’archives.

Web essential-35 : PR/CI à vérifier. Aucune donnée officielle modifiée par les scénarios; toutes les fixtures sont annulées. Pas de validation appareil.

## Inventaire réel des actions

| Domaine | État développé et preuves | Manques toujours ouverts |
|---|---|---|
| Entreprises | Snapshot, annuaire paginé, filtres, archives signées, entreprises fictives, équipes test | Fiche en consultation développée dans le lot suivant; paramètres commerciaux par client, suspension/réactivation explicites et sûres |
| Utilisateurs | Comptes test : création, suspension, suppression d’accès, réinitialisation, coffre chiffré et audit PR #11 | Annuaire global et recherche entreprise développés dans le lot suivant; actions réelles avec gardes et audit restantes |
| Abonnements | Contrats confirmés, factures, états et événements Stripe | Recherche/pagination complètes, recette fournisseur, annulation/reprise/rapprochement |
| Fonctions et tarifs | Catalogue versionné, motifs, MFA, contrats existants préservés | Conditions particulières par client et recette fournisseur |
| Support | Demandes/réponses, statuts, pagination et isolation PR #12 | Recette multi-utilisateur terrain et notification externe |
| Promotions | Brouillons, publication/désactivation test/réel, reprise PR #13 | Recette Stripe test sur vrais objets fournisseur |
| Sécurité | MFA, liaison propriétaire, session vivante commune, RLS et tests | Audit indépendant, appareils, revue complète des actions service-only et confidentialité |
| Audit et exports | Recherche/pagination/détails/CSV; rapports Québec réel/test; archives applicatives | Charge/concurrence réelle, exports transverses complets, PRA infrastructure et recette PDF connectée |

Le Super Admin complet et le prompt global ne sont pas déclarés terminés. Prochaine étape : annuaire des utilisateurs réels et fiche d’entreprise, puis actions restantes en préservant paiements, comptes et continuité du pointage.

## Annuaire utilisateurs et fiche entreprise — lot suivant

Web essential-36 : annuaire global paginé des utilisateurs réels/test, recherche courriel/UUID, filtre par entreprise et état. Un motif est obligatoire pour chaque consultation et chaque page est auditée sans enregistrer le texte de recherche ni les courriels dans cet événement. Réponses minimales : UUID, courriel, confirmation, dates de compte/connexion, suspension/suppression, classification test/propriétaire et nombre d’appartenances actives. Aucun hash de mot de passe, téléphone, token ou metadata Auth.

Fiche entreprise : places, membres actifs/désactivés, dossiers salariés avec/sans compte, modules contractuels, état d’abonnement et contrat confirmé. Les données membres/contacts/RH ne sont pas retournées par la fiche. Les lectures ne modifient ni paiement, rôle ni tarif. Les utilisateurs sans date de création historique sont ordonnés avec une date stable (époque), afin de conserver la pagination.

Backend : platform_user_directory et platform_user_legacy_dates appliquées. SQL dédié : 52 utilisateurs fictifs, pages 50+2, motif requis, absence de secrets/métadonnées, filtre entreprise, fiche, audit et refus du membre non propriétaire. 126 tests Node/DOM et TypeScript : motif, filtres appliqués, effacement des résultats après refus de session, sélection/fiche sans mutation. Publication PR/CI à vérifier; console Super Admin développée Web, aucun appareil déclaré validé.

L’annuaire et la fiche sont en consultation. Les actions sur utilisateurs réels, conditions particulières, suspension/réactivation commerciale et pagination des abonnements restent à compléter. Aucun accès utilisateur réel ou tarif officiel n’a été changé pendant les tests.


Contrôles de service Essentiel développés : suspension/réactivation de gestion et sursis client, MFA/version/UUID/motif, audit, pointage conservé et filtre calculé. Deux migrations appliquées, 137 tests et SQL rollback; publication à vérifier. Voir PLATFORM_SERVICE_CONTROLS_20261025.md. Conditions tarifaires particulières et actions utilisateurs réels non clôturées.
