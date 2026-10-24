# PUNCH — Abonnements et super-administration (V1)

## Modèle commercial retenu pour le prototype

Tarif **proposé et modifiable** : 49 $ CA/mois pour les 5 premiers membres actifs d'une compagnie, puis 7 $ CA/mois par membre actif supplémentaire. Tous les rôles (boss, admin, chef, employé) comptent si le compte est activé. Réduction annuelle proposée : 15 %. Prix hors taxes. Il faut conserver les prix contractuels des clients existants lors d'un changement du tarif global.

Formule mensuelle : `base_cents + max(0, seats-included_seats)*extra_seat_cents`.
Facturation annuelle : sous-total mensuel * 12 * (1 - taux de rabais), avec arrondi contrôlé en cents.

Stripe Billing est recommandé pour les produits/prix, abonnements, factures, cartes, coupons et portail client. La facturation est vendue aux entreprises par un site web; l'app mobile permet aux employés d'utiliser leur abonnement d'entreprise. Vérifier les exigences Apple App Store 3.1.3(c) et Google Play avant publication.

## Super Admin PUNCH — rôle plateforme

Ce rôle distinct ne correspond pas à « boss » d'une entreprise et n'est jamais attribué depuis une invitation publique. Fonctions :
- Vue des entreprises clientes, sièges facturables et revenu mensuel récurrent (MRR).
- Forfaits, tarifs courants, remises annuelles, promotions et coupons.
- Historique d'abonnement, échéances, factures, remboursements, notes de crédit.
- Suspension / réactivation, prolongation exceptionnelle du sursis, actions auditées.
- Prix négociés par entreprise sans modifier les abonnements existants.
- Journaux de webhooks et de paiements, sans manipuler de numéros de carte.
- **Pas d'accès aux conversations privées des équipes** dans ce rôle.

## Sursis de paiement : 30 jours (modifiable par Super Admin)

- `active` : échéance payée, services opérationnels.
- `grace` : premier renouvellement impayé, accès complet pendant 30 jours.
- `restricted` : après la fin du sursis, opérations désactivées.
- `active` à nouveau : facture payée et état reconfirmé côté Stripe.
- Le sursis est calculé à partir de la première échéance de renouvellement impayée. Les tentatives suivantes ne déplacent pas cette date.
- Une **résiliation volontaire** se termine à la fin de la période payée, sans nouveau sursis automatique.
- Après restriction : conserver l'accès au portail de facturation du boss et à la lecture/export des historiques d'heures nécessaires aux obligations d'archivage. Ne jamais supprimer les historiques pour non-paiement.
- Avertissements suggérés : aux jours 0, 7, 21 et 28, et au verrouillage.
- Les dérogations doivent être datées, justifiées, et réservées au super admin; toute action laisse une piste d'audit.

## Sécurité et intégration

- Ne jamais laisser le client décider si un paiement est réussi.
- Endpoint Stripe webhook avec signature vérifiée, IDs d'événements stockés pour idempotence, traitement résilient aux événements désordonnés.
- `invoice.payment_failed` note le défaut ; `invoice.paid` déclenche la réévaluation des droits ; événements subscription créée/modifiée/annulée sont traités.
- Décision d'accès calculée sur le serveur, vérifiée sur **chaque action sensible** avec un `company_id` authentifié.
- Isolation multientreprise RLS et vérifications serveur. La clé Stripe secrète n'est jamais livrée à un appareil.
- N'ajouter des membres facturables qu'après invitation acceptée ; statut désactivé ne compte plus lors du prochain ajustement. Les factures doivent respecter le prorata configuré.
- La gestion des cartes utilise le portail Stripe hébergé; conserver uniquement les identifiants Stripe.
- Aucun nom d'entreprise ni chiffre de la maquette ne correspond à un client réel.

## État

Le prototype HTML de la console Super Admin est une **démonstration locale**, non connecté à Stripe ou Supabase. Une configuration autonome de backend PUNCH, les identifiants Stripe, les fournisseurs Google/Apple et les tests sont encore nécessaires.
