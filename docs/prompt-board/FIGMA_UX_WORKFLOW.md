# PUNCH 360° — Contrat de collaboration UX/UI avec Figma

**Figma (référence visuelle de travail) :** https://www.figma.com/design/m3y6yfu7LL84Dp9ntGOXYZ
**Première planche de travail :** https://www.figma.com/design/m3y6yfu7LL84Dp9ntGOXYZ?node-id=14-10

Le propriétaire a validé la direction **simple, épurée, professionnelle et intuitive** de la première maquette. Cette planche est une **proposition visuelle**, non une spécification métier exhaustive ni une preuve de fonctionnalité installée. Aucun branchement bidirectionnel automatique Figma-GitHub n'est présumé.

## Routine de développement Work — sans bloquer les livraisons

1. À l'ouverture d'un parcours du prompt maître, lire l'interface actuelle **dans le code** (Web et/ou Expo), les décisions produit, et les composants déjà disponibles. Réutiliser les composants existants plutôt que lancer une refonte globale.
2. **Changement visuel significatif** (nouvel écran, navigation, refonte, zone responsive complexe) : consulter les écrans pertinents du fichier Figma et proposer ou mettre à jour la maquette correspondant au **vrai parcours**. Si Figma est inaccessible, appliquer les règles ci-dessous directement dans le code et consigner la limite : ne pas bloquer les lots indépendants.
3. **Changement fonctionnel simple** (bouton, validation, erreur, correctif mineur) : programmer directement avec le même système visuel; ne pas imposer un aller-retour Figma ni une validation du propriétaire pour chaque détail.
4. Implémenter dans les **véritables interfaces Web/Expo**; le design n'autorise aucune modification des rôles, de la facturation, du temps/paie, des permissions, des deux éditions, ni des invariants serveur. Toute décision métier reste gouvernée par le maître et le code serveur.
5. Vérifier la **même fonctionnalité** et ses états chargement, vide, hors ligne, erreur, succès, ainsi que lisibilité et ergonomie sur petit Android/iPhone, iPad/tablette et écran PC pertinents. Préserver accessibilité, contrastes, clavier, zones tactiles (viser 44–48 px) et espaces protégés.
6. Pour la PR, fournir les preuves visuelles ciblées *avant/après* disponibles, les tests réellement effectués et les limites appareil. CI/permissions/sécurité et publication sur cible réelle restent indispensables. **Ne jamais déclarer « livré » une maquette Figma.**

## Conventions validées

- Hiérarchie évidente : une action primaire par contexte; actions secondaires visuellement moins dominantes; confirmation explicite des actions sensibles.
- Navigation courte et stable; menus/contrôles bien espacés; réduire le bruit visuel, éviter tableaux interminables sur mobile.
- Tablette/PC Super Admin : navigation latérale claire, scorecards et actions groupées; mobile Super Admin : actions essentielles en priorité.
- Deux éditions Essentiel et Construction **distinctes**; respecter les modules et autorisations propres à chacune.
- Garder les données réelles, le fonctionnement QR employé vers caméra tablette et toutes les protections établies; ne pas inverser ce parcours.
- Préserver un état clair pour synchronisation hors ligne / en attente / confirmée serveur; aucun succès inventé.

## Stratégie de capture/comparaison

Quand les outils et accès de navigation authentifiée sont disponibles, capturer l'interface **réelle** sur la taille d'écran visée, conserver la référence actuelle et comparer avec la proposition Figma. Si la capture réelle n'est pas disponible, signaler que la proposition est conceptuelle plutôt que la présenter comme un vrai « avant ». Une maquette ne remplace jamais l'écran exécutable.

## Point d'entrée

Ce contrat complète `docs/prompt-board/WORK_START.md`, `MASTER_PROMPT_20261025.md` et la passation. L'ordre des exigences et l'exécution par gros lots restent inchangés.
