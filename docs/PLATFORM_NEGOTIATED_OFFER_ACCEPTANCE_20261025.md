# Tarifs particuliers — approbation et acceptation (PR #40)

## Parcours métier

1. Super Admin avec MFA AAL2 et session authentifiée vivante : crée une proposition négociée dans l'onglet **Tarifs particuliers**, l'archive comme `draft_pending_stripe` sans la publier.
2. Toujours dans cette section, il charge l'état d'approbation, choisit **la dernière version immuable**, et confirme par l'UUID exact de la compagnie avec raison de 8 à 1000 caractères. La RPC `platform_company_price_approve` revalide les droits, l'entreprise réelle Essentiel, le dernier numéro de proposition et le catalogue toujours au même numéro de version. Approbation auditée, sans facturer.
3. Le **Boss actif** de la compagnie voit alors le devis sur **Abonnement et factures**, avec prix en CAD, cadence, places, date et rappel du total avant taxes. Aucune autre entreprise ni employé n'a accès à son offre.
4. À la date d'effet ou après, le Boss peut **accepter explicitement**. La RPC `essential_company_price_order` crée une commande normale dans `private.essential_billing_orders`, réutilisée en cas de double clic ou de réponse perdue. Elle vérifie l'approbation, le nombre de salariés, les bornes et établissements, les quotas et la compagnie.
5. L'interface reprend le contrôleur Stripe existant : prévisualisation du prorata `essential-billing.preview` pour un abonnement courant, ou Checkout pour un nouveau client. La confirmation de l'interface n'attribue jamais de sièges ni ne transforme un projet en contrat.
6. Seul `billing_service_apply` après événement Stripe signé confirmant un abonnement actif/période payée écrit les conditions et les places. Le snapshot de la commande transporte `negotiated_price_proposal_id` et `negotiated_offer_version`.
7. Lors d'une mise à jour de contrat confirmée, le trigger `private.preserve_essential_contract_revision` conserve l'ancienne version contractuelle intégrale dans la table privée de journal avant tout remplacement de snapshot.

## Sécurité
- Entreprises Construction et test exclues. Aucune commande payante pour les entreprises test.
- Super Admin ne peut pas passer le paiement à la place du Boss. Boss ne peut ni créer ni approuver les offres.
- Les anciennes propositions restent conservées; approbation versionnée; seuls les clients réellement abonnés peuvent suivre le parcours de paiement.
- Aucun mot de passe, secret de paiement, jeton, NIP ou donnée RH exposé au navigateur.
- Le projet et l'approbation n'affectent ni le contrat existant ni les prix publics. **Jamais de confirmation Stripe artificielle**.
- Les prix négociés historiques restent dans l'ordre signé et les anciens contrats sont journalisés par le trigger.

## Preuves
- Migration : `supabase/migrations/20261025215638_platform_negotiated_offer_acceptance.sql` (migration déjà appliquée dans Supabase au numéro 20261025215638).
- Test `supabase/tests/platform_negotiated_offer_acceptance.sql` exécuté sur compagnies fictives avec rollback : refus Boss, MFA Super Admin, mauvaise confirmation, version expirée, présentation de l'offre, double commande idempotente et journal contractuel.
- Code Web/Expo : `web/live/platform-price-proposals.js`, `web/live/billing.js`. Tests `tests/platform-price-proposals.test.mjs` et `tests/billing-ui.test.mjs`.
- **À confirmer avant de clore l'issue #35** : véritable compte Stripe test + API keys + webhooks signés, prorata, abonnement annuel/mensuel, panne réseau, certificat de prix Stripe, factures, renouvellement, taxes, changement d'offre en attente et fin de période. Aucun paiement réel n'est émis pendant les tests.
- Écran mobile Expo codé; builds signés Android/iOS et tests sur appareil non effectués. Un statut CI vert valide le code, pas une transaction financière réelle.

Cette livraison appartient au **prompt original « Validation SQL archives »**, et non au prompt maître séparé de 453 exigences.

## Confirmation de déploiement contrôlé

Migration installée sur le seul projet Supabase `mlabstdxxwjdpfaxiwmg` sous `20261025215638`. Scénario SQL exécuté **après installation** dans une transaction `ROLLBACK` : réussite. Contrôle de données : 0 projet, 0 approbation, 0 ancienne version inventée conservés, refus d'approbation et de commande pour le rôle anonyme. Le code Expo de l'offre a été ajouté après la première exécution CI verte : vérifier le dernier statut CI avant fusion. Aucun compte réel et aucun paiement Stripe touché.
