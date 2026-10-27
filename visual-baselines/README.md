# References Figma approuvees — PUNCH 360°

Aucune image de cette arborescence ne doit etre generee ou acceptee automatiquement comme verite visuelle. Le workflow capture **la vraie interface Web deconnectee**, et non les parcours employe ou Super Admin connectes.

## Premiere activation

1. Ouvrir la maquette Figma : https://www.figma.com/design/m3y6yfu7LL84Dp9ntGOXYZ?node-id=14-10
2. Creer ou confirmer une frame du **meme ecran deconnecte et du meme etat** que la capture Chromium a comparer (pas une maquette de tableau de bord connecte).
3. Depuis les artefacts GitHub `punch-visual-captures`, regarder le rendu reel pour S25 (412x915), iPad (820x1180) et PC (1440x900). Exporter une reference PNG strictement a la taille de la capture cible. Ne pas inserer d'identifiants ou donnees reels.
4. Verifier visuellement la reference avec le proprietaire. Ajouter le PNG dans ce dossier sous l'un des noms : `punch-S25-logged-out.png`, `punch-iPad-logged-out.png`, `punch-PC-logged-out.png`.
5. Calculer son empreinte (Linux/macOS : `sha256sum visual-baselines/punch-S25-logged-out.png`) et renseigner `manifest.json` :

```json
{
  "screens": {
    "punch-S25-logged-out.png": {
      "approvedSha256": "REMPLACER_PAR_64_CARACTERES_HEXA",
      "figmaNodeId": "NOEUD_EXACT_DU_MEME_ECRAN",
      "screen": "logged-out",
      "approvedBy": "proprietaire",
      "approvedAt": "AAAA-MM-JJ"
    }
  }
}
```

Les exemples ci-dessus sont des placeholders, **pas une approbation**. Commencer par le manifeste vide present dans ce repertoire. Soumettre la nouvelle reference et son manifeste a une revue humaine distincte de tout changement de design. Ne jamais modifier les references pour simplement faire passer un test rouge.

## Automatisations effectives

- Chaque PR ou push `main` touchant le Web / scripts / references, et une fois par jour : Playwright prend les vraies captures Chromium **hors ligne vis-a-vis des services externes**.
- Le script audite debordement horizontal, tailles approximatives des cibles tactiles et erreurs JS.
- En presence de references approuvees, les differences pixel a pixel generent une image de diff et echouent au-dessus de 5 % de pixels differents (seuil de canal >40), ou sur dimensions differentes.
- Avec reference absente : etat explicite `awaiting-approved-Figma-baseline`, jamais `passed`. Une empreinte non conforme ou des metadonnees d'approbation incompletes echouent.
- GitHub conserve pendant 14 jours `report.json`, `review.html`, `WORK_VISUAL_FIX.md`, les captures et, au besoin, les differences.
- `WORK_VISUAL_FIX.md` est une **passation a Work** quand une session Work est active. GitHub Actions ne peut pas demarrer une session ChatGPT Work ni corriger le code de facon autonome.

## Ce qui reste a integrer

- Synchronisation bidirectionnelle Figma <-> GitHub ou depot automatique de captures directement dans le fichier Figma : **pas actif**. Ne pas exposer de jeton Figma dans un workflow public ou des artefacts. La connexion necessiterait un mecanisme autentifie, restreint et approuve.
- Captures des parcours employe/admin authentifies : seulement dans un environnement de test isole avec donnees synthetiques, jamais sur la production.
- Les noeuds Figma 14:14 (mobile employe) et 14:45 (Super Admin tablette) sont **conceptuels** et ne doivent pas etre compares aux captures `logged-out`.

La verification porte sur l'interface Web deconnectee seulement. Les outils visuels ne modifient jamais Stripe, RLS, les donnees Supabase, les comptes, les pointages ou la paie.
