# PUNCH 360° — Départ unique de ChatGPT Work

## Reprendre l’état réel

1. Lire le [prompt maître](MASTER_PROMPT_20261025.md) : décisions actuelles, ordre global, exigences et critères du module choisi.
2. Lire **l’état courant unique** dans [PUNCH_WORK_CONTINUATION.md](../PUNCH_WORK_CONTINUATION.md). Les autres passations et anciens rapports sont historiques, pas des ordres de reprise.
3. **Une fois au début de chaque reprise**, récupérer le dernier `main` et examiner uniquement les PR, branches, modifications locales et workflows **actifs ou pertinents au lot retenu**. Vérifier les fichiers concernés avant d'écrire. Ensuite suivre seulement les nouveaux changements, sans refaire l'audit global à chaque commit, test, PR ou déploiement. Préserver le travail concurrent.
4. Choisir un parcours complet réalisable selon l’ordre global du maître. Corriger d’abord un défaut critique confirmé; un fournisseur bloqué ne bloque pas les lots indépendants. Sans élément nouveau, ne pas répéter l’audit Stripe, PDF ou Auth déjà conclu.

**Dépôt :** https://github.com/punch360app/Punch360. **Supabase exclusif :** `mlabstdxxwjdpfaxiwmg`. Construction et Essentiel restent distincts. Ne jamais recommencer le projet à zéro.

## Mode accéléré — exécution prioritaire (26 octobre 2026)

**Objectif : des parcours utilisables, pas une accumulation de micro-PR et de rapports.** Viser de manière indicative environ **80 % d'effort d'implémentation / 20 % de validation et coordination**, sans jamais diminuer les contrôles obligatoires.

1. **Inspection initiale unique et ciblée.** Lire les décisions/IDs pertinents du maître, la dernière passation et l'état actuel de `main`. Examiner les PR ouvertes et branches qui chevauchent le lot. Inspecter la base Supabase uniquement si un changement SQL, permission ou défaut DB le justifie. Ne pas relire à chaque reprise toutes les anciennes PR, 691 exigences, migrations, logs, documents Drive ou historiques.
2. **Regrouper les travaux en un vrai parcours.** Livrer ensemble UI Web/Expo pertinentes, serveur/RPC/SQL si nécessaires, rôles, gestion des erreurs et tests, dans **une seule PR cohérente par parcours**. Pas de micro-PR pour chaque filtre, bouton, message ou compte rendu lorsqu'ils appartiennent au même résultat métier. Exceptions : défaut critique P0, risque indépendant ou blocage réel.
3. **Validation proportionnée.** Pendant le développement, lancer les tests ciblés touchés. Avant fusion, attendre tous les contrôles GitHub obligatoires sur le **SHA final**. Ajouter les tests SQL/multi-compagnies/sécurité propres aux changements concernés. Corriger les échecs prouvés; ne jamais contourner les protections ni relancer une suite verte inchangée sans nouvelle raison.
4. **Finir et publier.** PR prête (éviter un brouillon sans raison), CI finale, fusion permise, déploiement pertinent, vérification de la version publiée. Distinguer source Web, migration SQL réellement appliquée, Edge déployée, Expo compilée et appareil testé. Durant une attente, préparer au plus un lot indépendant sans collision, pas un audit complet supplémentaire.
5. **Suivi léger.** Inscrire les IDs réellement touchés dans `PUNCH-PROGRESS`; laisser le workflow automatiser le registre. Mettre à jour la passation **brièvement à la livraison significative ou à la fin réelle de session** (résultat, PR/SHA, preuve, blocage, prochaine action). Pas de long rapport pour chaque micro-correction.
6. **Ne pas re-diagnostiquer ce qui est déjà confirmé.** Aucun nouvel audit Stripe, Auth, PDF, tarification ou anciennes migrations sans changement pertinent ou défaut reproductible. Si un fournisseur bloque, préciser l'étape exacte et avancer sur le prochain parcours indépendant.
7. **Sécurité non négociable.** Préserver isolation des compagnies, RLS, permissions, intégrité des heures/paies, idempotence des paiements et pointages, secrets, vérifications de contrats et validation spécifique des actes financiers/destructifs. Ne jamais appeler « livré » une simulation ou une simple fusion.

Ces règles optimisent la cadence, **sans supprimer ni renuméroter les exigences du maître**. Si un ancien texte exige des inspections ou comptes rendus répétitifs, appliquer le mode accéléré; si un contrôle de sécurité ou CI est requis, l'exécuter entièrement.

## Clôture prioritaire des parcours (27 octobre 2026)

Appliquer les **Règles de clôture des parcours** du maître : achever le parcours réalisable avant d'en étendre un autre, regrouper ses variantes liées et rattacher les preuves réelles de publication dans le même lot. Aucun lot autonome de documentation, audit général ou suivi sans demande propriétaire ou défaut confirmé. Le bilan dit ce qui est utilisable, ce qui manque et la prochaine action; les ratios de preuves ne sont jamais un pourcentage global du projet. Ne pas terminer volontairement la session à une attente CI, un commit ou une PR; suivre le résultat et enchaîner dans la durée réelle disponible. Les contrôles de sécurité et CI finale restent obligatoires.

## Livrer et enchaîner

Un lot principal couvrant un parcours métier utilisable avec IDs, résultat utilisateur et critères de recette; au plus un lot indépendant pendant une attente. Regrouper les corrections liées. Développer, tester selon le risque, pousser une branche et une PR, suivre la CI obligatoire jusqu’au résultat final sur le bon SHA, corriger les échecs, fusionner selon les règles applicables, suivre le déploiement concerné et vérifier la version publiée. Actualiser la passation après un lot significatif et enchaîner sans demander « continue ».

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
