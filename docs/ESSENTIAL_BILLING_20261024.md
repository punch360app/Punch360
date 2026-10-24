# Essentiel — facturation et accès borne

## Implémentation

Boss Web et Expo : devis serveur, prévisualisation Stripe obligatoire pour modifier forfait/cadence/places, confirmation, Checkout hébergé, factures, portail, résiliation à l’échéance et reprise du renouvellement. Les remises de code promotionnel sont saisies sur Checkout et appliquées par Stripe. Les taxes sont calculées par Stripe Tax, qui doit être configuré dans le compte marchand.

Le catalogue public reste administrable. Un changement de places dans le même forfait reprend le snapshot contractuel, sans adopter automatiquement le nouveau prix public. Le montant annuel inclut le rabais sur la base et les membres additionnels, en cents. Les six prix Stripe configurés manuellement sont conservés et réutilisés si montant, devise, intervalle et environnement correspondent; sinon un nouveau prix est créé avec identifiant idempotent. Les noms historiques `punch_pro` et `punch_entreprise` des prix ne sont pas utilisés pour accorder un niveau d’accès.

Deux Edge Functions sont déployées : `essential-billing` (JWT + vérification Auth et Boss réel), `essential-stripe-webhook` (signature HMAC du corps brut et tolérance de cinq minutes). Les écritures de paiement sont réservées au service serveur. Le retour Checkout ne valide aucun paiement. Le webhook relit l’abonnement et les factures Stripe; activation seulement après facture réglée et période payée. Les événements sont dédupliqués. Une mise à jour en attente de paiement ne donne pas les places supplémentaires.

Le sursis n’existe qu’après une période réellement payée. Le premier échec est conservé; les nouvelles tentatives ne prolongent pas les 30 jours. L’expiration est vérifiée à l’opération de gestion, sans attendre une tâche planifiée. Le punch et la lecture des heures restent accessibles. Résiliation volontaire : accès jusqu’à la fin payée, sans nouveau sursis. Une rétrogradation exige de réduire les bornes/établissements excédentaires avant le devis.

Super Admin sous MFA : liste d’abonnements, états, échéances, places et événements de webhook. MRR/ARR contractuels avant remises Stripe distincts des montants de factures réglés. Ceux-ci peuvent inclure crédits et ne sont **pas** présentés comme encaissements bancaires nets ou rapprochement de remboursements.

## Configuration fournisseur

Dans les secrets Edge Functions du projet **mlabstdxxwjdpfaxiwmg** :

- `STRIPE_SECRET_KEY` : clé serveur du compte marchand.
- `STRIPE_WEBHOOK_SECRET` : secret de signature du nouvel endpoint.
- `PUNCH_STRIPE_ENABLED=true` : activation explicite après configuration. Ajouter une clé ne déclenche aucun paiement automatiquement.

Endpoint Stripe : `https://mlabstdxxwjdpfaxiwmg.supabase.co/functions/v1/essential-stripe-webhook`.
Événements : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`.
Configurer Stripe Tax, inscriptions fiscales et portail client dans le compte Stripe. Le portail doit réserver les changements de forfait/places à PUNCH pour conserver la prévisualisation et le snapshot.

L’ancienne fonction manuelle `stripe-checkout` et ses tables ne sont pas supprimées. L’interface de cette livraison utilise exclusivement `essential-billing`; ne pas lancer simultanément des Checkout par les deux intégrations. Aucun abonnement existant n’a été migré ou facturé pendant cette livraison.

Twilio, déjà déployé : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `PUNCH_SMS_ENABLED=true`. Callback `https://mlabstdxxwjdpfaxiwmg.supabase.co/functions/v1/essential-sms-status`. Secrets côté serveur uniquement. Compagnies test exclues des SMS et paiements réels.

## Borne PWA

Fiche Web : Ouvrir la pointeuse et Copier le lien utilisent exactement `https://punch360app.github.io/Punch360/kiosk.html`, sans code ou token. Expo : gestion des bornes, ouverture/partage du lien, appairage, code d’enrôlement NIP, modes de pointage, révocation et délai d’inactivité. Le code doit être saisi séparément sur la tablette.

Manifeste et cache applicatif ajoutés pour la page borne. Délai par défaut 10 secondes, réglable à 5/10/15/30/60. Masquage au changement de visibilité et réouverture; une identification tardive ne restaure pas le salarié après fermeture. Seul le jeton technique limité peut persister. Le cache ne conserve pas les réponses API/Auth. La borne reste **en ligne uniquement** : mise en cache du shell ne signifie pas pointage hors ligne.

## Vérification et limites

41 tests Node/DOM, TypeScript, vérification Deno des deux nouvelles fonctions; quinze scripts SQL transactionnels, dont facturation et délai de borne. Les données fixtures et changements de prix des tests sont annulés. Les tests ne supposent plus que les prix publics éditables restent aux valeurs initiales. Bundles Android/iOS générés séparément; aucun test appareil physique ou APK/IPA signé annoncé.

Aucun paiement/SMS réel ni paiement Stripe sandbox exécuté pendant cette livraison. À réaliser avec les secrets : carte de test, SCA, échec/reprise, changement annuel au prorata, promotions, taxes, événements retardés/concurrents et rapprochement de factures. Les tests actuels couvrent adapter/signature/UI/SQL, pas une recette fournisseur complète. La réception simultanée d’événements d’une même seconde mérite un test de concurrence avant commercialisation.

Restent ouverts : création complète des promotions dans la console Super Admin, remises contractuelles/avoirs/remboursements/suspensions opérateur, rapprochement des encaissements, alertes de relance automatisées, réabonnement après suppression définitive de l’ancien abonnement. Gestion d’un compte Admin personnel sur borne partagée désactivée; minuteur de session administrative séparé à développer. Installation et exécution PWA Safari/Android à valider sur appareils.

Le produit complet conserve les autres travaux ouverts : vingt designs approuvés, traduction, fonctions RH/paie avancées, hors ligne sécurisé de la borne, sauvegardes/restauration et distribution. Ajouter les clés Stripe/Twilio ne remplace pas ces travaux ni les recettes fournisseurs.
