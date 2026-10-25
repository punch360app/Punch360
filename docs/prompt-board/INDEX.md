# Suivi des prompts PUNCH 360°

**Initialisé :** 25 octobre 2026. **Source :** dossier Google Drive `promt`. **Ce registre est un inventaire initial, pas un audit du développement.**

Les documents Drive demeurent à leur emplacement; leur contenu brut n'a pas été copié dans ce dépôt public.

| ID | Document repéré dans Drive | Domaine | Statut | Développé | Testé | Déployé | Preuve / action |
|---|---|---|---|---|---|---|---|
| P-001 | `# PROMPT MAÎTRE OFFICIEL — PUNCH 36.txt` | Cahier des charges général | À auditer | Non évalué | Non évalué | Non évalué | Comparer à la roadmap et au code, dédupliquer |
| P-002 | `prompt paiement.txt` | Stripe / facturation | À auditer | Non évalué | Non évalué | Non évalué | Comparer au catalogue et aux recettes Stripe |
| P-003 | `PROMPT_FINAL_TESTS_PUNCH_ESSENTIEL_WORK.txt` | QA / livraison | À auditer | Non évalué | Non évalué | Non évalué | Comparer aux tests et recettes déjà réalisés |
| P-004 | `PROMPT_PUNCH_REMPLACEMENTS_QUARTS.txt` | Horaires / remplacements | À auditer | Non évalué | Non évalué | Non évalué | Comparer aux workflows existants |
| P-005 | `Sans titre` (commence par « PROMPT MAÎTRE — PUNCH 360° ESSENTIEL ») | GPS, dépenses, Wallet, événements, paie | À auditer | Non évalué | Non évalué | Non évalué | Décomposer en modules, vérifier doublons et dépendances |

**Documents supplémentaires à consulter :** `a lire en premier.txt` (instructions Drive); sous-dossiers `visuel borne` et `Visuel page dacuueil punch` (références UX). Les visuels ne sont pas automatiquement convertis en exigences terminées.

## Consolidation du 25 octobre 2026

Le giga-prompt de continuation GitHub a été rapproché du [Prompt maître](MASTER_PROMPT_20261025.md) : **453 IDs initiaux + 23 exigences de planification/absence + 4 exigences d'événements d'entreprise + 10 exigences de tâches/formations + 12 exigences de messagerie Essentiel Plus/Pro = 502 IDs uniques en 29 lots**. Les exigences déjà présentes (sécurité, Stripe, archives, RH, calendriers, quarts vacants, notifications) ont été **référencées**, et non recopiées. Les nouveautés sont intégrées aux groupes GOV/SHIFT/COVER/HR/QA. Les 5 fichiers Drive ci-dessous **ne sont pas automatiquement déclarés audités** par cette consolidation GitHub; ils restent à rapprocher individuellement du code et des tâches.

## Tableau récapitulatif initial
- Prompts repérés et indexés : **5**
- Prompts audités : **0**
- Prompts marqués terminés : **0** (cela ne signifie pas que zéro fonctionnalité du projet est déjà livrée)
- Synchronisation automatique Drive → GitHub : **non configurée**
- Exécution Work non sollicitée / en arrière-plan : **non configurée**

## Comment mettre un prompt à jour
1. Découper le prompt en tâches vérifiables, préférablement GitHub Issues; donner une issue à chaque lot distinct.
2. Vérifier dans le dépôt si le module est déjà codé avant de le marquer `À faire`.
3. Suivre : **Développé**, **Testé**, **Déployé**, **Intervention externe** sur chaque tâche.
4. Ajouter la PR, les commits et les tests comme preuves.
5. Ne passer à `Terminé` que si toute l'exigence est effectivement couverte, et pas parce qu'une PR contient une première version.
6. Actualiser `docs/PUNCH_MASTER_ROADMAP.md` si une exigence validée est ajoutée; ne pas écraser les autres suivis.

**Consulter le travail réel :** [Pull requests](https://github.com/punch360app/Punch360/pulls) · [Issues](https://github.com/punch360app/Punch360/issues) · [Roadmap](../PUNCH_MASTER_ROADMAP.md)
