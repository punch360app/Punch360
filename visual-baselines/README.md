# Références visuelles approuvées — PUNCH 360°

Ce répertoire conserve les PNG de référence **explicitement approuvés par le propriétaire** pour comparer la vraie interface exécutée. Aucune image proposée par IA, capture automatique ou design conceptuel ne devient un standard sans validation. Le premier périmètre CI couvre uniquement l'interface Web **déconnectée**, pas les comptes employés/admin.

## Première activation

1. Ouvrir les captures réelles de l'artefact GitHub `punch-visual-captures` : S25 (412×915), iPad (820×1180) et PC (1440×900).
2. Préparer une référence du **même écran, même état, même rôle et même viewport**, éventuellement issue d'une version antérieure réellement validée ou d'un design explicitement approuvé.
3. Faire valider le PNG par le propriétaire. Ajouter `punch-S25-logged-out.png`, `punch-iPad-logged-out.png` ou `punch-PC-logged-out.png`.
4. Calculer `sha256sum visual-baselines/punch-S25-logged-out.png` puis renseigner `manifest.json` :

```json
{
  "screens": {
    "punch-S25-logged-out.png": {
      "approvedSha256": "REMPLACER_PAR_64_CARACTERES_HEXA",
      "approvedSource": "capture-reelle-validee",
      "screen": "logged-out",
      "approvedBy": "proprietaire",
      "approvedAt": "AAAA-MM-JJ"
    }
  }
}
```

`approvedSource` accepte `capture-reelle-validee` ou `design-valide`; la valeur documente la nature du visuel et ne remplace pas l'approbation. Cet exemple est un placeholder, **pas une autorisation**. Le manifeste actuel est intentionnellement vide. Faire approuver séparément toute mise à jour d'une baseline; ne jamais modifier une référence dans le seul but de rendre la CI verte.

## Automatisations et limites

- PR/push concernés, planification quotidienne et déclenchement manuel : Playwright capte des interfaces Chromium de test hors réseau externe, audite les erreurs JavaScript, le débordement et approximativement les cibles tactiles.
- Une référence approuvée, de même dimension et avec SHA-256 valide active une comparaison des pixels : écart >5 % au seuil de canal 40/255, ou dimensions différentes, donne `failed`.
- Sans référence approuvée : `awaiting-approved-baseline` et recommandations Work; **aucune prétention de conformité**.
- Les captures, HTML, JSON et images de diff sont conservés 14 jours comme artefacts du run.
- Work peut utiliser ces preuves **dans une session ouverte**; un workflow Actions ne démarrera ni ne pilotera Work en arrière-plan.
- Tester des parcours authentifiés nécessite un environnement de test isolé et des identités fictives. Aucune automatisation visuelle ne peut modifier Stripe, RLS, données Supabase, droits, pointages ou paie.
