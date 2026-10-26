
> **Décision du propriétaire — 26 octobre 2026 :** les forfaits actifs sont volontairement personnalisés. Essentiel : **19 $ CAD/mois, 20 membres inclus, +2 $/membre additionnel**; Plus : **39 $, 25 membres, +2 $**; Pro : **69 $, 50 membres, +2 $**; remise annuelle **15 %**. Conserver les versions actuelles du catalogue et **les six identifiants Stripe existants**, sans réinitialisation ni création automatique pour remplacer ces prix. L'ancienne grille 5 places et +3/4/5 $ est **historique et remplacée**. Préserver contrats/snapshots/produits, ne pas toucher Construction. Issue #90 résolue par confirmation du propriétaire; issue #35 encore ouverte pour les essais fournisseur.

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

Le giga-prompt de continuation GitHub a été rapproché du [Prompt maître](MASTER_PROMPT_20261025.md) : **453 IDs initiaux + 23 exigences de planification/absence + 4 exigences d'événements d'entreprise + 10 exigences de tâches/formations + 12 exigences de messagerie Essentiel Plus/Pro + 16 exigences de postes, échanges privés et banques d'over + 5 exigences d'horaires spéciaux/plages multiples + 11 exigences de marketing/UX/QA responsive  + 3 exigences de défilement intelligent et recette UX  + 5 exigences pour oublis d'arrivée/de départ et recette + 7 exigences de GPS mobile au pointage (3 modes, contrôles serveur et QA) + 2 exigences pour rappels de départ strictement fondés sur un horaire publié (HR-025, QA-028) + 17 exigences GOD MODE idées 5–12 (RH, planning, renfort, onboarding, relève, ventes, IA, sécurité, QA) + 10 exigences de changement Admin/Boss, identité multientreprise et horaire privé (INVITE-013–017, SEC-017, CAL-012–013, QA-031–032) = 578 IDs uniques en 29 lots**. Les exigences déjà présentes (sécurité, Stripe, archives, RH, calendriers, quarts vacants, notifications) ont été **référencées**, et non recopiées. Les nouveautés sont intégrées aux groupes GOV/SHIFT/COVER/HR/QA. Les 5 fichiers Drive ci-dessous **ne sont pas automatiquement déclarés audités** par cette consolidation GitHub; ils restent à rapprocher individuellement du code et des tâches.

## Passation vérifiée — ancien prompt « Validation SQL archives » (26 octobre 2026)

Les **tâches résiduelles** sont intégrées à la section `PASSATION DU PROMPT « VALIDATION SQL ARCHIVES »` du [prompt maître](MASTER_PROMPT_20261025.md). **Aucun nouveau fichier de prompt autonome, aucun nouvel ID ni nouvelle exigence** : les activités relèvent des IDs SAUTH/SACATALOG/STRIPE/INVITE/ARCHIVE/LOCALE/QA/SERVICES et de l'issue #35. Les correctifs archives déjà livrés (notamment PR #83, issue #81 fermée) ne sont pas repris. Cette passation ne change pas le statut des cinq prompts privés Drive, non audités à ce stade, ni le total de 578 exigences.

## Reprise Super Admin P0 — 26 octobre 2026

Le développement a repris **sur le code actuel**, sans créer un sixième prompt Drive ni modifier les **578 IDs**. Pour l'issue [#35](https://github.com/punch360app/Punch360/issues/35), le sous-lot de sécurité Boss « réponses de facturation tardives interentreprises » est développé dans la branche `fix/p0-boss-billing-tenant-race-20261026`; trois nouveaux tests Node/DOM et une réponse Edge sans détail SQL ont été ajoutés. **Développé : oui / Testé : CI à confirmer / Déployé : non vérifié / Intervention externe : Stripe sandbox + Edge + appareils.** Voir [preuve](../SUPER_ADMIN_BOSS_BILLING_RACE_20261026.md). Le suivi Drive P-001–P-005 **reste non audité**, sans changement artificiel.

## Tableau récapitulatif initial
## P0 — résultats vérifiés après reprise (26 octobre)

- **PR #89** fusionnée : Boss isolé entre compagnies lors des réponses asynchrones de devis/portail, CI TypeScript/Node/syntaxe réussie, GitHub Pages vert, Edge `essential-billing` v2 ACTIVE avec JWT activé. **Développé : oui / Testé : automatisé oui, Stripe fournisseur non / Déployé : Web et Edge oui / Intervention externe : Stripe sandbox et appareils.** Issue #35 maintenue ouverte.
- **Issue #90** créée suite à SQL strictement en lecture seule : forfaits publics actuellement à **20/25/50 places incluses et 2 $ par siège**, alors que la référence maître/seed est **5 et +3/+4/+5 $**. Historique du catalogue versionné et modifié par acteur. **Ne pas réinitialiser des prix ni modifier les contrats en production sans analyse.** Six tarifs Stripe enregistrés sans preuve d'API fournisseur.
- **Drive `promt` vérifié** : cinq fichiers de prompts déjà présents dans P-001–P-005, deux dossiers de visuels et `a lire en premier.txt`. Aucun nouvel identifiant ni audit complet des cinq déclaré. P-002 (`prompt paiement.txt`) **examiné sur son périmètre P0**, avec affirmations historiques de sandbox et noms de forfaits différents : le prompt maître plus récent et l'état du backend font foi; les accès fournisseur restent à vérifier. Aucun texte privé recopié sur GitHub.

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
