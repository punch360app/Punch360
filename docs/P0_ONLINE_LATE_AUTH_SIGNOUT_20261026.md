# P0-C — Dernières réponses Auth après déconnexion (26 octobre 2026)

**Branche :** `fix/p0-online-late-auth-signout-20261026` ; référence initiale `main` 96bb919d30e6e48062dafdeb01c4d1d16e76e89b.

## Lacune constatée

La PR #118 bloquait la récupération **hors ligne** après `SIGNED_OUT`, mais la fonction `refresh()` utilisait encore un contrôle de révision sans drapeau de déconnexion pour ses retours **en ligne**. Une opération `getSession()`, `getUser()` ou `company_members` arrivée tardivement pouvait donc tenter de restaurer un espace si le travail avait débuté après la déconnexion. Un événement `INITIAL_SESSION`/`TOKEN_REFRESHED` tardif pouvait en outre remettre le drapeau à faux même en l'absence d'une nouvelle connexion valide.

## Changement

- Toutes les réponses asynchrones de `refresh()` doivent aussi respecter `!explicitlySignedOut`.
- Après une déconnexion explicite, seul un événement `SIGNED_IN` ou `PASSWORD_RECOVERY` **avec session** autorise une nouvelle vérification serveur des appartenances. Les autres événements n'enclenchent pas de restauration.
- Tests Node : table d'événements autorisés/refusés et garde sur retours réseau, en conservant les tests de la PR #118.

## Validation à poursuivre

- CI `PUNCH TypeScript` sur le SHA de cette branche, y compris tests Node/DOM et syntaxe Web.
- Recette physique Android/iPhone et 2 sociétés avec déconnexion pendant un appel réseau : **non effectuée**.
- Pas de migration, Edge déployée, paiement, donnée client ni modification de contrat.
- Le blocage P0 Stripe #35 demeure : migration `20261026110100` absente de Supabase officiel lors de la lecture seule du 26 octobre; ne pas déployer Edge concernées avant validation séparée.

**Rattachement maître :** SEC-017, QA-032 (**partiels**, pas de statut déployé).
