# Super Admin — suspension ciblée d'un membre réel (25 octobre 2026)

## Portée
Première action sur les **comptes réels**, limitée au **rattachement à une compagnie Essentiel précise**. Elle ne bloque pas l'identité Auth du salarié dans d'autres entreprises. Les identités propriétaires plateforme, les comptes tests, les Boss, l'auto-intervention et les comptes supprimés ne sont pas admissibles. Pour un Boss, traiter l'organisation et ses administrateurs via les contrôles de service existants et un protocole d'assistance distinct : ne pas improviser une désactivation du dernier responsable.

## Administration
- Aller dans Super Admin → Utilisateurs de la plateforme. Filtrer les résultats par UUID de la compagnie (obligatoire pour agir).
- Entrer un motif de 8 à 1000 caractères. Seules les recherches paginées auditées affichent les salariés; cliquer « Gérer dans cette compagnie » sur un compte réel, non propriétaire.
- Consulter l'aperçu serveur : membre, rôle, état, version, salarié, punch ouvert, éligibilité.
- Cliquer « Suspendre cet accès » ou « Rétablir cet accès ». Confirmer, puis recopier **exactement** `userUUID:companyUUID`. Le serveur vérifie de nouveau en transaction l'identité du propriétaire, le **MFA AAL2 avec session Auth vivante**, les cibles, le rôle, la version, l'état et la confirmation.
- Journal privé : auteur, UUID de l'entreprise, UUID utilisateur, action, versions, raison. Jamais de mot de passe, d'empreinte Auth, de cookie ou de jeton.

## Garanties et limitations
- Refuser une suspension lorsqu'un punch du membre est encore ouvert. Fermer les heures normalement avant l'intervention.
- Suspension : désactiver **uniquement** son appartenance à cette compagnie; supprimer mobile/borne/accès personnel; déclencher les protections de synchronisation salariale déjà présentes. Ne supprimer ni horaires, ni heures, ni paie, ni compte Auth, ni contrat Stripe.
- Rétablissement : vérifier le même salarié et le même rôle, les champs inchangés et la version attendue; restaurer les indicateurs et l'état salarié **capturés avant suspension**, même quand le trigger de synchronisation a mis le salarié en `disabled`.
- Les appareils de notifications push peuvent être révoqués automatiquement par les triggers de départ existants : une nouvelle inscription push peut être nécessaire après rétablissement.
- Si le salarié a été modifié par un autre responsable, **refuser le rétablissement automatique** et exiger une vérification manuelle; jamais de restauration forcée.
- Les Boss ne sont pas ciblables par cette action, ainsi que Construction et les compagnies test. L'API conserve les permissions des autres compagnies.
- Un utilisateur Auth banni/supprimé reste soumis aux règles Auth; cette action ne rétablit aucun mot de passe et ne contourne pas Auth.
- Les places et paiements Stripe ne sont pas modifiés. Le nombre de membres actifs peut évoluer; le nombre de places contractuelles et le montant restent régis par la facturation.

## Code et validation
- Migration : `supabase/migrations/20261025213000_platform_real_member_access.sql`
- Scénario : `supabase/tests/platform_real_member_access.sql` (fixtures synthétiques, transaction et rollback)
- Interface : `web/live/platform-users.js` ; tests : `tests/platform-users.test.mjs`
- Recette SQL sous rollback **réussie** après correction de la synchronisation membre→salarié, avec vérification multi-entreprise, confirmation incorrecte, version périmée, permissions refusées, flags restitués et audit.
- À la rédaction : CI GitHub et publication encore à confirmer; essais manuels MFA et rôle réel non exécutés. Aucun salarié réel modifié.

## Restant pour achever Super Admin
- Traiter les interventions sur **Boss** via un protocole de succession administrative approprié.
- Gestion globale d'Auth : récupération de compte **sans dévoiler les mots de passe**, vérification de session et révocation de session via APIs adaptées; une suspension de connexion Auth seule n'invalide pas immédiatement les anciens JWT.
- Tarifs commerciaux particuliers Essentiel par client avec prévisualisation, compatibilité Stripe et historique des contrats; tests sandbox.
- QA d'une compagnie fictive en navigateur authentifié, iPad/Android, charge, notification et procédures d'assistance.
