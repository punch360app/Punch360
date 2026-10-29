# PUNCH 360° — Protocole UX/UI autonome pour Work

## Campagne prioritaire — PUNCH-AUDIT-GLOBAL-20261028

Cette campagne est ordonnée en tête du [prompt maître](MASTER_PROMPT_20261025.md). Elle autorise l'harmonisation conforme à la charte approuvée avant les nouveaux ajouts. Les contrôles métier, les droits et les validations des changements sensibles restent applicables. Les six rôles sont une organisation du travail ; ne pas prétendre qu'ils ont été exécutés sans travail réel.

### Organisation dès l'audit initial

| Rôle | Responsabilité |
|---|---|
| **Pilote / développeur intégrateur** | Organiser le lot, préserver l'architecture et les droits, consolider les constats, appliquer seul les modifications et livrer. |
| **Direction artistique** | Couleurs, images, typographie, proportions, hiérarchie visuelle et cohérence de la marque. |
| **UX / ergonomie / accessibilité** | Navigation, ordre des actions, lisibilité, vocabulaire, confort tactile et clavier. |
| **Responsive** | Examiner dès le départ téléphone, tablette et PC, orientations, contenu long, zoom, clavier et adaptations de disposition. |
| **Client / utilisateur final** | Comprendre et terminer le vrai parcours, relever ambiguïtés, efforts inutiles, frustrations et valeur perçue. |
| **QA fonctionnelle et visuelle** | Vérifier commandes, états, erreurs, régressions, preuves et résultat effectivement publié. |

Déléguer les cinq audits en lecture seule et en parallèle lorsque les sous-agents sont disponibles. Le pilote regroupe les défauts dans un seul inventaire puis applique les corrections ; aucune écriture concurrente sur les mêmes fichiers, aucun rapport ou accord séparé obligatoire par casquette. Si une revue indépendante est indisponible, le signaler et exercer les regards requis avec les outils accessibles. Les responsabilités architecture, Auth, confidentialité et sécurité restent intégrées au pilote et à la QA.

### Inventaire et compréhension du client

Découvrir les routes, menus et ouvertures réels, depuis le code et le rendu exécuté. Couvrir accueil/vente, forfaits, connexion/inscription et récupération, espace employé, pointage téléphone/borne/mixte, heures et corrections, horaires, missions, clients et trajets, messages, notifications, réglages, administration, Super Admin et tous les modules réellement accessibles selon l'édition et le forfait. Les modules non livrés restent identifiés comme tels. Inclure pour chaque rôle autorisé les états initial, actif, sélectionné, focus, désactivé, verrouillé, chargement, vide, erreur, succès, hors ligne et contenu long lorsqu'ils s'appliquent.

Conserver une seule matrice dans l'état courant existant : **page / état / rôle / format / objectif utilisateur / défaut observable / priorité / correction / preuve / statut**. Une liste des grands onglets ne constitue pas une couverture exhaustive. Un écran absent ou inaccessible reste « à développer » ou « non vérifié ».

Adopter le point de vue de salarié peu technophile, chef, Boss/Admin, Super Admin et opérateur de borne selon leurs droits. Sans explication du développeur, comprend-on où l'on est, quoi faire, où appuyer et le résultat attendu ? Vérifier ordre des étapes, libellés, action principale, retours/fermetures, erreurs récupérables, attentes et conservation de la progression. Décrire l'effort ou la confusion du client puis la correction précise. Une note esthétique ne remplace pas ce constat ; une revue IA ne devient pas un test humain réel.

### Responsive dès le départ et tout au long des corrections

Examiner la composition initiale sur petit/grand téléphone, tablette portrait/paysage et PC, avec priorité d'usage adaptée à chaque rôle. Utiliser l'espace disponible et les capacités tactiles/clavier ; conserver une identité commune avec une navigation adaptée. Vérifier zones sûres, clavier virtuel, faible hauteur, zoom/texte agrandi, contenu long, focus, zones tactiles et absence de débordement ou de commandes masquées. Un défilement utile reste permis pour conserver lisibilité et accès.

Faire vérifier tôt un écran réel représentatif, puis les familles différentes concernées — jeu ou tableau métier, formulaire, menu et modale. Après chaque changement partagé, contrôler les pages qui consomment le composant. Distinguer émulation et appareils physiques ; aucun test Chromium ne certifie à lui seul Safari, Samsung ou iPad.

### Référence commune et corrections par lots

Appliquer l'identité sauge, le logo officiel « Heure validée » et les thèmes/variantes déjà approuvés. Identifier les fichiers réellement actifs et le SHA de la version observée. Stabiliser tokens et composants communs : couleurs sémantiques, polices, tailles, espacements, arrondis, bordures, états, boutons, champs, cartes, navigation et dialogues.

Corriger les causes des écarts : anciens styles, doublons, surcharges et assets/caches incohérents. Toute nouvelle variante a un usage explicite dans le système commun. Respecter les couleurs légitimes des images, pictogrammes, données ou thèmes métier ; ne pas appliquer une interdiction aveugle des couleurs à tous les fichiers.

Traiter les blocages réels puis la compréhension et les composants partagés ; décliner ensuite les corrections sur l'inventaire par lots complets. Préserver moteur de temps, pointages, heures/paie, séparation des compagnies et éditions, droits/forfaits, catalogue, contrats et sens QR employé vers caméra tablette. L'harmonisation demandée ne réinvente aucun comportement métier ou produit.

### Vérification et protections permanentes

Vérifier chaque commande inventoriée dans son scénario autorisé : destination/action attendue, résultat confirmé, valeur conservée, refus compréhensible, réessai et absence de double soumission. Pour les opérations concernées, employer les vrais environnements et comptes de test isolés ; les fixtures ne prouvent pas une recette serveur réelle.

Produire et examiner les captures de l'app réellement exécutée, avec version, rôle, état et format identifiés. Comparer le même état, les mêmes données de test et le même environnement. Une référence du rendu dégradé n'est pas automatiquement approuvée. Conserver les règles d'approbation et de traçabilité existantes ; toute baseline changée exige une justification et une revue du rendu, sans tolérance élargie pour cacher un défaut.

Installer dans le dépôt les protections adaptées : composants/tokens réutilisables, contrôles ciblés sur les nouveaux écarts de style, interactions et comparaisons de rendu sur les pages/états concernés. Une modification partagée déclenche la couverture de ses consommateurs. Toute nouvelle page rejoint la matrice de couverture. La règle est permanente : revue design, UX, responsive, client et QA pendant le lot, avec vraie preuve avant livraison.

Après correction, réévaluer **UX OK / À CORRIGER / NON VÉRIFIÉ**, preuves et limites à l'appui. Corriger les défauts autorisés dans la session, puis attendre les contrôles requis sur le SHA final, publier dans le cadre autorisé et vérifier le résultat réellement servi. Aucune modification documentaire ne vaut contrôle installé ou audit exécuté.

Reprendre les entrées ouvertes de la campagne sans recommencer les pages vérifiées et inchangées. Les blocages isolés ne suspendent que leurs dépendants. Les nouvelles fonctionnalités reprennent après sa clôture vérifiée ; ensuite la même revue reste ciblée sur chaque ajout. Aucun outil payant ni workflow lançant Work en arrière-plan n'est présumé.

**Statut : règles d'exécution, non preuve de livraison.** Ce protocole complète le prompt maître officiel et le départ Work. Les décisions métier restent préservées ; l'ordre courant est la campagne prioritaire en tête du maître, puis les jalons métier.

## Directeur UX/UI intégré au parcours livré

1. À chaque nouveau parcours, écran ou modification visuelle significative, agir conjointement comme designer UX/UI senior, développeur de l'application existante, responsable d'accessibilité et utilisateur final réel (salarié, Boss, Admin, Super Admin ou opérateur de borne selon son rôle). Analyser ce que la personne doit comprendre, trouver et terminer, et non seulement la beauté d'une capture.
2. Lire la version réelle du code, les composants et la charte existants, les droits par rôle, les forfaits et le contexte de l'écran. Utiliser les captures réelles fournies par le propriétaire et/ou celles produites sur environnement contrôlé. Toute image conceptuelle doit être marquée **concept**; aucune maquette ne prouve qu'une fonction marche.
3. Proposer proactivement les améliorations utiles : action primaire évidente, navigation et retour prévisibles, regroupements logiques, texte compréhensible, hiérarchie, espacements, contraste, zones tactiles confortables (viser 44–48 px), clavier/lecteur d'écran et gestion des erreurs. Un bouton fonctionnel mais introuvable reste un défaut UX.
4. Adapter **le même vrai parcours** aux téléphones Android/iPhone, tablette portrait/paysage et PC pertinents. Tester également petits écrans, hauteur limitée, safe areas, grandes polices, zoom, clavier et déroulement nécessaire; ne jamais masquer une fonction pour éviter le défilement.
5. Évaluer tous les états affectés : chargement, données vides, succès confirmé serveur, refus de permission, erreur, hors ligne, expiration de session, bouton désactivé. Ne pas inventer de confirmation de pointage, de temps, de paiement ou de sauvegarde.
6. L'harmonisation transversale conforme à la charte est autorisée par la campagne prioritaire ; corriger et vérifier sans nouvelle validation de chaque détail. Pour une nouvelle refonte majeure de navigation/architecture ou du comportement utilisateur hors des décisions approuvées, présenter constat, impact, avant/après et variante conseillée **avant application**; demander l'accord du propriétaire. Aucune IA de design ne décide des règles métier, droits, tarifs, heures, paie ou politiques de pointage.
7. Après intégration dans **les vrais écrans Web/Expo**, vérifier le rendu avant/après et les interactions au moyen des tests ciblés existants. Les comparaisons automatisées n'utilisent que des références du **même écran, état, rôle et viewport** approuvées explicitement et identifiées par empreinte SHA-256. Sans référence, indiquer « à approuver », jamais « conforme ».
8. Pour chaque lot visuel significatif, fournir une note courte : **écran / constat observable / impact utilisateur / correction précise / priorité / capture avant-après / tests et appareils réels ou émulés / limites / état déployé**. N'effectuer ni revue exhaustive ni nouvelle maquette pour chaque bouton : la cadence par gros lots continue.

## Boucle de jugement UX — automatique pendant chaque lot Work concerné

- **Déclenchement :** à chaque ajout ou modification d'écran, navigation ou composant visible dans le lot en cours, intégrer la revue UX à la routine Work, sans prompt supplémentaire du propriétaire. Grouper les micro-corrections d'un même parcours pour éviter les audits répétitifs.
- **Avant :** établir le comportement et la capture de référence réelle lorsque possible, ainsi que l'objectif utilisateur et les critères du prompt maître. **Après :** exécuter le vrai parcours modifié, capturer le rendu final aux formats affectés et confronter à la référence, au comportement attendu, à l'accessibilité et à la charte.
- **Verdict obligatoire :** `UX OK` si vérification réelle et critères satisfaits; `À CORRIGER` avec problèmes précis et priorités si échec; `NON VÉRIFIÉ` quand les outils, accès ou captures manquent. Une compilation ou une réussite CI seule ne donne jamais `UX OK`.
- **Boucle corrective :** pour les corrections dans le mandat déjà approuvé, corriger immédiatement, retester et réévaluer **dans la même session active**, en regroupant les modifications. Répéter jusqu'à conformité ou blocage réel documenté; ne pas exiger « continue » entre les vérifications ordinaires.
- **Limites :** une refonte majeure non approuvée est une proposition, pas un correctif automatique. Ne pas attendre un outil tiers, ne pas suspendre les parcours indépendants et ne pas annoncer un jugement IA qui aurait été fait hors session. GitHub Actions exécute ses tests sur PR/push, mais ne déclenche pas à lui seul un jugement créatif par Work.

## Autorité, sécurité et coût

- Réutiliser l'identité sauge et le logo officiel « Heure validée », les composants existants, les deux éditions séparées, et les permissions/forfaits réels. Protéger le sens de lecture QR : **employé montre son QR; caméra de tablette le scanne**.
- Aucun service de design tiers, API IA payante, abonnement, crédit de génération ou outil externe ne doit devenir un prérequis. Un outil IA visuel facultatif est admissible seulement s'il est connecté, explicitement autorisé et dans les limites de coût; sinon Work applique les critères directement au code et aux captures existantes.
- Les preuves visuelles restent privées lorsque les écrans affichent des informations d'employés, de compagnies, d'heures ou de paie. Utiliser des données fictives et des comptes de test isolés en CI. Aucune capture ne doit contourner RLS, sécurité ou permissions.
- Les workflows GitHub capturent et comparent; ils ne démarrent **pas** Work en arrière-plan et ne modifient pas seuls la production. Respecter les vérifications CI et la validation avant fusion.
