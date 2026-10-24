# Corrections de pauses — 24 octobre 2026

Parcours Web/Expo relié au Supabase officiel `mlabstdxxwjdpfaxiwmg`, migration `20261024234057`. Disponible dans Heures/Plus côté salarié et dans la console opérationnelle côté Admin/Boss. Construction conserve ses parcours et ses règles existantes.

Une demande peut ajouter une pause oubliée ou changer les bornes et le caractère payé/non payé d’une pause terminée. Elle conserve le motif, l’auteur, les valeurs originales, la proposition et la décision. Aucune valeur officielle ne change avant approbation. Le salarié peut annuler sa demande en attente; le gestionnaire peut proposer pour une personne sans compte personnel. Le demandeur et le salarié concerné ne peuvent approuver leurs propres demandes/heures.

Les RPC vérifient côté serveur la compagnie, l’identité salariée stable, la permission, la session terminée, le fuseau explicite, les bornes, l’absence de chevauchement et la période ouverte. Les demandes sont idempotentes par UUID; les clients conservent l’identifiant et l’empreinte avant l’envoi. Un résultat réseau incertain exige une reprise avec les mêmes valeurs, sans créer un deuxième mouvement officiel.

Une décision vérifie les valeurs originales pour refuser une demande devenue périmée. Verrouillage commun avec les fermetures hebdomadaires et corrections de sessions. La fermeture refuse les demandes de pauses en attente et les pauses incohérentes. Une correction ultérieure de journée terminée ne peut laisser une pause hors de la journée. L’historique n’est pas effacé lors d’un refus ou d’une annulation.

RLS : lecture limitée au demandeur, au salarié concerné ou aux responsables de la même compagnie; aucune écriture directe client. Les fonctions publiques n’accordent aucun accès anonyme. Les accès restent indépendants des modules avancés du forfait.

Validation : 61 tests Node/DOM, TypeScript, 20 scripts SQL dans des transactions annulées, exports Metro Android et iOS réussis. Le nouveau script SQL couvre l’absence d’effet avant approbation, les reprises idempotentes, les chevauchements, les autoapprobations, les périodes fermées, l’audit original, les demandes périmées et l’isolation intercompagnie. Les régressions existantes de borne, pauses, journal, Construction et paie passent.

Limites : pas de compilation APK/IPA signée ni d’exécution physique. Formulaires de dates avec fuseau explicite; sélecteurs natifs de date/heure à améliorer. Interfaces limitées à 100 journées/demandes récentes et 1 000 pauses associées. Pas encore de suppression d’une pause via ce parcours, ni de saisie intégrale d’une journée oubliée. Les politiques de pauses par département et les notifications de décision restent à compléter. La fermeture existante conserve son fuseau Québec. Aucun SMS ni paiement réel déclenché.
