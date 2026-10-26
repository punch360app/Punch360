# P0 — décision commerciale conservée et vérification Stripe par produit

**26 octobre 2026 — branche `fix/p0-owner-pricing-stripe-guard-20261026`**

## Décision du propriétaire (prévalant sur le seed initial)

- Essentiel : **19 $ CA par mois**, **20 membres compris**, **2 $ CA par personne supplémentaire**.
- Essentiel Plus : **39 $ CA par mois**, **25 membres compris**, **2 $ CA par personne supplémentaire**.
- Essentiel Pro : **69 $ CA par mois**, **50 membres compris**, **2 $ CA par personne supplémentaire**.
- Rabais annuel : **15 %**; les six prix existants : 19,00/193,80; 39,00/397,80; 69,00/703,80 $ CA pour les six montants de base, hors taxes.
- Les bornes, établissements, fonctions et versions des contrats restent ceux du catalogue et des snapshots serveur. La grille **5 membres, +3/+4/+5 $** appartient au passé et **ne doit pas être rétablie**.
- **Issue #90 fermée** après confirmation personnelle de l'auteur des changements. Aucun `UPDATE` SQL, aucune migration de changement de prix, ni aucun appel Stripe réel effectué pour cette décision.

## Écart Stripe P0 identifié dans le code existant

L'Edge Function `essential-billing` utilisait le champ `ctx.configured_price` renvoyé par `billing_service_context`, sélectionné **seulement par montant et cadence**, sans vérifier à quel forfait/produit appartenait le prix. Si ce prix ne correspondait pas, elle tentait de récupérer/créer le produit nommé `punch-${o.plan_id}`, ce qui risquait de dupliquer les trois produits Stripe déjà enregistrés. Cela pouvait se produire avec des prix négociés ou des places supplémentaires.

## Lot de code proposé

- `supabase/functions/_shared/essential-price-catalog.mjs` : correspondance contrôlée des trois forfaits actuels avec les **six lookup keys historiques enregistrées** (punch_essentiel*, punch_pro*, punch_entreprise*). Les noms historiques des lookup keys **ne modifient pas** les libellés actuels des trois forfaits.
- Lecture serveur `public.essential_stripe_prices` pour les deux cadences du forfait sélectionné. **Aucune entrée/ID n'est changée.**
- Vérification en mode Stripe configuré, par `GET /v1/prices/:id` (les deux cadences) : Price ID, mode test/live cohérent, produit commun, CAD, montant de référence, actif, récurrence mensuelle/annuelle, nombre d'intervalles et tarif unitaire. En cas d'incohérence : **échec contrôlé**, pas d'abonnement ni création de produit.
- Commande correspondant exactement à l'un des six montants : réutilisation du vrai **Price ID existant**.
- Si une commande validée ajoute des sièges ou porte un tarif particulier : création idempotente d'un **nouveau Price sur le produit Stripe déjà existant**, jamais d'un nouveau Product; seulement si Stripe est explicitement actif et si les validations fournisseur sont réussies. Aucun nouveau Price n'a été créé lors de cette contribution.
- Contrôle du total de la commande par rapport au snapshot signé enregistré côté serveur avant tout appel fournisseur.
- Tests Node indépendants `tests/essential-stripe-price-catalog.test.mjs` : les 6 références et les trois paliers personnalisés, mapping des noms historiques, devis des places, modes Stripe, devise, intervalle, product ID partagé, erreurs et prix de commande invalides.

## Statuts indépendants

| Élément | Développé | Testé | Déployé | Intervention externe |
|---|---|---|---|---|
| Décision tarifaire et prompt maître | Oui (7 documents) | Comparaison versions Supabase en lecture seule | Docs via PR après fusion | Aucune : choix confirmé |
| Sélection sécurisée des six prix enregistrés | Code nouveau et tests | Node/CI à vérifier | **NON** : ne pas déployer Edge avant revue fournisseur | Stripe Sandbox pour vérifier les six IDs sur leurs vrais produits |
| Contrats et abonnements Stripe complets (#35) | Partiel existant | Mocks SQL/Web historiques | Edge `essential-billing` v2 antérieure | Tests sandbox authentifiés : prorata, taxes, webhooks signés, pannes, annulations, replay |
| Comptes, Prix, contrats réels | **Aucune écriture** | Lecture seule | **Aucun changement de configuration** | Aucun paiement client réel utilisé |

## Suites ordonnées

1. Exécuter CI TypeScript, Node/DOM et syntaxe puis relire les changements de l'Edge Function.
2. Vérifier les six Price IDs contre **le Stripe Sandbox réellement connecté**, sans dévoiler de clés. Si la correspondance produit/prix/intervalle échoue, documenter les références en cause **sans fabriquer de produit ou de Price ID**.
3. Valider la prévisualisation, les mises à jour d'abonnement idempotentes, et les webhooks avec sociétés fictives; déployer l'Edge modifiée **seulement après** cette recette technique du fournisseur ou validation explicite du mode de basculement. Les Price IDs et le catalogue Supabase restent intouchés.
4. Continuer issue #35 / P0-B puis P0-C et P0-D; SMS/Twilio à la toute fin.

**Ne pas confondre CI verte, absence de paiement réel et recette financière.** Ce lot ne certifie pas Stripe, ni la conformité complète de la facturation.
