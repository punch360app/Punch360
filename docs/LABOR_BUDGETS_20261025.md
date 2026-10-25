# Budgets de main-d’œuvre — 25 octobre 2026

Budget en cents CAD pour une semaine commençant le lundi, entreprise entière ou département actif de la compagnie. Permission Rémunération et module labor_costs côté serveur pour lecture et comparaison; mutation réservée aux gestionnaires autorisés. Version attendue et verrou transactionnel par périmètre empêchent les remplacements silencieux. Chaque sauvegarde et comparaison est auditée.

Les comparaisons conservent budget/version, estimation paie/version des règles, fuseau, état de fermeture et lignes sources. Le moteur de paie reste inchangé. Un taux manquant ou une session ouverte donne un coût/écart inconnu, avec somme partielle connue affichée séparément. Planification : heures brutes, incluant quarts vacants, sans pause planifiée ni coût planifié certifié. Aucun export certifié fournisseur paie ni retenue/charge calculée par ce lot.

Tests : scénario SQL essential_labor_budgets sur fixtures en rollback : huit heures à 25 $ = 200 $, budget 150 $, écart 50 $, refus de version périmée, comparaison immuable, taux manquant, admin sans Rémunération, RLS employé. Tests Node : cents/décimales, version envoyée, résultat incomplet, échappement, double soumission et réponse tardive après déconnexion. TypeScript : source Expo seulement. Les essais appareils/charge/concurrence multiconnexion et la recette connectée restent ouverts.

Deux migrations appliquées sur le projet exclusif; la politique SELECT emploie essential_member_feature déjà autorisé, plutôt qu’exposer essential_feature. Aucun paiement/SMS/courriel réel ni changement d’heures officielles pendant les tests.
