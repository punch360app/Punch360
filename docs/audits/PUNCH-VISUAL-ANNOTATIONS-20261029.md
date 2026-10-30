# PUNCH 360 — aperçu responsive partagé Atelier et annotations DOM (29 octobre 2026)

## Décision et architecture

Utiliser **la seule bibliothèque responsive officielle d'Atelier** sans en recopier les cadres, moteurs de zoom/rotation, profils d'appareils, catalogue ni dispositions :
- Contrat : https://atelier-projets-jf.juliensav.chatgpt.site/responsive/integration.md
- Import ESM : https://atelier-projets-jf.juliensav.chatgpt.site/responsive/v1/entry.mjs
- Entrée PUNCH : `web/live/annotations.html`
- Identifiant stable réservé à Punch : `punch360-12fb1917-94ea-481d-b131-16c58a5bf010` (sans partage avec les autres applications).

`annotations.js` appelle `mountResponsiveWorkspace({projectId,title,renderApp,renderWeb})`. Chaque callback monte directement dans `container` le HTML produit par les **véritables contrôleurs** PUNCH existants : `createSupportController`, `createPlatformDirectoryController`, `createPlatformAuditController`. Le rendu reste dans le **même document**, sans iframe, image substitutive ou duplication du moteur. Les interactions (boutons, formulaires, états d'attente, erreurs) restent celles des contrôleurs PUNCH. Les requêtes sont remplacées uniquement pour ce mode d'essai par l'adaptateur `punch-review-data.js` avec données fictives **en mémoire** ; aucun compte, client, NIP ou droit réel n'est transmis. Les mutations éventuelles modifient seulement les objets fictifs.

Le CSS projet possède uniquement les règles des écrans PUNCH et de la fenêtre d'annotations, avec **container queries `punch-screen`** sur sa propre racine placée dans les slots `.ap-device-content` fournis par Atelier. Cela respecte la largeur effective sans modifier ni recopier les cadres d'Atelier. Le contrat générique documente `ap-content`, mais la bibliothèque v1 effectivement vérifiée expose `.ap-device-content` et `.ap-device-frame` sans conteneur nommé `ap-content` : Punch ne doit pas l'inventer ni altérer le moteur partagé. Les boutons d'appareil, cadres, presets et catalogue sont exclusivement gérés par le module partagé.

## Fonctionnement des annotations

Dans la fenêtre PUNCH, choisir un des trois écrans puis utiliser l'outil adapté : **Punaise** (taper n'importe où, texte ou espace vide), **Rectangle** (maintenir puis glisser le doigt/souris pour entourer une zone), ou **Élément** (ancienne sélection d'un vrai bouton/champ). Le panneau de commentaires s'ouvre automatiquement après le geste. Enregistrer le texte et son statut ; le marqueur reste visible et peut être modifié/supprimé via la liste des annotations. **Tester les boutons** réactive les gestionnaires normaux PUNCH. En modes annotation, un calque transparent, strictement à l'intérieur de la racine de chaque écran PUNCH, intercepte les gestes au lieu de cliquer les vrais boutons. Aucune image ni iframe n'est introduite.

Les punaises stockent `kind:"pin"` et `geometry:{x,y}`; les zones `kind:"rect"` et `geometry:{x,y,width,height}`. Toutes ces valeurs sont des fractions bornées entre 0 et 1 de **la surface du contenu Punch dans le cadre Atelier**, avec `coordinateSpace:"screen-content-relative-v1"` et `sourceSize:{width,height}` au moment de la création. Elles restent interprétables après un changement de format, zoom ou orientation. Le format d'export JSON passe à `version:2`, tout en conservant les annotations existantes sur les éléments (`kind:"element"` implicite) et en acceptant l'import de la version 1. Exemple de zone à 20 % du bord gauche, 30 % du haut, 45 % de largeur et 12 % de hauteur :

```json
{
  "kind": "rect",
  "coordinateSpace": "screen-content-relative-v1",
  "geometry": {"x": 0.2, "y": 0.3, "width": 0.45, "height": 0.12},
  "sourceSize": {"width": 402, "height": 874}
}
```

Le commentaire, l'écran, le slot `primary/secondary/web`, le statut et la position sont conservés localement par `projectId`. Les marqueurs liés à un élément existant restent attachés au vrai DOM, tandis que les punaises/rectangles suivent la surface de l'écran en coordonnées proportionnelles.

L'export/import JSON versionné permet de remettre un fichier dans le chat. Il ne contient pas d'image client ni de secret, mais peut décrire le texte d'un écran fictif. Aucun envoi vers Atelier, GitHub, Supabase ou ChatGPT sans action manuelle. Les annotations ne sont pas automatiquement partagées entre S25, iPad et PC. Ne pas entrer de données client réelles dans l'aperçu. La version publiée reste **publique** en tant que page statique, tandis que le stockage des notes reste propre à chaque navigateur.

## Contrôles

- `tests/annotations-dashboard.test.mjs` : seule bibliothèque Atelier importée, unique `projectId`, callbacks publics, vraies fonctions PUNCH, zéro iframe/cadre/catalogue local, stockage et export bornés, CSP et requêtes fictives.
- `.github/scripts/visual-annotations.cjs` : dans Chromium 320/S25/iPad/PC, import réel du module partagé, vrais contrôles PUNCH dans le même document, sélection élément, tap sur du contenu quelconque, tracé d'un rectangle par gestes pointeur, données JSON v2 avec géométrie relative et dimensions, export/import et persistance après rechargement. Les captures d'essai sont archivées par la revue visuelle.
- `tests/annotation-geometry.test.mjs` : géométrie indépendante du zoom, déplacements, inversion du tracé, bornes, validation d'import et conservation d'un carré visible après un mouvement minimal.
- Requête GitHub Actions en lecture seule pour les PR/tests publics : aucune déclaration « en direct » si l'API ne répond pas.

**Limites :** la simulation n'est pas une preuve de recette MFA/Auth/RLS, de pointage réel, de parité Android/iOS, de validation Figma, de synchronisation Atelier ou d'appareil physique. La bibliothèque commune fournit des tailles et cadres CSS, pas une émulation réelle iOS/Android. Ne pas déclarer le tableau « publié » avant checks CI réussis sur le SHA final, fusion, déploiement Pages confirmé et lecture réelle de l'URL.

## Préservation des travaux

PR #217 vitrine et #86 Storage laissées inchangées. Les données, droits, facturation, pointages, paie, QR Wallet et authentification réels ne sont pas modifiés. Le seul intégrateur modifie la branche de la PR #230 ; le suivi de la tâche existante dans Atelier conserve versions et décisions.
