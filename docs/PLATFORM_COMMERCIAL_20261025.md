# Super Admin : promotions et rapports financiers

Le Super Admin dispose de deux sections Web supplémentaires : Codes promotionnels et Rapports financiers. Elles exigent une session MFA plateforme encore présente côté serveur et ne sont pas accessibles aux utilisateurs ordinaires. Les tables privées et les RPC de confirmation fournisseur sont fermées aux clients.

## Promotions

Création d’un brouillon immutable : code alphanumérique, mode Stripe test/production, pourcentage entier, première facture / durée de 1 à 36 mois / tous les renouvellements, limite d’utilisations, expiration et première transaction Stripe. La création ne publie aucune remise. Chaque publication demande une action explicite avec motif, puis une confirmation serveur Stripe; les secrets restent dans Edge Functions. Un mauvais mode de clé ne réserve pas l’opération.

Une promotion est limitée aux produits Essentiel : produits des prix configurés dans la table dédiée et produits versionnés du moteur de devis. Pas de remise sur un produit arbitraire du compte Stripe. Le client ne fournit pas d’identifiant de produit. Un code promotionnel au maximum dans Checkout; le rabais annuel est déjà dans le prix contractuel.

Identités fournisseur et clés d’idempotence stables. Une réponse réseau perdue conserve l’opération en attente; une reprise retrouve le coupon et le code appartenant à PUNCH avant de créer autre chose. Les conflits avec une action opposée sont refusés. Les erreurs Stripe 4xx définitives sont distinguées des erreurs temporaires; les détails secrets ne sont jamais renvoyés. La désactivation est confirmée par le fournisseur, les compteurs affichés sont ceux de la dernière synchronisation. Conditions immuables : créer un autre code pour changer la remise.

## Rapports financiers

Intervalle de dates inclusives dans America/Toronto, filtre entreprise et séparation des compagnies réelles/test. Totaux sur tout l’intervalle, regroupement mensuel, détail des factures par pages de 100 et export CSV des lignes chargées. Les filtres appliqués restent figés pendant la pagination. Les montants proviennent des factures enregistrées par webhook; les factures annulées sont exclues du total facturé. Les règlements de ces factures sont distincts du MRR contractuel.

Date de classement : règlement, sinon fin de période, sinon dernière mise à jour. Ces chiffres ne rapprochent pas les remboursements, frais Stripe ou versements bancaires. Aucun profit net ni solde bancaire n’est déduit de ces données.

## Validation et limites

80 tests Node/DOM, TypeScript et tests SQL transactionnels dédiés promotions/finance. Ils vérifient notamment l’isolation MFA, les confirmations, la reprise, les limites et durées, les totaux au cent, les frontières de date du Québec, les factures annulées et l’absence de contamination par les compagnies test. Les tests fournisseur utilisent un HTTP injecté; aucun véritable code promo, paiement ou SMS n’a été créé pendant cette recette.

Les secrets nécessaires restent STRIPE_SECRET_KEY et PUNCH_STRIPE_ENABLED=true. Le mode du brouillon doit correspondre à la clé. Les six prix configurés restent conservés. La recette Stripe réelle et les contrôles sur appareils restent ouverts. Les interfaces Super Admin sont Web et responsives; pas de nouvel écran natif plateforme dédié.

Références Stripe pour l’API épinglée 2025-02-24.acacia :
- https://docs.stripe.com/api/coupons/create?api-version=2025-02-24.acacia
- https://docs.stripe.com/api/promotion_codes/create?api-version=2025-02-24.acacia
