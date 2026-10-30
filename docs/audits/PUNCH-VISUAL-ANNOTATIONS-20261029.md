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

Dans la fenêtre PUNCH, choisir un des trois écrans puis activer **« Annoter un élément »**. Un clic sur un bouton ou champ réel enregistre un identifiant du nœud HTML (sélecteur CSS, écran et emplacement primaire/secondaire/web). L'action métier est bloquée seulement dans ce mode ; **« Tester les boutons »** réactive les vrais gestionnaires du contrôleur PUNCH. Le commentaire, sa cible et son statut sont conservés sur l'appareil dans `localStorage`, sous une clé isolée par `projectId`. Les repères se repositionnent depuis les boîtes géométriques des vrais nœuds HTML ; ils ne sont pas dessinés sur une capture écrasée.

L'export/import JSON versionné permet de remettre un fichier dans le chat. Il ne contient pas d'image client ni de secret, mais peut décrire le texte d'un écran fictif. Aucun envoi vers Atelier, GitHub, Supabase ou ChatGPT sans action manuelle. Les annotations ne sont pas automatiquement partagées entre S25, iPad et PC. Ne pas entrer de données client réelles dans l'aperçu. La version publiée reste **publique** en tant que page statique, tandis que le stockage des notes reste propre à chaque navigateur.

## Contrôles

- `tests/annotations-dashboard.test.mjs` : seule bibliothèque Atelier importée, unique `projectId`, callbacks publics, vraies fonctions PUNCH, zéro iframe/cadre/catalogue local, stockage et export bornés, CSP et requêtes fictives.
- `.github/scripts/visual-annotations.cjs` : dans Chromium 320/S25/iPad/PC, import réel du module partagé, rendu des vrais contrôles PUNCH dans le même document, clic métier fictif, clic d'annotation sans mutation, repère dans le DOM, export JSON et persistance locale après rechargement. Les captures d'essai sont archivées par la revue visuelle.
- Requête GitHub Actions en lecture seule pour les PR/tests publics : aucune déclaration « en direct » si l'API ne répond pas.

**Limites :** la simulation n'est pas une preuve de recette MFA/Auth/RLS, de pointage réel, de parité Android/iOS, de validation Figma, de synchronisation Atelier ou d'appareil physique. La bibliothèque commune fournit des tailles et cadres CSS, pas une émulation réelle iOS/Android. Ne pas déclarer le tableau « publié » avant checks CI réussis sur le SHA final, fusion, déploiement Pages confirmé et lecture réelle de l'URL.

## Préservation des travaux

PR #217 vitrine et #86 Storage laissées inchangées. Les données, droits, facturation, pointages, paie, QR Wallet et authentification réels ne sont pas modifiés. Le seul intégrateur modifie la branche de la PR #230 ; le suivi de la tâche existante dans Atelier conserve versions et décisions.
