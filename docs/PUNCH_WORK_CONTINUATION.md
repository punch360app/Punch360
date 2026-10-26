# PUNCH 360° — État courant unique

## Lot actif — adresser chaque quart au bon client (MLOC-002/004/006 partiels)

**PR [#138](https://github.com/punch360app/Punch360/pull/138)** — branche `feat/essential-shift-client-sites-20261026`. Boss/Admin Essentiel : recherche une adresse du carnet clients et l’associe à un **quart existant de `scheduled_shifts`** par version optimiste, sans réécrire dates/heure/salarié/job/pointage/GPS. Exemple de preuve : même salarié, 08:00–12:00 à Saint-Augustin-de-Desmaures, 13:00–16:00 à Charlesbourg, sous deux quarts, tous deux rattachés à un client et un lieu. Salarié voit seulement ses destinations, consignes d’accès non sensibles, contact professionnel et **Itinéraire** via ouverture volontaire de Google Maps; le texte interne du gestionnaire n’est jamais exposé. Une notification interne est envoyée au salarié assigné lorsqu’une adresse publiée change réellement, sans doublon lorsque la sélection est identique.

**Supabase exclusif `mlabstdxxwjdpfaxiwmg` :** migration additive `20261026200019_essential_shift_client_sites` **appliquée** sur le projet autorisé; FK composite par entreprise; RPC Manager et lecture des seules affectations personnelles ou autorisées; pas de droits anonymes. `supabase/tests/essential_shift_client_sites.sql` **SUCCESS sur la base migrée**, transaction **BEGIN/ROLLBACK** : deux compagnies, deux adresses de clients sur une même journée, version concurrente, avis au bon salarié, archive non destructrice, pas de fuite des notes internes ni de création de session punch/job. Tests Node/DOM et CI TypeScript source Web/Expo réussis sur la branche avant passation.

**À finaliser :** CI de la tête finale PR #138, fusion puis Web Pages sur SHA fusionné, registre automatique; inspection directe navigateur et installation Android/iPhone restent non attestées. Cette livraison ne réalise **pas encore** « changer de client sans sortie » durant une unique session de pointage, vue « par emplacement », estimation de trajets, affectations récurrentes multi-sites ou moteur GPS pour lieux client. Les IDs `MLOC-002`, `MLOC-004`, `MLOC-006` doivent rester **partiels**.

## Dernier lot fusionné et publié — carnet clients et adresses (MLOC-001)

PR [#137](https://github.com/punch360app/Punch360/pull/137) fusionnée sur `99d1cb6685cee9ae487632540a9f68925f75de3a`; CI post-fusion [#40389621191](https://github.com/punch360app/Punch360/actions/runs/40389621191) **SUCCESS**, Pages [#40389621185](https://github.com/punch360app/Punch360/actions/runs/40389621185) **SUCCESS**. Migration `20261026194235_essential_client_intervention_directory` appliquée et 107 adresses fictives testées en ROLLBACK. Clients et lieux illimités, recherches, pagination, archivage, versions, confidentialité manager, aucune succursale/borne/membre facturable créée. Recette Web authentifiée et installation native ouvertes.

## Lot antérieur publié — rappels internes de disponibilités (SHIFT-021)

PR [#136](https://github.com/punch360app/Punch360/pull/136), Pages [#40385738566](https://github.com/punch360app/Punch360/actions/runs/40385738566) **SUCCESS**, migration `20261026191607_essential_availability_reminders` appliquée. Rappel interne d’une semaine avec aperçu et confirmation, sans doublon, sans Twilio ni changement d’heures. Les blocages OAuth/Stripe sont séparés.

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

Vérifier les contrôles GitHub obligatoires du dernier SHA de #138. Si verts, fusionner puis vérifier la publication Pages et le registre sur SHA fusionné; garder MLOC-002/004/006 partiels sans recette appareil/navigateur authentifié. Prochain parcours : MLOC-003 vue calendrier « Par employé / Par emplacement » fondée sur `scheduled_shifts.client_site_id`, **sans** calendrier parallèle; puis préparer MLOC-004 transfert de lieu sous la même session avec mécanisme serveur transactionnel et idempotent (ne jamais transformer ce transfert en sortie ou double temps). Préserver toutes demandes Pro ajoutées par les autres collaborateurs, SACATALOG-016, tarifs/Price IDs, Construction séparée et SMS/Twilio dernier.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
