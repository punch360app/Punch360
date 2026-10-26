# PUNCH 360° — Départ unique de ChatGPT Work

## Reprendre l’état réel

1. Lire le [prompt maître](MASTER_PROMPT_20261025.md) : décisions actuelles, ordre global, exigences et critères du module choisi.
2. Lire **l’état courant unique** dans [PUNCH_WORK_CONTINUATION.md](../PUNCH_WORK_CONTINUATION.md). Les autres passations et anciens rapports sont historiques, pas des ordres de reprise.
3. Récupérer le dernier `main`; examiner les modifications locales, branches, PR, issues et workflows actifs. Préserver le travail des autres sessions. Vérifier code et preuves avant de refaire une fonction.
4. Choisir un parcours complet réalisable selon l’ordre global du maître. Corriger d’abord un défaut critique confirmé; un fournisseur bloqué ne bloque pas les lots indépendants. Sans élément nouveau, ne pas répéter l’audit Stripe, PDF ou Auth déjà conclu.

**Dépôt :** https://github.com/punch360app/Punch360. **Supabase exclusif :** `mlabstdxxwjdpfaxiwmg`. Construction et Essentiel restent distincts. Ne jamais recommencer le projet à zéro.

## Livrer et enchaîner

Un lot principal avec IDs, résultat utilisateur et critères de recette; au plus un lot indépendant pendant une attente. Regrouper les corrections liées. Développer, tester selon le risque, pousser une branche et une PR, suivre la CI obligatoire jusqu’au résultat final sur le bon SHA, corriger les échecs, fusionner selon les règles applicables, suivre le déploiement concerné et vérifier la version publiée. Actualiser la passation après un lot significatif et enchaîner sans demander « continue ».

Vérifier séparément Web Pages, SQL appliqué, Edge active, source Expo, build installée et recette appareil/fournisseur. Aucun statut livré par simple fusion ou simulation. Les tests pertinents accompagnent chaque lot; ne pas répéter une suite déjà verte sur du code inchangé sans raison nouvelle.

Si Stripe est bloqué : enregistrer l’étape exacte (migration validée, compatibilité serveur/clients, accès sandbox ou recette), puis avancer ailleurs. Aucun paiement réel, modification dangereuse de contrat, suppression irréversible de données réelles, restauration destructive ni désactivation de sécurité sans validation spécifique. Secrets et prompts Drive privés restent hors du dépôt public. SMS/Twilio en dernier.

## Catalogue actuel et logo

Décision propriétaire du 26 octobre 2026 : **19/39/69 $ CAD par mois; 20/25/50 membres inclus; +2 $ par membre additionnel; annuel −15 %; bornes 1/3/illimitées**. Le propriétaire a modifié Stripe volontairement. Préserver les six Price IDs, le catalogue actif et les snapshots contractuels. La table du maître est la référence documentaire; ne pas rétablir une ancienne grille depuis le seed ou un historique. Logo officiel **« Heure validée »**; utiliser les fichiers approuvés, sans inventer un remplacement.

Demande additionnelle `SACATALOG-016` : prévoir dans le Super Admin un nombre de membres inclus numérique configurable ou **illimité**; le mode illimité facture le prix de base avec zéro supplément par membre. Cette demande ne change pas automatiquement le catalogue actuel et reste à développer/valider.

## Suivi automatique obligatoire

- Inventaire : IDs stables du maître, sans doublons. Les nouvelles demandes distinctes utilisent le format `- [ ] **CODE-001** — Description` sous `## P2 — Titre (CODE, 1 points)`; une clarification complète l’ID existant.
- Dans chaque PR, indiquer uniquement les IDs réellement touchés : `PUNCH-PROGRESS: STRIPE-012, GOV-014`.
- Le workflow post-fusion met à jour `web/live/work-progress.json` avec PR et CI attestées. Il ne déduit jamais `deployed: true` d’une fusion.
- `node scripts/sync-tracker-master.mjs` synchronise inventaire, lots, total et instantané de `web/live/suivi.html` à partir du maître; exécuté par `npm test` et Pages. Ne pas maintenir de total fixe dans le HTML, les scripts ou les tests.
- Les trois compteurs sont **travail documenté / développement avec tests / livré et validé**. Les notes locales du propriétaire restent personnelles et ne les alimentent pas.
- Conserver séparément **développé / testé / déployé / intervention externe**. N’augmenter un statut qu’avec preuve pertinente. Vérifier après publication nouveaux IDs, total, ratios et conservation des preuves.

Drive `promt` et [INDEX.md](INDEX.md) servent à repérer les demandes nouvelles/modifiées quand l’accès existe. Ne pas relire systématiquement tous les documents privés déjà rapprochés sans changement. En l’absence d’accès, nommer ce blocage et avancer sur les exigences GitHub connues; ne pas inventer le contenu manquant.

La passation courante donne la prochaine action exacte. À une limite réelle d’exécution, sauvegarder le travail cohérent et les workflows à revérifier; ne pas annoncer une poursuite en arrière-plan.
