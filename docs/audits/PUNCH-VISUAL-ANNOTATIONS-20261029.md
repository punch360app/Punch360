# PUNCH 360 — tableau de bord d'annotations visuelles (29 octobre 2026)

## Objet et limites

Nouvel écran autonome `web/live/annotations.html`, accessible après publication du dossier `web/live` sur GitHub Pages. Conserver le flux métier et les travaux ouverts : PR #217 (vitrine), PR #86 (Storage). Aucun compte, rôle, jeton, paiement, migration ou RPC Supabase supplémentaire.

L'écran propose :
- **Suivi GitHub public en lecture seule** : demandes de fusion ouvertes et résultats récents des workflows, rafraîchissement approximatif à trois minutes, lien direct vers GitHub. Ces données ne sont pas un contrôle direct de l'ordinateur de Work, et une erreur réseau doit apparaître comme « Non disponible » plutôt que comme une preuve de réussite.
- **Captures réelles fournies volontairement** par le propriétaire : PNG, JPEG ou WebP (12 Mo maximum par image). Le tableau ne fabrique pas de capture prétendant illustrer l'application réelle.
- **Annotations de repère, rectangle ou flèche**, note libre et statut (à corriger/en cours/à vérifier/approuvée) sur un écran et une version AVANT ou APRÈS, avec comparaison côte à côte.
- **Conservation sur le navigateur local** via IndexedDB, sans upload automatique vers GitHub, Atelier, ChatGPT ou Supabase. Import/export manuel d'un JSON versionné contenant les images et notes. L'import crée de nouveaux identifiants et ne remplace pas les captures existantes.
- **Responsive et accessibilité** : menus téléphone/S25/iPad/PC, boutons tactiles, dialogues, états vides, messages de retour, clavier; palette sauge approuvée.

## Vérification et critères

La revue de code et tests `tests/annotations-dashboard.test.mjs` protègent le point d'entrée, les outils, limites de fichier, CSP et stockage local. `.github/scripts/visual-annotations.cjs` simule une capture PNG sans donnée réelle sur 320 px/S25/iPad/PC : création, ajout de repère et zone, sauvegarde après rechargement, comparaison, export JSON et import; vérification du débordement horizontal. Les captures d'essai sont conservées dans l'artefact visuel du workflow (preuve d'interface synthétique, pas recette réelle).

**À ne pas présenter comme terminé sans preuve :** synchronisation Julien–Fred automatique, transfert vers Atelier, édition concurrente, capture directe de l'application connectée, vraie comparaison avec design Figma approuvé, publication Pages effectivement servie, tests sur appareils physiques. Pour partager une demande, le propriétaire exporte le JSON, le joint au chat et valide ce qui est à traiter. Les statuts de ses annotations ne modifient pas automatiquement les tickets GitHub ou Atelier.

**Confidentialité :** ne pas importer d'image contenant des données client réelles, NIP, clés, QR privés ou justificatifs; les copies locales et les fichiers JSON exportés ne sont pas un coffre-fort privé. Une URL GitHub Pages est publique, mais les captures ne sont pas publiées par cette fonctionnalité. Si le navigateur est réinitialisé ou son stockage saturé, une exportation est nécessaire pour garder les annotations.

## Prochaine étape prévue

Après CI et fusion, vérifier que `https://punch360app.github.io/Punch360/annotations.html` sert les trois fichiers à la même version. Faire une revue avec de vraies captures anonymisées et le propriétaire, sans appeler ces résultats une recette de l'application complète. Une synchronisation partagée ne sera envisagée qu'avec exigences explicites d'accès, d'isolation et d'approbation, et sans auto-envoyer des fichiers clients.
