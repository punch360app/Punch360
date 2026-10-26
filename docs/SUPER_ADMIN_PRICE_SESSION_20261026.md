# Reprise Super Admin — devis particuliers isolés par session et par compagnie

26 octobre 2026 — suite du prompt « Validation SQL archives » sans relancer le prompt maître. Après les contrôles d'archives, la priorité fonctionnelle passe à **Super Admin**, comme demandé.

## Ce lot de code

Dans `web/live/platform-price-proposals.js`, les réponses tardives des RPC `platform_company_price_list`, `platform_company_price_approval_status`, `platform_company_price_preview`, `platform_company_price_draft` et `platform_company_price_approve` sont écartées après une déconnexion, un changement de compagnie ou une réinitialisation du contrôleur. L'ancienne réponse ne peut plus réafficher la liste d'un client, un aperçu négocié ou un avis d'approbation dans une autre session. Une réponse tardive n'entraîne pas une **nouvelle** RPC de consultation; une action d'écriture déjà partie au serveur doit toujours être protégée par ses propres contrôles MFA/UUID/version.

Les erreurs techniques RPC sont masquées derrière une phrase contrôlée, tout en conservant les codes d'autorisation nécessaires pour vider l'écran si le MFA n'est plus valide. Lorsqu'on choisit une compagnie réelle Essentiel dans le répertoire, son nom échappé et son UUID apparaissent en tête de la page « Tarifs particuliers »; la page rappelle que le tarif reste une proposition avant acceptation du Boss et confirmation Stripe. Modifier l'entreprise ou le motif vide les anciennes approbations/confirmations.

**Tests** : `tests/platform-price-session-isolation.test.mjs` couvre logout tardif, sélection d'une deuxième compagnie, aperçu/approbation/projet reçus trop tard, confidentialité des erreurs SQL et affichage échappé. La CI de branche et de PR doit réussir avant fusion. `web/live/index.html` et `sw.js` renouvellent la PWA (essential-49 / cache v44) et préchargent le composant de devis.

## Hors de portée de ce lot

- Aucun projet commercial, contrat, paiement, facture, siège ou compte client réel modifié.
- Aucun webhook, migration SQL ou secret Stripe modifié.
- La création de prix négociés et les étapes d'approbation actuelles continuent d'exiger les RPC contrôlées MFA avec versions. **La confirmation fournisseur Stripe sandbox/production n'est pas testée par cette PR.**
- Issue Super Admin **#35** toujours ouverte pour recette Stripe sandbox, prorata, webhooks, historique contractuel et audit tenant SQL. La PR **#82** (transfert Boss/MFA) est un lot parallèle à fusionner indépendamment après validation.
- La recette PDF réelle/PRA du prompt original reste à faire, mais ce lot ne produit ni ne manipule de nouveaux PDF. SMS/Twilio demeure dernier.
