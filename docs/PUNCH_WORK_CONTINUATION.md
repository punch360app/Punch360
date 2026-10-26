# PUNCH 360° — État courant unique

## Lot actif — rappels de disponibilités internes (SHIFT-021, sous-parcours complet)

**PR [#136](https://github.com/punch360app/Punch360/pull/136)** — branche `feat/availability-reminders-inapp-20261026`, rebased sur `main` incluant les nouveaux **MLOC-001–008** de #135. Boss/Admin Plus/Pro choisit une semaine ISO, une date limite et éventuellement un département : aperçu sans écriture des salariés sans déclaration, ayant déjà déclaré, sans compte accessible et déjà rappelés. Après confirmation explicite : une notification **interne** unique par salarié/entreprise/semaine, lisible seulement par son destinataire; doublons bloqués par table privée et verrou transactionnel. Aucun SMS/Twilio, courriel, affectation, paie ou horaire publié modifié. Web et Expo.

**Base exclusive** `mlabstdxxwjdpfaxiwmg` : migration `20261026191607_essential_availability_reminders` **réellement appliquée**; `supabase/tests/essential_availability_reminders.sql` validé sur cette version avec deux entreprises synthétiques et **ROLLBACK** : preview sans écriture, une notification, répétition sans doublon, réponse existante, salarié sans compte, inbox privée, refus employé/autre entreprise et rôle anonyme interdit. Vérifications TypeScript/DOM vertes sur la branche avant rebase. **À finaliser** : CI dernier SHA PR #136, fusion et Pages SHA exact; recette Web authentifiée et appareils physiques encore non attestés.

## Dernier lot fusionné et publié — candidats de couverture Pro (SHIFT-021 partiel)

PR [#134](https://github.com/punch360app/Punch360/pull/134), fusion `c5e4deb47f9fe152e34f2f96aa45737de56f469b`, CI post-fusion [#40383097240](https://github.com/punch360app/Punch360/actions/runs/40383097240) **SUCCESS**, Pages [#40383097025](https://github.com/punch360app/Punch360/actions/runs/40383097025) **SUCCESS**, migration Supabase `20261026190002_qualified_coverage_candidates` et tests SQL ROLLBACK à 2 compagnies confirmés. Employé admissible par certification et disponibilité réelle ou « inconnu », sans offre automatique ni divulgation de notes privées. Physique Expo et recette navigateur authentifiée restent distincts.

## Parcours précédent — synthèse des déficits et copie indépendante (SHIFT-021/029 partiels)

PR [#133](https://github.com/punch360app/Punch360/pull/133) fusionnée, CI #40381240935 et Pages #40381240885 **SUCCESS**. La couverture par qualification est rapprochée des quarts vacants et heures planifiées sans somme fictive; les plages peuvent être copiées puis enregistrées comme nouvelles règles sans toucher à l'originale.

**Mise à jour : 26 octobre 2026.** Les décisions et l’ordre global sont dans le [maître](prompt-board/MASTER_PROMPT_20261025.md); point d’entrée [WORK_START](prompt-board/WORK_START.md). Les anciens états sont [archivés](prompt-board/history/CONTINUATION_BEFORE_CLEANUP_20261026.md), sans consigne de reprise active.

## Dernier parcours fonctionnel fusionné et publié

**Disponibilités hebdomadaires Essentiel Plus/Pro — SHIFT-016/017/018.** PR [#130](https://github.com/punch360app/Punch360/pull/130) fusionnée sur `7057c365a1de704bfc8e2af6cbb3b78fa7ad0326`. Employé : semaine type à plages multiples; Boss/Admin habilité : saisie pour un salarié actif, même sans compte; aperçu des conflits avec priorité absence/congé/exception/semaine type/inconnu. Aucun changement automatique des quarts, heures ou paie.

- **Développé :** Web/Expo et migration `20261026175720_essential_weekly_availability`; installation et SQL ROLLBACK sur deux compagnies fictives attestés dans #130, projet exclusif `mlabstdxxwjdpfaxiwmg`.
- **Testé :** CI tête #40373854973/#40373862707 et CI post-fusion [#40374125308](https://github.com/punch360app/Punch360/actions/runs/40374125308) **SUCCESS**.
- **Déployé :** Pages [#40374125469](https://github.com/punch360app/Punch360/actions/runs/40374125469) **SUCCESS** sur le SHA fusionné; recette navigateur authentifiée complète et appareils à prouver séparément.
- **Intervention externe :** build Expo installée et essais Android/iPhone non attestés; génération automatique et préférences complètes SHIFT-019–025 hors de cette PR.

**Parcours précédent :** absence volontaire et décision responsable, PR #129 fusionnée, migration `20261026163938` attestée, CI/Pages réussies. La recherche/attribution automatique d’un remplaçant n’est pas certifiée par ce lot.

## Maintenance documentaire de cette reprise

Branche `docs/master-execution-cleanup-20261026`. Nettoyage demandé par le propriétaire : prix actuels conservés, un ordre global et des jalons, blocages externes séparés, diagnostics datés archivés, suivi automatique et logo « Heure validée » explicites. Les 578 IDs antérieurs sont conservés. **Nouvelle demande ajoutée au maître : `SACATALOG-016`, membres inclus configurables ou illimités dans le Super Admin**, avec zéro supplément par membre en mode illimité et conservation des contrats. Cette capacité est spécifiée, **pas encore implémentée**; aucune preuve de réalisation ne lui est attribuée. Le total du suivi est recalculé depuis le maître. Cette maintenance ne prouve pas une livraison supplémentaire des modules métier. PR, SHA et CI font foi dans GitHub.

## Blocages distincts — ne pas refaire sans élément nouveau

| Domaine | Manque documenté | Intervention minimale / suite |
|---|---|---|
| Stripe, issue [#35](https://github.com/punch360app/Punch360/issues/35) | Migration `20261026110100_billing_confirm_intent` et publication Edge récentes non attestées dans les dernières preuves; recette sandbox complète manquante. | Valider migration et compatibilité clients/Edge, puis publier ensemble et tester paiement fictif/prorata/taxes/webhook/annulation/reprise sur sociétés fictives. Vérifier l’état réel avant toute application; si accès manque, le nommer et poursuivre un lot indépendant. |
| OAuth, issue [#102](https://github.com/punch360app/Punch360/issues/102) | Google/Apple, SMTP et recettes physiques encore incomplets. | Consoles/URL de retour/DNS et comptes de test/appareils; `SERVICES-001/002/008` hérite de la priorité Auth, ce n’est pas une tâche à attendre jusqu’aux SMS. |
| Archives/PRA | Pipeline Auth/Storage sur PDF synthétique et exercice PRA global non attestés. | Une recette intégrée avec cas négatifs, puis PRA isolé distinct; ne pas redévelopper le lecteur PDF #83 ni fusionner le brouillon #86 sans comparer le correctif déjà livré. |
| Appareils et services | Essais installés Android/iPhone/iPad, push/Wallet et couverture globale manquants. | Conserver les limites par parcours; tests automatisés et publication Pages ne les remplacent pas. SMS/Twilio en dernier. |

## Prochaine action exécutable

Contrôler la tête finale de la PR #136, fusionner si tous les contrôles sont verts, suivre **PUNCH 360 Web** sur le SHA fusionné, vérifier registre et pages publiées; ne pas compter SHIFT-021 comme terminé globalement. Ensuite besoins récurrents et exceptions SHIFT-020/029–033 et MLOC-001–008 selon priorité/permits, sans refondre l'architecture. Stripe #35/OAuth #102 restent dépendances externes distinctes; contrats, Prix 19/39/69 (20/25/50, +2, −15% annuel), Price IDs, Construction et SMS/Twilio dernier sont inchangés.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
