# P0-B — garde-fou de panier Stripe dans les webhooks (26 octobre 2026)

## Risque corrigé
Le webhook Essentiel lisait seulement `sub.items.data[0].price.id`. Si Stripe renvoyait une souscription avec plusieurs lignes (ou une quantité autre que 1), le serveur pouvait résoudre une commande et traiter une facture pour une configuration de facturation différente du modèle PUNCH (une ligne, quantité 1). Cela rendait la validation du forfait et des places ambiguë.

## Changement ciblé
- `stripeWebhookSubscriptionPrice` vérifie **exactement une ligne**, liste non paginée, quantité **1**, identifiant de ligne/prix, devise CAD, tarif récurrent mensuel ou annuel, montant entier positif et cohérence test/live du Price avec la souscription.
- Le webhook appelle cette validation **avant** `billing_service_resolve_order` et `billing_service_apply`; toute anomalie produit `RETRY_REQUIRED` sans mutation de facturation. Un événement conforme conserve son chemin existant.
- Tests Node simulés pour cas conformes, panier multiple, quantité 2, pagination, mauvais prix, devise, intervalle ou environnement; test d'ordre des gardes.

## Statuts et limites
- **Développé :** code et tests sur PR dédiée.
- **Testé :** tests Node/CI GitHub à vérifier; **pas de recette fournisseur**.
- **Déployé :** **non**; aucun déploiement Edge, migration SQL ou changement de configuration Stripe.
- **Intervention externe :** tester les vrais événements Stripe sandbox signés et la cohérence abonnement/commande/facture dans l'issue #35; valider le comportement de retry fournisseur.

## Décision tarifaire immuable
Essentiel 19 $/20 inclus, Plus 39 $/25, Pro 69 $/50, +2 $ par membre supplémentaire, annuel −15 %. Six Price IDs inchangés, contrats historiques intacts, aucune opération Stripe live, aucun client réel touché. Issue #90 fermée, #35 ouverte. SMS/Twilio hors périmètre.
