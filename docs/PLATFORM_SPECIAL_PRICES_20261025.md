# Tarifs particuliers Essentiel — propositions commerciales non activées

## État du développement (25 octobre 2026)

**Phase A : projet de prix sûr, sans Stripe.** Le Super Admin MFA dispose d'un onglet « Tarifs particuliers ». Il saisit l'UUID d'une compagnie Essentiel réelle, un motif détaillé, le forfait, les places, le prix de base en cents CAD, la part additionnelle par employé, les places incluses, la remise annuelle et la date d'effet souhaitée.

Flux : **charger la version** → **prévisualiser le devis calculé côté serveur** → **recopier exactement l'UUID** → **enregistrer une nouvelle proposition immuable**. Un prix catalogue modifié entre l'aperçu et la confirmation invalide la proposition; une création concurrente ou un formulaire non confirmé est refusé.

Données stockées exclusivement dans `private.platform_company_price_proposals`, RLS activée et aucun droit direct `anon` ou `authenticated` sur cette table. Les RPC exposées `platform_company_price_list`, `platform_company_price_preview`, `platform_company_price_draft` appellent `private.assert_live_platform_session` (propriétaire plateforme, AAL2 et session réellement vivante), contrôlent compagnie et forfait, motif, date, bornes du calcul, révision et confirmation. Chaque lecture/apercu/création est auditée.

**Invariants métier essentiels :** statut `draft_pending_stripe` et `payment_confirmed=false` en permanence. AUCUN changement de `private.essential_contracts`, `private.essential_billing_accounts`, `private.essential_billing_orders`, `public.essential_plans`, factures, Stripe ou droits Essentiel à l'enregistrement. Aucun paiement ni activation de tarif réel. Le prix demeure **une proposition**, pas une facture client.

Les contrats existants et leurs snapshots historiques continuent de faire autorité pour la facturation. La proposition sauvegarde un snapshot versionné du forfait incluant ses limites/fonctions avec seulement les paramètres financiers négociés; jamais de droits Pro accordés par simple ajout d'un projet. Construction et comptes test sont exclus.

## Validation
- Migration : `supabase/migrations/20261025214230_platform_company_price_proposals.sql` (migration appliquée dans Supabase officielle au numéro 20261025214230)
- Requête transactionnelle : `supabase/tests/platform_company_price_proposals.sql`, `BEGIN`/`ROLLBACK`.
- Tests : `tests/platform-price-proposals.test.mjs`, vérification compilateur/syntaxe CI GitHub Actions.
- SQL rollback réussi : prévisualisation mensuelle et annuelle 2199 / 23749 cents, refus confirmation incorrecte, version concurrente et version du catalogue périmée, historique de deux propositions immuable, Construction exclu, membre ordinaire refusé, factures/commandes/contrats inchangés et événements d'audit.
- **Non réalisé à cette étape : approbation juridique, Stripe test/proration, soumission fournisseur, webhook/activation, facture réelle, courriel de notification, recette sur appareil.**

## Étape suivante — issue #35
Créer une **phase fournisseur strictement séparée** qui exige validation commerciale, identité Stripe réelle, prévisualisation du prorata Stripe, prix de remplacement du bon item, idempotence, confirmation paiement par webhook signé, et publication du snapshot seulement après retour fournisseur confirmé. La mutation de contrat doit conserver les anciennes versions et ne jamais activer sur un succès d'API seul; gérer les pannes et délais. Tester **sandbox** avant mise à disposition production. Ne jamais utiliser un client réel pour simuler un paiement.

Référence provider : <https://docs.stripe.com/billing/subscriptions/change-price>. Pour les abonnements, le prix doit remplacer explicitement le bon item, sinon Stripe peut ajouter un second item facturable.

Le prompt de **« Validation SQL archives »** est toujours en cours. Ne pas commencer les 453 exigences supplémentaires de la PR documentaire #26 avant la clôture du prompt original.

## Preuves d'installation

Le schéma a été appliqué exclusivement au projet `mlabstdxxwjdpfaxiwmg`, version `20261025214230`. Après installation, le scénario SQL complet a été relancé sur cette version avec rollback et a réussi. Lecture de contrôle : **0 proposition réelle**, permission `anon` à `platform_company_price_draft` refusée. Le design de la fonction ne modifie aucun état Stripe; la mise à disposition du formulaire Web ne vaut pas activation du prix négocié.

Les modèles public et privé ont conservé leur isolation. Les avertissements du conseiller Supabase concernant `SECURITY DEFINER` exécutables par `authenticated` sont intentionnels pour les RPC protégées par `private.assert_live_platform_session`; ils nécessitent une revue régulière, sans élargissement des grants.

## Rectificatif propriétaire — 26 octobre 2026 (P0-A / SACATALOG)

Le texte historique ci-dessus décrivait l'ancien formulaire comme si les 5 places, +3 $ et des lots indépendants restaient la référence. **Ces valeurs ne sont plus valables.** La décision formelle du propriétaire du 26 octobre confirme les forfaits courants : **Essentiel 19 $/20 places, Plus 39 $/25, Pro 69 $/50, +2 $ CAD/personne supplémentaire**, −15 % annuel, avec six Price IDs historiques conservés.

La console `web/live/platform-price-proposals.js` préremplissait encore `seats=5`, `included=5` et `extra=300`. Elle affiche maintenant 20/1900/20/200 pour Essentiel, 25/3900/25/200 pour Plus et 50/6900/50/200 pour Pro. Le changement de forfait met à jour les valeurs **uniquement si le Super Admin ne les a pas personnalisées**; les valeurs déjà saisies restent inchangées avec une invitation à les revérifier. Un devis négocié demeure une proposition non active tant que le Boss/Stripe n'ont pas confirmé la transaction. Aucun seed ou contrat historique n'est modifié.

- **Développé :** valeurs Web, garde pour saisie personnalisée, tests Node/DOM.
- **Testé :** CI à vérifier pour la PR dédiée; aucune approbation commerciale ou recette Stripe sandbox réalisée.
- **Déployé :** publication GitHub Pages à vérifier séparément.
- **Intervention externe :** toute nouvelle proposition réelle exige le contrôle Super Admin, le Boss, les preuves et la recette fournisseur; issue #35 ouverte.

Le prompt unique courant est **578 exigences/29 lots**, non la référence historique « 453 supplémentaires ». Ne pas repartir de la validation PDF ni réinitialiser les tarifs du propriétaire.
