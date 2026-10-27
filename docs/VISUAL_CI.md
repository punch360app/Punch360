# Punch 360° — QA visuelle automatique et non invasive

Les PR déclenchent des captures de la **vraie interface Web exécutée localement** (Playwright/Chromium) et, lorsqu'une référence du même écran est approuvée, une comparaison pixel à pixel. Le workflow archive captures, écarts, rapports et recommandations pendant 14 jours via GitHub Actions. Aucun outil de design externe n'est nécessaire.

- Workflow : `.github/workflows/visual-review.yml`
- Captures : `.github/scripts/visual-capture.cjs`
- Comparaison : `.github/scripts/visual-compare.cjs`
- Références optionnelles : `visual-baselines/<same screenshot filename>.png` et `manifest.json`
- Résultats : `visual-captures/report.json`, `review.html`, `WORK_VISUAL_FIX.md` et PNG de différences

**Une capture réelle n'est pas automatiquement une référence approuvée.** Sans approbation explicite et SHA-256 valide : état `awaiting-approved-baseline`, non `passed`. Un écart de dimensions ou plus de 5 % des pixels différents au seuil de canal 40/255 fait échouer la comparaison. Les animations WebGL et les polices peuvent nécessiter un protocole distinct; les dimensions, états et rôles comparés doivent être identiques. Les erreurs JS et défauts UX détectables restent signalés même sans référence.

**Sécurité :** premier périmètre = page Web publique déconnectée, données synthétiques et aucun accès aux comptes authentifiés, paiements ou Supabase de production. Les captures authentifiées nécessitent des comptes de test isolés et une autorisation spécifique. Aucun workflow ne modifie le code, les tarifs, les droits, la paie ni la production.

**Boucle Work :** une session Work **active** peut consulter les artefacts, corriger le vrai code, refaire une capture ciblée puis livrer en respectant CI et approbation. GitHub Actions ne peut pas réveiller Work ni poursuivre une session après sa fin. Pour revoir : Actions → `Punch 360 safe visual review` → dernier run → artefact `punch-visual-captures`.

Pour activer une comparaison, faire examiner au propriétaire un PNG du même écran et état, le placer dans `visual-baselines/`, enregistrer son SHA-256 et ses métadonnées dans le manifeste selon `visual-baselines/README.md`. **Jamais d'auto-approbation de baseline pour faire passer un test.**
