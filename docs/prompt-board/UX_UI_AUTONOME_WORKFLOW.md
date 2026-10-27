# PUNCH 360° — Protocole UX/UI autonome pour Work

**Statut : règles d'exécution, non preuve de livraison.** Ce protocole complète le prompt maître officiel et le départ Work. Les décisions métier et l'ordre global du maître restent prioritaires.

## Directeur UX/UI intégré au parcours livré

1. À chaque nouveau parcours, écran ou modification visuelle significative, agir conjointement comme designer UX/UI senior, développeur de l'application existante, responsable d'accessibilité et utilisateur final réel (salarié, Boss, Admin, Super Admin ou opérateur de borne selon son rôle). Analyser ce que la personne doit comprendre, trouver et terminer, et non seulement la beauté d'une capture.
2. Lire la version réelle du code, les composants et la charte existants, les droits par rôle, les forfaits et le contexte de l'écran. Utiliser les captures réelles fournies par le propriétaire et/ou celles produites sur environnement contrôlé. Toute image conceptuelle doit être marquée **concept**; aucune maquette ne prouve qu'une fonction marche.
3. Proposer proactivement les améliorations utiles : action primaire évidente, navigation et retour prévisibles, regroupements logiques, texte compréhensible, hiérarchie, espacements, contraste, zones tactiles confortables (viser 44–48 px), clavier/lecteur d'écran et gestion des erreurs. Un bouton fonctionnel mais introuvable reste un défaut UX.
4. Adapter **le même vrai parcours** aux téléphones Android/iPhone, tablette portrait/paysage et PC pertinents. Tester également petits écrans, hauteur limitée, safe areas, grandes polices, zoom, clavier et déroulement nécessaire; ne jamais masquer une fonction pour éviter le défilement.
5. Évaluer tous les états affectés : chargement, données vides, succès confirmé serveur, refus de permission, erreur, hors ligne, expiration de session, bouton désactivé. Ne pas inventer de confirmation de pointage, de temps, de paiement ou de sauvegarde.
6. Pour une retouche visuelle mineure conforme à la charte, corriger directement et vérifier. Pour une refonte majeure de navigation/architecture ou du comportement utilisateur, présenter constat, impact, avant/après et variante conseillée **avant application**; demander l'accord du propriétaire. Aucune IA de design ne décide des règles métier, droits, tarifs, heures, paie ou politiques de pointage.
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
