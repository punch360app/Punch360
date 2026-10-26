# P0-A / issue #35 — isolation du parcours Boss de facturation

**26 octobre 2026 — lot ciblé, PR en cours.** Reprise du `docs/prompt-board/WORK_START.md` et du maître unique (578 IDs / 29 lots). Aucun second catalogue, aucune suppression de fonctions acquises.

## Écart concret corrigé

La PR #87 protégeait la **console Super Admin** contre les réponses tardives, mais pas le contrôleur **Boss** `web/live/billing.js`. Pendant un devis de tarif particulier, un prorata Stripe, la consultation du portail ou l'enregistrement d'une commande, une déconnexion ou un changement de compagnie pouvait laisser une réponse asynchrone remplir l'écran suivant ou tenter d'ouvrir un ancien portail.

Le contrôleur Boss utilise désormais un numéro de révision et l'identifiant de compagnie capturés **au départ de chaque action**. Chaque réponse asynchrone est vérifiée avant mise à jour d'état, affichage ou nouvel appel fournisseur. Lors de `reset()` et `load(company)`, le devis, la commande, l'offre, les factures et les états intermédiaires sont effacés. Une ancienne opération ne peut pas libérer la nouvelle opération du nouvel écran. Les réponses tardives n'entraînent pas de nouveaux appels de prévisualisation Stripe.

Dans `supabase/functions/essential-billing/index.ts`, l'erreur de `billing_service_context` n'est plus renvoyée textuellement au navigateur; refus public stable `CONTRACT_ACCESS_DENIED`. La vérification d'autorisation côté serveur, les identifiants de société et les règles RLS existants demeurent. **Une écriture Stripe ou RPC déjà transmise ne peut pas être annulée par l'interface; le serveur reste l'autorité.**

## Preuves et états séparés

| Périmètre | Développé | Testé | Déployé | Intervention externe |
|---|---|---|---|---|
| Isolement des réponses Boss entre sociétés | Oui, `web/live/billing.js` | Trois nouveaux scénarios Node/DOM, CI à vérifier | Non tant que PR non fusionnée et Pages non vérifiées | Recette Android/iOS/iPad |
| Refus Edge sans diagnostic SQL brut | Oui, `essential-billing/index.ts` | Relecture de code, test Edge déployé à vérifier | **Non** : la version 1 précédente est encore ACTIVE sur Supabase | Déploiement contrôlé de l'Edge Function puis recette |
| Tarif particulier complet #35 | Partiel : devis et acceptation déjà codés avant ce lot | SQL rollback et tests logiciels historiques; Stripe fournisseur NON validé | Code partiel sur la plateforme | Stripe sandbox : produits/prix réels, calcul du prorata, taxes, webhook signé, doubles événements, facture, renouvellement et annulation |

Tests ajoutés dans `tests/billing-tenant-isolation.test.mjs` : (1) ancienne commande négociée après changement de société n'entraîne **aucun** appel Stripe, (2) devis fournisseur tardif n'affiche rien dans l'autre compagnie ni ne débloque une nouvelle action, (3) URL du portail Stripe d'une ancienne session ne s'ouvre pas après déconnexion. La suite existante `tests/billing-ui.test.mjs` reste en place.

**Inventaire de prudence** : le projet Supabase officiel `mlabstdxxwjdpfaxiwmg` est ACTIVE_HEALTHY; `essential-billing` est ACTIVE v1 (la fonction modifiée dans GitHub n'est pas installée automatiquement). L'historique des migrations distant et les fichiers GitHub ne correspondent pas terme à terme (95 migrations répertoriées à distance contre 94 fichiers versionnés). **Aucune migration réappliquée**, aucune modification de données. Réconcilier l'historique avant toute future DDL.

## Prochaines tâches, sans refaire le livré

1. Vérifier `npm test`, `npm run check`, le statut PR et GitHub Pages. Sans CI verte ni publication contrôlée, conserver l'état « non déployé ».
2. Examiner et déployer séparément la modification de `essential-billing` sur l'unique projet autorisé, avec vérification `verify_jwt` et test négatif Auth. Ne jamais révéler de secret dans les journaux.
3. Exécuter **uniquement en mode Stripe test**, sur entreprises fictives et avec autorisations fournisseur : les prix (3 × 2 cadences), versions de contrats, devis fournisseur, proratas, taxes, idempotence, webhook et rejets; ne pas annoncer #35 terminé avant preuves.
4. Puis P0-B facturation, P0-C rôles, P0-D Google/Apple/SMTP, et enfin les P1 prévus dans le maître. **SMS/Twilio reste dernier**.

Aucun compte, contrat, paiement, PDF ou pointage de client réel n'a été touché pendant ce lot.
