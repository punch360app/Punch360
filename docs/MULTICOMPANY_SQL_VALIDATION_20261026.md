# Recette SQL — une identité dans deux compagnies distinctes

## Objet
Contrôler les permissions **réelles** du Supabase officiel pour une personne qui travaille à la fois pour une compagnie A comme **employé** et dans une compagnie B comme **administrateur**, ainsi que deux Boss indépendants et une personne extérieure. La recette protège la fonctionnalité de changement d'entreprise Web/Expo (PR #68) contre les lectures/mutations interentreprises.

## Fichier de recette
`supabase/tests/multicompany_rls_isolation.sql`.

Le scénario démarre avec `BEGIN`, crée **uniquement des utilisateurs et compagnies fictifs** sous le suffixe `@multitenant-fixture.invalid`, alterne plusieurs identités authentifiées via `SET LOCAL ROLE authenticated` et `request.jwt.claim.sub`, puis finit avec `ROLLBACK`.

Les assertions bloquent la transaction si :
- les deux fiches salariées du même compte Auth ne sont pas distinctes (un worker ID par entreprise);
- le Boss A voit les salariés ou les quarts B, ou parvient à créer un quart dans B;
- le Boss B voit les quarts A;
- l'employé A / Admin B ne retrouve pas les deux appartenances et ses horaires autorisés dans chaque entreprise;
- le salarié B voit les horaires A ou les horaires privés de son collègue B;
- un utilisateur extérieur voit les compagnies ou les quarts;
- un simple employé peut s'attribuer le rôle Boss par écriture directe.

**Exécution le 26 octobre 2026** : test transactionnel réussi dans le seul projet Supabase officiel `mlabstdxxwjdpfaxiwmg`, sans migration ni modification réelle persistante. La première tentative a révélé une erreur dans l'identité utilisée pour configurer le salarié fictif A; la configuration a été corrigée pour utiliser le Boss A avant le test final réussi.

## Règles de produit
Un compte personnel peut apparaître dans plusieurs entreprises, mais les rôles, fiches RH, horaires, factures, paramètres et accès restent isolés par `company_id`. Un responsable ne reçoit pas d'accès aux autres employeurs du salarié. Aucun transfert d'entreprise ou d'identité Auth n'a lieu lorsqu'il change d'espace.

Restent à valider sur véritables appareils : changement pendant une conversation, notifications poussées, cache hors ligne, double pointage dans deux compagnies, révocation pendant session et sélecteur de la borne. **Les tests SQL ne certifient pas à eux seuls ces parcours utilisateur.**
