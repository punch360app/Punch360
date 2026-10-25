# Super Admin — audit actif du 25 octobre 2026

La console Web reste séparée des espaces entreprise. Le propriétaire plateforme est une liaison serveur immuable et non un courriel/claim modifiable. Le lot présent renforce assert_platform_owner : rôle serveur, JWT aal2 ET session Auth existante, aal2, non expirée. Les anciens appels catalogue, snapshot et création d’entreprises test héritent de ce contrôle; les modules récents conservaient déjà un contrôle de session vivante. Aucun rôle entreprise, prix ou contrat n’est modifié par ce renforcement.

## Répertoire des entreprises

Recherche serveur par nom/identifiant, édition, réel/test et état; pages de 50 avec curseur date/UUID, sans limite totale de 200 résultats. Les filtres appliqués restent stables entre pages; une requête échouée ne déplace pas l’historique. Accès aux archives de l’entreprise sélectionnée, y compris au-delà des 200 entreprises du snapshot initial, avec affichage de sa sélection. Le bouton ne déclenche aucun export/restauration. L’ancien libellé fixe « Stripe non configuré » est retiré du répertoire; contrats et rapports sont consultables dans leurs sections.

Migration platform_session_and_search appliquée. Test SQL platform_session_search : 56 entreprises fictives, parcours 50+6 sans doublon même date, filtres, non-propriétaire, session expirée et session supprimée. Les tests legacy utilisent désormais une vraie ligne de session synthétique dans leur transaction annulée; huit régressions réussies (catalogue salariés, outils test, horaires, échanges, communications, limites de forfait, paie, RH). 124 tests Node/DOM et TypeScript, dont historique de pagination, filtres, erreurs et sélection d’archives.

Web essential-35 : PR/CI à vérifier. Aucune donnée officielle modifiée par les scénarios; toutes les fixtures sont annulées. Pas de validation appareil.

## Inventaire réel des actions

| Domaine | État développé et preuves | Manques toujours ouverts |
|---|---|---|
| Entreprises | Snapshot, annuaire paginé, filtres, archives signées, entreprises fictives, équipes test | Fiche détaillée complète, paramètres commerciaux par client, suspension/réactivation explicites et sûres |
| Utilisateurs | Comptes test : création, suspension, suppression d’accès, réinitialisation, coffre chiffré et audit PR #11 | Annuaire global paginé des utilisateurs réels, recherche par entreprise, actions réelles avec gardes et audit |
| Abonnements | Contrats confirmés, factures, états et événements Stripe | Recherche/pagination complètes, recette fournisseur, annulation/reprise/rapprochement |
| Fonctions et tarifs | Catalogue versionné, motifs, MFA, contrats existants préservés | Conditions particulières par client et recette fournisseur |
| Support | Demandes/réponses, statuts, pagination et isolation PR #12 | Recette multi-utilisateur terrain et notification externe |
| Promotions | Brouillons, publication/désactivation test/réel, reprise PR #13 | Recette Stripe test sur vrais objets fournisseur |
| Sécurité | MFA, liaison propriétaire, session vivante commune, RLS et tests | Audit indépendant, appareils, revue complète des actions service-only et confidentialité |
| Audit et exports | Recherche/pagination/détails/CSV; rapports Québec réel/test; archives applicatives | Charge/concurrence réelle, exports transverses complets, PRA infrastructure et recette PDF connectée |

Le Super Admin complet et le prompt global ne sont pas déclarés terminés. Prochaine étape : annuaire des utilisateurs réels et fiche d’entreprise, puis actions restantes en préservant paiements, comptes et continuité du pointage.
