# Approbations déléguées — 25 octobre 2026

Le Boss peut accorder séparément les approbations d’heures (sessions, pauses et journées oubliées) et de congés à un superviseur actif, département par département. La planification conserve sa permission indépendante. Les attributions nécessitent un motif, une version attendue et produisent un audit. Aucun rôle de direction ou accès RH/rémunération n’est attribué.

Les quatre moteurs transactionnels existants restent utilisés, avec leurs gardes d’autoapprobation, de conflits et de fermeture de période. La boîte de réception expose seulement les demandes autorisées et leurs horaires, pauses, motifs et noms. Les tables privées de salariés ne reçoivent aucune nouvelle politique RLS. Limite affichée de 100 demandes récentes par catégorie. La révocation du périmètre ou la désactivation du membre efface les approbations; une réactivation ne les rétablit pas.

Les décisions d’heures, de pauses et de congés génèrent une notification interne pour les membres actifs concernés. Les notifications des journées oubliées et du hors ligne déjà livrées sont conservées. Il ne s’agit pas de push ni de courriels.

## État et preuves

- Développé : configuration Boss et boîte de réception Web/Expo; Web essential-30.
- Backend déployé : migrations supervisor_approval_scopes, supervisor_approval_bridges et approval_decision_notifications appliquées au projet officiel. Ne pas les rejouer.
- Testé : 108 tests Node/DOM et TypeScript; supervisor_approvals.sql sur fixtures avec rollback (permissions indépendantes, département, RLS des salariés, application réelle de correction, congés, notifications, révocation et désactivation). Régressions essential_break_corrections, essential_missing_days, workforce_workflows et essential_planning réussies après les migrations.
- Web : PR/CI et déploiement à vérifier dans le suivi actif.
- Expo : source vérifiée par TypeScript, aucun build signé ni appareil déclaré validé.

Les demandes provisoires de la borne hors ligne restent réconciliées par Boss/Admin. Les préférences, push et courriels, l’audit de concurrence multiconnexion et la recette physique restent ouverts. Le prompt global n’est pas terminé.
