# PUNCH 360° — Reprise autonome vérifiable

**Actualisation : 26 octobre 2026.** Ce fichier mémorise le point d'arrêt et les preuves récentes, **sans remplacer les 578 exigences du prompt maître**.

## Source et protection
- Dépôt : https://github.com/punch360app/Punch360 ; reprendre exclusivement le dernier `main`.
- Prompt maître : `docs/prompt-board/MASTER_PROMPT_20261025.md` ; ordre des 29 lots P0 → P4.
- Supabase **uniquement** `mlabstdxxwjdpfaxiwmg`. Aucun autre projet; pas de SQL destructif, Stripe live, email/SMS réels ni restauration destructive.
- **Tarifs du propriétaire intangibles** : Essentiel 19 $ (20 inclus), Plus 39 $ (25), Pro 69 $ (50), **+2 $ par place**, annuel −15 % ; six Price IDs et snapshots historiques préservés. Édition Construction indépendante.
- Suivi visuel : `web/live/suivi.html` (PR #111 fusionnée), 578/29 ; ses notes locales **ne reflètent pas automatiquement** GitHub.

## Preuves P0 déjà fusionnées
| Lot / portée | Développé | Testé | Déployé | Intervention externe |
|---|---|---|---|---|
| #101–#106 : Auth mobile, OAuth cold start et isolation identité/stockage | PR fusionnées | CI Node/TS réussies | Source GitHub, **builds natifs non prouvés** | OAuth Google/Apple et QA Android/iPhone, issue #102 |
| #107–#110 : Stripe : basket signé, devis, reprises, protection Boss entre entreprises | PR fusionnées | CI réussies | Nouvelles Edge **non publiées** | Fournisseur Stripe sandbox, issue #35 |
| #111 : Centre de suivi HTML 578 exigences | PR fusionnée | CI #40322622716 réussite | Fichier présent dans main ; publication GitHub Pages à vérifier indépendamment | Aucune synchronisation automatique des statuts |
| **#112 : états résiliation/reprise** | Fusionnée, `e74a13faab5c46f6ee1e1e5b0560da4608f43c36` | **CI #40324356469 SUCCESS** après un ancien test adapté | **Pas de déploiement Edge vérifié** | Recette Stripe sandbox #35 |
| **#113 : requêtes Stripe bornées à 4 Kio / webhooks 1 Mio** | Fusionnée, `7be1d3c448830eac972c23c8100e24b46934738e` | **CI #40325182072 SUCCESS** après correction du préchargement simulé | **Pas de déploiement Edge vérifié** | Vérification signature/réseau avec Stripe sandbox #35 |
| **#114 : factures jusqu'à 100 + avertissement has_more** | **PR en revue / à fusionner après CI** | CI et merge à vérifier avec HEAD courant | **Non déployé** (Edge/Expo/Web à distinguer) | Stripe fictif avec >100 factures |

## Blocages constatés : ne pas donner de GO commercial
- **#35 P0-A/P0-B :** Stripe produit/Price réel test, retour Checkout, prorata/taxes/remises, factures, reçus/webhooks et tests SQL sur **environnement isolé**. Le code Edge récent dépend de la migration `supabase/migrations/20261026110100_billing_confirm_intent.sql` (PR #108). **SQL puis Edge seulement après recette et validation de compatibilité** ; les anciens clients Expo avec timestamps de résiliation ne fonctionneront pas avec l'Edge UUID stricte #109.
- **#102 P0-C/P0-D :** fournisseur OAuth Google/Apple/SMTP et essais de deux comptes/entreprises sur appareils physiques, connexion hors ligne et révocation. Le succès CI Node ne remplace pas une build signée.
- **P1 ARCHIVE/QA :** PDF fictif réel dans Storage et restauration additive avec deux rôles, puis PRA PITR distinct; ne pas recréer le lecteur PDF #83 déjà terminé.
- **P4 :** SMS/Twilio uniquement en dernier selon décision du propriétaire.

## Reprise exacte — consignes d'exécution
1. Vérifier les PR et issues de `main` **y compris la #114**, les workflows GitHub et leur conclusion finale. Si test rouge, lire les logs, corriger et relancer; ne jamais fusionner CI rouge.
2. Terminer le lot P0 `STRIPE-012` **dans la PR #114** : fichiers `supabase/functions/essential-billing/index.ts`, `web/live/billing.js`, `src/billing/BillingPanel.tsx`, `tests/essential-stripe-invoice-history.test.mjs`, `docs/BILLING.md`. Aucun SQL live.
3. Après CI verte, fusionner, mettre à jour ce registre avec SHA/CI/conclusion et regarder le workflow GitHub Pages distinct. Ne pas confondre merge GitHub, Pages, Supabase Edge et build Expo.
4. Reprendre **P0-A / P0-B** sur la prochaine lacune technique vérifiée (tarifs particuliers/Stripe et sécurité), sans se limiter à retoucher le même flux; enregistrer les éventuels blocages fournisseur, puis passer à **P0-C/P0-D** et ensuite aux P1.
5. Pour chaque lot garder quatre états séparés : développé, testé, déployé, intervention externe. **Ne déclarer terminé qu'avec preuves appropriées pour tout le parcours.**

Ce registre reflète les preuves en date du 26 octobre. Il doit être actualisé après la fusion de la PR #114 et au début de chaque séance; les suivis historiques ne priment pas sur le code et les tests actuels.
