# PUNCH 360° — État courant unique

## Lot actif — clients et adresses d’intervention (MLOC-001)

**PR [#137](https://github.com/punch360app/Punch360/pull/137)** — `feat/essential-clients-intervention-sites-20261026`. Boss/Admin Essentiel : deux listes privées distinctes des **établissements** (clients et adresses d’intervention illimités), recherche, pagination 50 par page, ajout, édition optimiste, archivage sans suppression, adresse structurée, coordonnées facultatives, contact professionnel, instructions et notes réservées aux responsables. Web dans **Organisation**, Expo dans **Organisation**. Aucune création automatique d’établissement, job, quart, session/punch, borne ni ligne facturable. **MLOC-002–008 non livrés** : l’association des adresses aux véritables quarts/segments, GPS du bon lieu et changement de client sans sortie viendront séparément.

**Supabase exclusivement `mlabstdxxwjdpfaxiwmg` :** migration `20261026194235_essential_client_intervention_directory` **appliquée** et vérifiée. Tables RLS sans lecture directe authenticated, RPC Manager seulement, anon refusé. `supabase/tests/essential_client_intervention_directory.sql` exécuté **sur la base migrée avec BEGIN/ROLLBACK**, deux compagnies fictives, 107 adresses, pagination et recherche, modification versionnée, soft archive, droits salariés/interentreprises, aucun changement des établissements/jobs/horaires. Tests UI Node et TypeScript sur la branche; suivre la CI finale après cette passation. Aucun paiement ni données réelles touchés.

**Suite exacte :** fusionner la PR #137 si CI tête définitive verte et règles applicables satisfaites; surveiller le workflow Pages au SHA de fusion et le registre. Puis poursuivre **MLOC-002**, affectation réelle des adresses aux quarts via `scheduled_shifts`/jobs existants; commencer par inspecter `save_essential_local_shift`, éviter tout calendrier parallèle. Recettes authentifiées Web et installation Android/iPhone restent à prouver.

## Dernier lot fusionné et publié — rappels internes de disponibilités (SHIFT-021 partiel)

**PR [#136](https://github.com/punch360app/Punch360/pull/136)** fusionnée, commit `0fdc740ed825d0b0b47c374aad6cc4173f9924cf` ; TypeScript [#40385738525](https://github.com/punch360app/Punch360/actions/runs/40385738525) **SUCCESS**, Pages [#40385738566](https://github.com/punch360app/Punch360/actions/runs/40385738566) **SUCCESS** et registre [#40385741216](https://github.com/punch360app/Punch360/actions/runs/40385741216) **SUCCESS**. Migration `20261026191607_essential_availability_reminders` appliquée, SQL à deux compagnies validé en ROLLBACK. Une demande de disponibilités peut être prévisualisée, confirmée, notifiée en interne une seule fois par semaine; SMS/Twilio dernier. Aucune modification aux quarts. Recette physique non attestée.

## Parcours antérieur — couverture et candidats (SHIFT-021/029 partiels)

PR [#134](https://github.com/punch360app/Punch360/pull/134), fusion `c5e4deb47f9fe152e34f2f96aa45737de56f469b` et Pages #40383097025 **SUCCESS**, migration `20261026190002` appliquée; certificats/indisponibilités et refus multi-entreprises testés. PR [#133](https://github.com/punch360app/Punch360/pull/133), fusion `238d4b03f1788936aef9ef385675447d8221888b`, Pages #40381240885 **SUCCESS**; couverture par qualification rapprochée des quarts vacants et heures planifiées. Aucun générateur automatique entièrement livré.

**Mise à jour : 26 octobre 2026.** Les décisions et l’ordre global sont dans le [maître](prompt-board/MASTER_PROMPT_20261025.md); point d’entrée [WORK_START](prompt-board/WORK_START.md). Les anciens états sont [archivés](prompt-board/history/CONTINUATION_BEFORE_CLEANUP_20261026.md), sans consigne de reprise active.

## Historique — disponibilités hebdomadaires fusionnées

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

Vérifier la CI de la PR #137 sur la tête finale; si verte, fusionner, surveiller **PUNCH 360 Web** et le suivi sur le SHA fusionné. Si échec, lire le journal et corriger. Ne pas marquer MLOC-001 entièrement livré sans recette authentifiée Web et appareils physiques. Ensuite attaquer MLOC-002 par les quarts/jobs déjà présents, sans convertir les adresses des clients en succursales facturables. Priorités Stripe #35 et OAuth #102 restent bloquées par leur recette fournisseur. Préserver PR #135 (MLOC-001–008), SACATALOG-016 et #86 historique, tous les contrats et six Price IDs; SMS/Twilio dernier.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
