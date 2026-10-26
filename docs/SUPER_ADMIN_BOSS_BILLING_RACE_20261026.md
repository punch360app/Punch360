# P0-A / issue #35 — isolation du parcours Boss de facturation

**26 octobre 2026 — lot ciblé, PR #89 fusionnée et vérifiée.** Reprise du `docs/prompt-board/WORK_START.md` et du maître unique (578 IDs / 29 lots). Aucun second catalogue, aucune suppression de fonctions acquises.

## Écart concret corrigé

La PR #87 protégeait la **console Super Admin** contre les réponses tardives, mais pas le contrôleur **Boss** `web/live/billing.js`. Pendant un devis de tarif particulier, un prorata Stripe, la consultation du portail ou l'enregistrement d'une commande, une déconnexion ou un changement de compagnie pouvait laisser une réponse asynchrone remplir l'écran suivant ou tenter d'ouvrir un ancien portail.

Le contrôleur Boss utilise désormais un numéro de révision et l'identifiant de compagnie capturés **au départ de chaque action**. Chaque réponse asynchrone est vérifiée avant mise à jour d'état, affichage ou nouvel appel fournisseur. Lors de `reset()` et `load(company)`, le devis, la commande, l'offre, les factures et les états intermédiaires sont effacés. Une ancienne opération ne peut pas libérer la nouvelle opération du nouvel écran. Les réponses tardives n'entraînent pas de nouveaux appels de prévisualisation Stripe.

Dans `supabase/functions/essential-billing/index.ts`, l'erreur de `billing_service_context` n'est plus renvoyée textuellement au navigateur; refus public stable `CONTRACT_ACCESS_DENIED`. La vérification d'autorisation côté serveur, les identifiants de société et les règles RLS existants demeurent. **Une écriture Stripe ou RPC déjà transmise ne peut pas être annulée par l'interface; le serveur reste l'autorité.**

## Preuves et états séparés

| Périmètre | Développé | Testé | Déployé | Intervention externe |
|---|---|---|---|---|
| Isolement des réponses Boss entre sociétés | Oui, `web/live/billing.js` (PR #89) | Trois nouveaux scénarios Node/DOM, CI TypeScript/Node/syntaxe **verte** | **Oui, GitHub Pages après fusion** | Recette authentifiée Android/iOS/iPad |
| Refus Edge sans diagnostic SQL brut | Oui, `essential-billing/index.ts` | Compilation CI et comparaison exacte avec ancien code; recette authentifiée à faire | **Oui, Supabase `essential-billing` v2 ACTIVE, `verify_jwt=true`** | Test négatif Auth, recette réelle fournisseurs; adaptateur Stripe déployé inchangé |
| Tarif particulier complet #35 | Partiel : devis et acceptation déjà codés avant ce lot | SQL rollback et tests logiciels historiques; Stripe fournisseur NON validé | Code partiel sur la plateforme | Stripe sandbox : produits/prix réels, calcul du prorata, taxes, webhook signé, doubles événements, facture, renouvellement et annulation |

Tests ajoutés dans `tests/billing-tenant-isolation.test.mjs` : (1) ancienne commande négociée après changement de société n'entraîne **aucun** appel Stripe, (2) devis fournisseur tardif n'affiche rien dans l'autre compagnie ni ne débloque une nouvelle action, (3) URL du portail Stripe d'une ancienne session ne s'ouvre pas après déconnexion. La suite existante `tests/billing-ui.test.mjs` reste en place.

**Inventaire de prudence** : le projet Supabase officiel `mlabstdxxwjdpfaxiwmg` est ACTIVE_HEALTHY; `essential-billing` est ACTIVE **v2**, avec source relue contenant `CONTRACT_ACCESS_DENIED`. L'adaptateur Stripe déployé n'a pas été élargi lors du déploiement ciblé (ancienne validation des paramètres de requête), bien que le fichier partagé sur GitHub soit légèrement plus récent; la réconciliation fournisseur est ouverte. L'historique des migrations distant et les fichiers GitHub ne correspondent pas terme à terme (95 migrations répertoriées à distance contre 94 fichiers versionnés). **Aucune migration réappliquée**, aucune modification de données. Réconcilier l'historique avant toute future DDL.

## P0-B — constat de catalogue distinct

Une vérification SQL en lecture seule a confirmé **six prix Stripe CAD inscrits** mais non testés auprès de Stripe Sandbox. Dans `public.essential_plans`, les trois versions actives contiennent **20/25/50 sièges inclus** et **2 $ par place supplémentaire**, en divergence avec le maître **5 places et +3/+4/+5 $**. Les versions initiales avaient bien cinq sièges; les versions ultérieures possèdent un acteur dans l'historique versionné. Vérifier leur motif avant toute décision : issue [#90](https://github.com/punch360app/Punch360/issues/90). **Aucun prix ou contrat réel modifié**. Le prompt Drive privé `prompt paiement.txt` mentionne six prix Sandbox préexistants; cet inventaire n'est pas une confirmation par l'API Stripe.

## Prochaines tâches, sans refaire le livré

1. **Réalisé** : PR #89 fusionnée, CI TypeScript/Node/syntaxe et GitHub Pages vertes. Pas de recette appareil physique.
2. **Déployé** : Edge `essential-billing` version 2 ACTIVE, `verify_jwt=true`; test de session Auth négatif et essais avec client autorisé restent à effectuer. Aucun secret fourni ni divulgué.
3. Exécuter **uniquement en mode Stripe test**, sur entreprises fictives et avec autorisations fournisseur : les prix (3 × 2 cadences), versions de contrats, devis fournisseur, proratas, taxes, idempotence, webhook et rejets; ne pas annoncer #35 terminé avant preuves.
4. Puis P0-B facturation, P0-C rôles, P0-D Google/Apple/SMTP, et enfin les P1 prévus dans le maître. **SMS/Twilio reste dernier**.

Aucun compte, contrat, paiement, PDF ou pointage de client réel n'a été touché pendant ce lot.
