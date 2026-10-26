# PUNCH 360° — Reprise autonome vérifiable

> **Lot additionnel P0-C (26 octobre)** : garde de déconnexion native et restauration hors ligne sur la branche `fix/p0-native-signout-offline-guard-20261026` ; détails dans [P0_NATIVE_SIGNOUT_GUARD_20261026.md](../P0_NATIVE_SIGNOUT_GUARD_20261026.md). Tests/PR à confirmer avant fusion. La recette Stripe reste bloquée par migration non installée, preuve en issue #35.

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
| **#114 : factures jusqu'à 100 + avertissement has_more** | **Fusionnée**, `71801cd3ac46e8bbfced435e26ba4104ba29289d` | **CI #40325978654 SUCCESS** | Edge/Expo non déployés; Pages Web à vérifier | Stripe fictif avec >100 factures |

| **#115 : valeurs des devis particuliers Super Admin** | **Fusionnée**, `779f303c3a79dbb92e765a6c690588da8b598cda` | **CI #40326701238 SUCCESS** | Code source dans main; Pages Web non confirmé | Boss et Stripe sandbox #35 |

## Blocages constatés : ne pas donner de GO commercial
- **#35 P0-A/P0-B :** Stripe produit/Price réel test, retour Checkout, prorata/taxes/remises, factures, reçus/webhooks et tests SQL sur **environnement isolé**. Le code Edge récent dépend de la migration `supabase/migrations/20261026110100_billing_confirm_intent.sql` (PR #108). **SQL puis Edge seulement après recette et validation de compatibilité** ; les anciens clients Expo avec timestamps de résiliation ne fonctionneront pas avec l'Edge UUID stricte #109.
- **#102 P0-C/P0-D :** fournisseur OAuth Google/Apple/SMTP et essais de deux comptes/entreprises sur appareils physiques, connexion hors ligne et révocation. Le succès CI Node ne remplace pas une build signée.
- **P1 ARCHIVE/QA :** PDF fictif réel dans Storage et restauration additive avec deux rôles, puis PRA PITR distinct; ne pas recréer le lecteur PDF #83 déjà terminé.
- **P4 :** SMS/Twilio uniquement en dernier selon décision du propriétaire.

## Reprise exacte — consignes d'exécution
1. Vérifier les PR et issues de `main` **y compris la #115 fusionnée**, les workflows GitHub et leur conclusion finale. Si test rouge, lire les logs, corriger et relancer; ne jamais fusionner CI rouge.
2. Lot P0-A `SACATALOG-005–014` : **PR #115 fusionnée et testée** pour les valeurs de départ des devis Super Admin. Prochaine étape exacte : **valider les actions fournisseur Stripe sandbox** (prix existants/absents, taxes/prorata, callbacks et webhooks) sur entreprises fictives; si impossible faute d'accès fournisseur, enregistrer le blocage #35 et choisir le prochain défaut P0 documenté, sans toucher aux contrats réels. Les PR #112–#114 sont fusionnées/testées mais leurs nouvelles fonctions Edge ne sont pas déployées.
3. Après chaque PR suivante : lire CI jusqu'au résultat final, corriger en cas d'échec, fusionner seulement vert, puis inspecter séparément GitHub Pages, Edge et builds Expo avant d'inscrire 'déployé'. Ne pas confondre merge GitHub, Pages, Supabase Edge et build Expo.
4. Reprendre **P0-A / P0-B** sur la prochaine lacune technique vérifiée (tarifs particuliers/Stripe et sécurité), sans se limiter à retoucher le même flux; enregistrer les éventuels blocages fournisseur, puis passer à **P0-C/P0-D** et ensuite aux P1.
5. Pour chaque lot garder quatre états séparés : développé, testé, déployé, intervention externe. **Ne déclarer terminé qu'avec preuves appropriées pour tout le parcours.**

Ce registre reflète les preuves en date du 26 octobre. Il doit être actualisé après la prochaine PR active et au début de chaque séance; les suivis historiques ne priment pas sur le code et les tests actuels.

## Point de contrôle suivant

**Blocage fournisseur non résolu :** issue [#35](https://github.com/punch360app/Punch360/issues/35). Le lot Stripe live/test ne peut pas recevoir de GO commercial sans configuration/recette réelle des ressources sandbox, ni sans migration SQL correspondante validée **avant** la publication des Edge. 

**Exigence indépendante encore réalisable :** P0-C SEC-017 / QA-032 : vérification serveur multientreprise avec deux comptes et rôles fictifs, droits RPC/RLS et caches hors ligne. Les correctifs #101–#106 n'en constituent qu'une partie; inspecter les tests existants pour éviter de les refaire. **Ne pas prétendre** que cette recette est achevée sans un environnement et une preuve concrets.
