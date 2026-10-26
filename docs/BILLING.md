> État actualisé : [ESSENTIAL_BILLING_20261024.md](ESSENTIAL_BILLING_20261024.md). Facturation Web/Expo et accès borne développés; configuration et recette Stripe réelle non validées. Le prompt complet reste ouvert.

> **ARCHIVE — décision du 24 octobre, remplacée le 26 octobre.** L'ancienne grille de 5 places incluses et +3/+4/+5 $ ne doit plus être appliquée. Les chiffres actifs et les six Price IDs existants sont décrits dans la décision du propriétaire ci-dessous.


> **Décision du propriétaire — 26 octobre 2026 :** les forfaits actifs sont volontairement personnalisés. Essentiel : **19 $ CAD/mois, 20 membres inclus, +2 $/membre additionnel**; Plus : **39 $, 25 membres, +2 $**; Pro : **69 $, 50 membres, +2 $**; remise annuelle **15 %**. Conserver les versions actuelles du catalogue et **les six identifiants Stripe existants**, sans réinitialisation ni création automatique pour remplacer ces prix. L'ancienne grille 5 places et +3/4/5 $ est **historique et remplacée**. Préserver contrats/snapshots/produits, ne pas toucher Construction. Issue #90 résolue par confirmation du propriétaire; issue #35 encore ouverte pour les essais fournisseur.

# PUNCH — Abonnements et super-administration (V1)

## Ancien modèle commercial (archive, non applicable)

**Archive uniquement — ne pas appliquer aux forfaits Essentiel actuels.** Tarif historiquement proposé : 49 $ CA/mois pour les 5 premiers membres actifs d'une compagnie, puis 7 $ CA/mois par membre actif supplémentaire. Tous les rôles (boss, admin, chef, employé) comptent si le compte est activé. Réduction annuelle proposée : 15 %. Prix hors taxes. Il faut conserver les prix contractuels des clients existants lors d'un changement du tarif global.

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

## Deux éditions — proposition du 24 octobre 2026

| Édition | Clientèle | Inclus | Prix mensuel proposé |
| --- | --- | --- | --- |
| PUNCH Essentiel | Bureau, atelier, manufacture à un établissement | Punch, pauses non payées saisies, heures, horaires, congés, approbations, exports, hors ligne et périmètre de l’établissement | 19 CAD pour 5 personnes, puis +3 CAD/personne |
| PUNCH Construction | Chantiers et équipes mobiles | Noyau des heures et gestion par jobs, commandes, plans et équipes | 49 CAD pour 5 personnes, puis +7 CAD/personne |

Les prix sont indicatifs et hors taxes. `src/billing/plans.ts` est un catalogue de propositions, pas une preuve de paiement ni un droit d’ajouter des places. Stripe et la validation commerciale restent nécessaires. Une nouvelle compagnie choisit son édition sans changer les rôles : le créateur est Boss; les invités gardent exactement leur rôle attribué.

## Tablette commune (PUNCH Essentiel)

Le **mode mixte téléphone/tablette** ne crée pas deux employés : une personne compte **une seule place facturable**, peu importe le nombre d'appareils utilisés. Une borne est un terminal d'entreprise, **pas** un membre facturé. Proposition commerciale à confirmer : une borne comprise par établissement; bornes supplémentaires configurables plus tard par Super Admin sans tarif inventé dans la V1. Les salariés Essentiel sans téléphone ni courriel doivent aussi compter dans les places humaines actives lorsqu'ils pointent exclusivement au kiosque.

En `restricted`, les bornes déjà enregistrées continuent de recevoir les punchs des salariés existants, et ces derniers conservent l'accès à leur historique. Seules les opérations de gestion/facturation sont restreintes selon le contrat. Voir [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md).

### Essentiel : iPad commun et compte personnel facultatif
Un membre actif qui pointe sur une borne et crée ensuite son **compte personnel pour consulter horaires/heures/congés** reste **une seule place facturable**. L'invitation personnelle est un rattachement à un dossier salarié existant, non une nouvelle inscription payante. La tablette partagée n'est pas une place; chaque salarié actif, avec ou sans smartphone, l'est. Les privilèges mobile (consultation/pointage) restent séparés et configurables. Voir [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md).

## Sécurité P0-B — confirmation de prévisualisation (26 octobre 2026)

La confirmation d'un changement d'abonnement vérifie désormais que la prévisualisation serveur n'est pas expirée (10 minutes), qu'elle cible **le même Price ID Stripe** que le devis courant, le même abonnement, le même élément d'abonnement et le même prix précédent. Une modification concurrente ou un changement de devis nécessite une nouvelle prévisualisation; aucun prix ni contrat réel n'est modifié par les tests.

- **Développé :** garde-fou Edge versionné sur GitHub, tests de refus d'identifiants périmés/croisés.
- **Testé :** tests Node via CI GitHub; recette fournisseur non réalisée.
- **Déployé :** non pour ce nouveau garde-fou Edge, tant que la recette Stripe sandbox n'est pas vérifiée; fonction existante v2 ACTIVE.
- **Intervention externe :** secrets Stripe de test et validation complète des webhooks, proratas, taxes et paiements en environnement test. Issue #35 demeure ouverte.


## P0-B — Confirmation sans création de tarif Stripe (26 octobre 2026)

Une prévisualisation de modification d'abonnement peut créer **un nouveau Price** Stripe uniquement pour un prix négocié ou un nombre de places qui ne correspond à aucun des six tarifs de base. La confirmation ultérieure **ne crée jamais de Price** : elle lit l'identifiant conservé côté serveur, récupère le Price Stripe existant au besoin et vérifie le produit, la devise CAD, le montant exact, la périodicité, l'environnement test/live, l'état actif et l'identité du prix prévisualisé. Une confirmation directe sans prévisualisation échoue sans création de tarif. Les six Price IDs existants et leurs produits restent inchangés.

- **Développé :** protection du flux Edge et tests négatifs unitaires versionnés sur une branche distincte.
- **Testé :** tests Node et CI GitHub Actions à vérifier sur la PR correspondante; **aucune** recette fournisseur Stripe sandbox effectuée.
- **Déployé :** **non** pour ce nouveau correctif; essential-billing v2 reste la version Edge précédemment constatée.
- **Intervention externe :** compléter la recette Stripe **test mode** (prorata, checkout, webhooks, taxes, annulation/reprise) avant toute publication Edge; issue #35 ouverte.


## P0-B — Précontrôle avant toute création de tarif fournisseur (26 octobre 2026)

Pour les tarifs personnalisés, la fonction Edge vérifie désormais **avant** un éventuel appel de création de Price Stripe que l'action demandée est autorisée : un Checkout n'est pas possible si un abonnement existe déjà; une prévisualisation ou confirmation exige un abonnement correspondant à celui du compte, un seul élément facturé et aucune mise à jour Stripe en attente. Les vérifications de produit, montant, devise et prévisualisation de la PR #94 demeurent en place. Ce changement évite de créer des tarifs Stripe orphelins à cause d'une action impossible.

- **Développé :** précontrôle dans le flux Edge et fonction partagée testable, sans modification de SQL, catalogue, contrats ou six Price IDs.
- **Testé :** tests Node mockés et CI GitHub à vérifier sur la PR; recette fournisseur Stripe test mode non exécutée.
- **Déployé :** non pour cette nouvelle version Edge (état fournisseur à revérifier avant déploiement).
- **Intervention externe :** essais Stripe sandbox et validation du déploiement; issue #35 ouverte.

## P0-B — Liaison fournisseur abonnement ↔ entreprise (26 octobre 2026)

Le flux de modification de forfait, la prévisualisation et la confirmation contrôlent désormais **avant toute mutation Stripe** que l'abonnement retourné par Stripe appartient bien au `subscription_id` et au `customer_id` du compte privé, que `metadata.punch_company` correspond à l'entreprise Boss authentifiée, et que `livemode` correspond à la clé utilisée. Le même contrôle s'applique **avant annulation et reprise** du renouvellement. Une métadonnée d'entreprise absente, un compte client différent ou un mélange test/live provoquent un refus fermé. Les références d'abonnement historiques dépourvues de la métadonnée ne sont pas réparées automatiquement : elles nécessitent une revue fournisseur autorisée.

- **Développé :** helper partagé + vérification Edge pour preview/confirm/cancel/resume, sans changement de catalogue, contrat, Price IDs ni SQL.
- **Testé :** tests Node avec deux entreprises fictives, ID client erroné, abonnement étranger, métadonnées manquantes et mode test/live; CI GitHub à vérifier sur la PR.
- **Déployé :** non pour cette modification Edge; état actif Supabase à revérifier, aucun déploiement automatique déclaré.
- **Intervention externe :** revue des métadonnées des abonnements de test, recette Stripe sandbox, webhooks, proratas, taxes et déploiement Edge contrôlé; issue #35 maintenue ouverte.

## P0-B — Isolement Stripe client / portail / factures (26 octobre 2026)

Le portail Stripe, l'historique des factures et la réutilisation d'un Customer pendant Checkout sont protégés par une **lecture du Customer réel chez Stripe**. Son ID, sa métadonnée d'entreprise `punch_company`, l'environnement test/live et l'état non supprimé doivent correspondre au compte privé du Boss. La liste des factures est également contrôlée élément par élément contre ce Customer et cet environnement avant de rendre les liens hébergés. Un mauvais rattachement refuse l'opération; le code ne réattribue jamais silencieusement un client Stripe.

- **Développé :** helper partagé + contrôles dans Edge `essential-billing` + tests unitaires; aucun changement du catalogue, des six Price IDs, des contrats, de Construction ou de SQL.
- **Testé :** CI GitHub Actions TypeScript/Node et syntaxe Web à confirmer sur la PR; Stripe sandbox fournisseur non testé.
- **Déployé :** non pour ce correctif Edge, tant que la recette Stripe sandbox n'a pas été faite et le déploiement confirmé.
- **Intervention externe :** vérifier les Customers de test et leurs métadonnées chez Stripe, le portail, les factures, Checkout, prorata et webhooks; issue #35 reste ouverte. Les anciens Customers sans métadonnée exigent une revue manuelle et ne sont pas réparés automatiquement.
