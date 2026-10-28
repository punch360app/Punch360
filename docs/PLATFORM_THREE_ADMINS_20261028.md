# PUNCH 360° — Trois comptes Super Admin

**Objectif :** un propriétaire principal conservé, jusqu'à deux Super Admins secondaires ayant les mêmes fonctions de gestion opérationnelle. Les privilèges sont stockés dans \`private.platform_owner\`, jamais dans un rôle entreprise ou une métadonnée Auth.

## Procédure après que la migration 20261028124000 est appliquée et vérifiée

1. Dans Supabase PUNCH **exclusivement** (\`mlabstdxxwjdpfaxiwmg\`) → Authentication → Users, créer deux comptes Auth distincts, avec leur propre courriel, des mots de passe individuels robustes, et confirmer chaque courriel. Ne pas partager le mot de passe du propriétaire.
2. Se connecter au PUNCH Web avec le propriétaire principal existant, activer ou vérifier son MFA (code six chiffres, session AAL2).
3. Ouvrir la console **SUPER ADMIN → 3 Super Admins**. La liste serveur montre 1 / 3 au départ. Saisir le courriel confirmé du premier compte secondaire, un motif de 8 à 500 caractères et la confirmation exacte \`AJOUTER courriel@domaine\`, puis autoriser l'accès. Répéter avec le deuxième : 3 / 3.
4. Chaque personne se connecte séparément, configure son propre MFA et atteint la console. Un compte sans session MFA actuelle ne peut pas exécuter les actions sensibles.
5. Seul le propriétaire principal peut retirer un des deux comptes (motif + confirmation exacte \`RETIRER courriel@domaine\`). Les droits serveur cessent immédiatement; les dossiers Auth, les entreprises, les pointages, les factures et les contrats ne sont pas effacés. La racine d'origine ne peut pas être retirée par ce menu.

## Préconditions / limites de sécurité

- **Aucun compte secondaire n'est promu par la migration seule.** L'identité et le courriel des deux personnes doivent être décidés par le propriétaire.
- Les RPC \`public.platform_admin_members\`, \`platform_admin_add\` et \`platform_admin_remove\` exigent l'accès plateforme avec Auth live + MFA AAL2. Les mutations exigent en plus \`owner_role='root'\`, utilisent un verrou SQL pour plafonner à trois comptes et inscrivent un événement dans l'audit privé.
- Les comptes de test, courriels non confirmés, utilisateurs suspendus/supprimés et comptes déjà Super Admin sont refusés. Aucun écran ni bouton ne contourne ces contrôles.
- Après l'application de migration, valider \`supabase/tests/platform_three_super_admins.sql\` dans une transaction entièrement annulée, puis tester sur deux nouveaux comptes réels approuvés avant de conclure à une livraison complète.
- Un compte secondaire dispose des droits opérationnels de la plateforme (les fonctions héritées consultent la même table serveur) mais pas du droit de promouvoir/révoquer d'autres Super Admins. Le propriétaire principal reste le seul administrateur des administrateurs.
