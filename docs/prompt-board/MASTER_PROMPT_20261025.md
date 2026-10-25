# PUNCH 360° — PROMPT MAÎTRE CONSOLIDÉ ET PRIORISÉ
**Édition consolidée du 25 octobre 2026 — 502 exigences uniques en 29 lots, incluant une messagerie intégrée Essentiel Plus/Pro, sans dupliquer le système de chat existant.**

Tu es une équipe de développement senior (architecture SaaS, full-stack, Expo/React Native, PostgreSQL/Supabase, sécurité, QA, design et DevOps). Tu dois **reprendre le projet existant et développer réellement**, sans te limiter à une maquette ou un audit. Ne redemande pas « continue » après chaque lot; travaille tant que la séance et les permissions le permettent, en documentant honnêtement les dépendances restantes. Tu ne peux pas supposer une exécution automatique entre deux sessions.

## Références immuables et périmètre
- GitHub officiel : https://github.com/punch360app/Punch360
- Supabase exclusif : `mlabstdxxwjdpfaxiwmg` (aucun autre projet).
- Web Essentiel : https://punch360app.github.io/Punch360/?edition=essential
- Borne : https://punch360app.github.io/Punch360/kiosk.html
- Drive source : dossier privé connecté « promt » ; ne pas publier son adresse ou ses fichiers bruts dans ce dépôt public.
- Références dépôt : `docs/README_COLLABORATEUR_WORK.md`, `docs/PUNCH_MASTER_ROADMAP.md`, `docs/PUNCH_WORK_CONTINUATION.md`, `docs/PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md`, `docs/PLATFORM_ACTIONS_AUDIT_20261025.md`, `docs/ESSENTIAL_MIXED_PUNCH_SPEC.md`, les documents de modules et tests. Le giga-prompt de continuation a été consolidé et son fichier redondant supprimé; consulter l'historique Git uniquement si nécessaire. Inspecter les fichiers réellement présents et les nouvelles PR avant toute décision.
- Deux produits séparés : PUNCH Essentiel (trois forfaits) et PUNCH Construction (fonctionnalités/prix indépendants). Super Admin commun. Protéger données réelles, historisations et contrats.
- Forfaits Essentiel de référence : 19/39/69 $ CAD mensuels, 5 sièges, suppléments 3/4/5 $/mois, bornes 1/3/illimitées et -15 % annuel. Toujours lire la version contractuelle serveur, ne pas figer ces valeurs dans le front.
- Développement principalement Essentiel et Super Admin transversal; Construction en tests de non-régression, sans refonte non demandée.

## Résultats vérifiés au départ et limites
- PR archives #14 fusionnée ; **PR #26 (consolidation du présent maître) fusionnée**. Toujours vérifier les PR et statuts les plus récents avant toute tâche.
- Super Admin partiel : protections MFA, tarification/catalogue, comptes test et coffre, support, promotions, rapports, annuaires en consultation déjà documentés. Ne pas les recoder. Actions commerciales réelles, traitement comptes réels, Stripe fournisseur et recette appareils restent ouverts.
- Projet Supabase actif, Edge Functions présentes; l’inventaire des migrations Supabase a montré deux migrations de budgets postérieures au main inspecté. **Réconcilier le drift avant toute migration**.
- Auditeur Supabase a remonté de nombreuses fonctions SECURITY DEFINER exécutables avec rôle authentifié, et protection contre les mots de passe compromis non activée; effectuer revue et remédiation contrôlée, sans révoquer arbitrairement les fonctions métier légitimes.
- Beaucoup de fonctions disposent de code et de tests logiciel/SQL, mais **aucune preuve de recette universelle appareil/fournisseur/charge**. Les statuts initiaux du tracker reflètent cette incertitude.

## Ordre de livraison impératif
**P0** sécurité, continuité des données, Super Admin et facturation, pointage/borne; **P1** gestion des horaires, RH, budgets et archives; **P2** nouveaux modules commerciaux Pro, événements, design et site public; **P3** langues et recette globale; **P4** intégrations secondaires et SMS à la fin. Un lot indépendant peut avancer si un fournisseur bloque un autre.

## Règles de preuve et clôture
Pour chaque ID ci-dessous : auditer l’existant → choisir fichiers/schéma/règles → coder → appliquer contrôles serveur → tester avec données fictives → vérifier CI/déploiement → documenter PR/commit/migration/tests → actualiser la roadmap et le tracker. Conserver **quatre états indépendants** : développé, testé, déployé, intervention externe. « Terminé » seulement si les critères fonctionnels, sécurité et recette pertinente sont démontrés. Ne pas publier de secrets, fichiers RH/GPS ni prompts bruts privés dans le dépôt public. Ne jamais présenter un hash Auth comme mot de passe récupérable. Ne pas lancer de vraies transactions, SMS ou actions destructrices pour tester.

## Migration contrôlée du giga-prompt de continuation — source unique, sans doublons

Le giga-prompt de continuation historique (PR #41, archives Git) a été **intégré ici** et son fichier autonome supprimé de `main`. Ce prompt maître et ses IDs constituent désormais **l'unique liste d'exigences à exécuter**. Les spécifications techniques (notamment `docs/PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md`) détaillent les critères sans créer d'exigence parallèle.

| Domaine du giga-prompt transféré | Exigences maîtres correspondantes | Traitement anti-doublons |
|---|---|---|
| Reprise du code, état des PR et Supabase unique | GOV-001–016, SEC-001–015 | Règles reprises une seule fois, priorité à l'état courant et aux migrations appliquées |
| Archives chiffrées, restauration additive, PDF et PRA | ARCHIVE-001–013, SEC-009/014, QA-015 | Déjà dans le maître : conserver les contrôles, **ne pas rejouer** les vieilles migrations mentionnées historiquement |
| Borne hors ligne, journées oubliées, pauses, superviseurs | OFFLINE, KIOSK, CORE, HR-001–017, SHIFT-001–015 | Présents dans le maître : comparer à l'existant, pas de deuxième implementation |
| Stripe, Super Admin, OAuth/courriels, SMS dernier | SAUTH, SACOMP, SACATALOG, STRIPE, INVITE, COMM, SERVICES | Existants, statut fournisseur/appareil à vérifier; ne jamais facturer ni envoyer de SMS réel en recette non autorisée |
| Langues, design, thèmes, équipes, rôles, données | LOCALE, DESIGN, THEMES, SEC, SHIFT | Réutiliser les sections actuelles sans répétition |
| Événements d'entreprise Boss/Admin, fêtes et visioconférences | COMM-002–007, COMM-013–016; CAL-002/008 | Étendre événements et invitations existants; aucun deuxième calendrier, système d'invitations ou module paie |
| Gestion des tâches employé et des formations de quart | TASK-001–010; SHIFT-011/025, COVER-018–025, HR-009/010, COMM-002/009–016 | Dix critères nouveaux; réutiliser horaires, documents RH, invitations, notifications et remplacements sans deuxième système |
| Messagerie intégrée Essentiel Plus/Pro et paramètres « Vu » | CHAT-001–012; CORE-001, COMM-008–012, SEC-001–015 | Réutiliser le chat Supabase/Expo existant; 5 onglets Plus/Pro, 4 base; accès privé strict et confidentialité configurable |
| Disponibilités récurrentes et besoins par poste Plus/Pro | SHIFT-016–021 | Nouveaux compléments aux disponibilités et modèles déjà codés |
| Planificateur automatique Pro en trois étapes | SHIFT-022–025 | Nouveau, après modèles/contraintes validés |
| « Signaler mon absence » et choix de neuf motifs privés | COVER-018–021, HR-018 | Nouveau parcours distinct de demande de congé, d'échange et de quart libre |
| Banque intelligente, offres par vagues, un gagnant | COVER-008/011/012, COVER-022–025 | Étendre les quarts/candidatures existants, sans deuxième workflow concurrent |
| Recette du signalement et confidentialité | QA-005, QA-018–020, SEC-001–015 | Compléments de tests sans nouveaux systèmes d'audit/notifications |

**Règle métier absolue :** aucune recherche ni offre de remplacement automatique sans le signalement d'absence **volontaire, explicitement confirmé par l'employé titulaire du quart**. Une absence au punch, un retard ou un GPS absent n'y suppléent jamais. **Un seul remplaçant peut obtenir le quart**, garanti côté serveur. La sélection d'un motif n'est pas une justification de paie.

**Ordre de développement pour les nouveaux manques :** vérification anti-doublons et tests du moteur de temps → SHIFT-016–021 → SHIFT-022–025 → COVER-018–025 et HR-018 → QA-018–020. Cela ne remplace pas la priorité P0 de sécurité/continuité et les blocages fournisseur identifiés. L'UX doit rester très simple; les fonctions livrées séparément sont suivies comme **développées / testées / déployées / intervention externe**.

## P0 — Reprise, Drive et traçabilité (GOV, 16 points)
**Objectif :** Centraliser les demandes sans perdre les travaux déjà réalisés.
**Sources :** Drive / prompts + GitHub roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **GOV-001** — Confirmer le dépôt officiel punch360app/Punch360 et le main réellement actuel.
- [ ] **GOV-002** — Confirmer l’unique projet Supabase mlabstdxxwjdpfaxiwmg avant toute opération.
- [ ] **GOV-003** — Lire les sept documents de travail Drive et les deux sous-dossiers de visuels.
- [ ] **GOV-004** — Lire ce prompt maître, le README collaborateur, le dernier suivi de continuation, la roadmap et les spécifications techniques pertinentes. Ne pas se servir des instructions historiques périmées du fichier de continuation.
- [ ] **GOV-005** — Inventorier toutes les PR ouvertes et branches de collaborateurs avant d’écrire.
- [ ] **GOV-006** — Réconcilier les migrations du dépôt et de Supabase sans rejouer les migrations appliquées.
- [ ] **GOV-007** — Ne jamais repartir de zéro ou remplacer le moteur de pointage partagé.
- [ ] **GOV-008** — Conserver PUNCH Construction intact et ses prix, autorisations et écrans séparés.
- [ ] **GOV-009** — Éclater les prompts volumineux en exigences avec identifiants stables et critères vérifiables.
- [ ] **GOV-010** — Associer chaque exigence à ses fichiers, RPC, Edge Functions, PR et tests.
- [ ] **GOV-011** — Maintenir GitHub comme source de vérité du suivi; Drive reste boîte d’entrée.
- [ ] **GOV-012** — Mettre à jour le tracker, la roadmap et `PUNCH_WORK_CONTINUATION.md` après chaque lot; l'ancien giga-prompt redirige vers ce maître et ne doit pas redevenir un second registre.
- [ ] **GOV-013** — Garder les prompts bruts et secrets hors du dépôt GitHub public.
- [ ] **GOV-014** — Différencier développé, testé, déployé et intervention externe pour chaque point.
- [ ] **GOV-015** — Ne jamais affirmer qu’un prompt est terminé si une de ses sous-exigences manque.
- [ ] **GOV-016** — Lors de chaque reprise, confronter PR/CI/Pages, schéma Supabase et rapports techniques les plus récents à l'état des exigences; ignorer comme instructions actives les bilans historiques périmés; préserver les migrations déjà appliquées et les contrats.

## P0 — Sécurité, RLS et isolation (SEC, 15 points)
**Objectif :** Priorité à la confidentialité et à la protection des données officielles.
**Sources :** Prompt maître / audits Supabase. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SEC-001** — Tester isolation stricte des compagnies et des rôles sur toutes les tables nouvelles et anciennes.
- [ ] **SEC-002** — Activer RLS sur toutes les tables exposées, vérifier les grants et les politiques effectives.
- [ ] **SEC-003** — Réviser toutes les fonctions SECURITY DEFINER accessibles aux utilisateurs authentifiés.
- [ ] **SEC-004** — Contrôler auth.uid, compagnie, rôle, permissions, MFA et session active dans les RPC sensibles.
- [ ] **SEC-005** — Révoquer les droits EXECUTE non nécessaires; interdire le contournement de la Data API.
- [ ] **SEC-006** — Empêcher l’usurpation Boss ou Super Admin par les métadonnées client.
- [ ] **SEC-007** — Réduire la durée de vie des jetons sensibles et contrôler leur révocation.
- [ ] **SEC-008** — Vérifier protections anti-CSRF/rejeu, idempotence et courses de concurrence.
- [ ] **SEC-009** — Vérifier Storage privé, URLs signées, téléchargements et expiration de liens.
- [ ] **SEC-010** — Protéger séparément paie, GPS, factures, conversations d’équipe et documents RH.
- [ ] **SEC-011** — Auditer les opérations admin sensibles sans exposer les secrets ou le contenu privé.
- [ ] **SEC-012** — Activer/proposer la protection contre les mots de passe compromis.
- [ ] **SEC-013** — Vérifier journaux, limitation des tentatives, verrouillages et messages d’erreur.
- [ ] **SEC-014** — Prévoir la confidentialité québécoise, avis, consentements, rétention, région et transferts transfrontaliers.
- [ ] **SEC-015** — Procéder à une revue de sécurité indépendante avant commercialisation.

## P0 — Super Admin — accès et sécurité (SAUTH, 14 points)
**Objectif :** Une seule console centrale sécurisée pour deux éditions.
**Sources :** Prompt officiel sections 30–41 / audits plateforme. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SAUTH-001** — Conserver un Super Admin commun à Essentiel et Construction, hors des rôles entreprise.
- [ ] **SAUTH-002** — Vérifier l’identité de propriétaire plateforme côté serveur, jamais par courriel seul.
- [ ] **SAUTH-003** — Imposer MFA aal2 et vérification de session Auth vivante pour toute action sensible.
- [ ] **SAUTH-004** — Tester expiration, suppression et révocation de session pendant une action.
- [ ] **SAUTH-005** — Créer une interface distincte, neutre, sur mobile et PC.
- [ ] **SAUTH-006** — Afficher six indicateurs maximum sur le tableau de bord principal.
- [ ] **SAUTH-007** — Afficher entreprises, utilisateurs, MRR, abonnements, impayés et inscriptions 30 jours.
- [ ] **SAUTH-008** — Calculer correctement le MRR mensualisé des contrats annuels, sans le confondre avec l’encaissé.
- [ ] **SAUTH-009** — Afficher évolution MRR sur 12 mois, maximum cinq alertes prioritaires.
- [ ] **SAUTH-010** — Appliquer le filtre Toutes éditions / Essentiel / Construction à toute la console.
- [ ] **SAUTH-011** — Ne pas compter deux fois membres et abonnements dans les agrégats.
- [ ] **SAUTH-012** — Afficher état des services seulement avec sondes réelles et horodatage.
- [ ] **SAUTH-013** — Auditer recherches, modifications et erreurs, avec motif des consultations sensibles.
- [ ] **SAUTH-014** — Bloquer l’accès aux données privées des salariés sans autorisation et justification spécifiques.

## P0 — Super Admin — compagnies et utilisateurs (SACOMP, 16 points)
**Objectif :** Finaliser l’annuaire et les vraies actions administratives avec audit.
**Sources :** Prompt officiel sections 34,40 / PLATFORM_ACTIONS_AUDIT. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SACOMP-001** — Lister les entreprises avec pagination, recherche et filtres par édition/forfait/statut.
- [ ] **SACOMP-002** — Afficher fiche entreprise : Boss, Admin, sièges, établissements/chantiers, bornes et contrats.
- [ ] **SACOMP-003** — Afficher prix contractuel, cadence, prochaines échéances, factures et historique commercial.
- [ ] **SACOMP-004** — Conserver l’annuaire utilisateurs réels/test avec recherche et pagination serveur.
- [ ] **SACOMP-005** — Lier chaque consultation sensible à un motif et à une piste d’audit.
- [ ] **SACOMP-006** — Permettre actions commerciales par compagnie sans réécrire les contrats historiques.
- [ ] **SACOMP-007** — Terminer changement de forfait avec simulation et confirmation avant exécution.
- [ ] **SACOMP-008** — Terminer remises particulières et sursis par compagnie avec audit et contrôle serveur.
- [ ] **SACOMP-009** — Terminer suspension et réactivation commerciale sans perdre les heures des salariés.
- [ ] **SACOMP-010** — Prévoir révocation de borne et renvoi d’invitation dans la fiche lorsque autorisés.
- [ ] **SACOMP-011** — Rendre les modifications utilisateurs réels sûres, versionnées, confirmées et limitées.
- [ ] **SACOMP-012** — Prévoir création de compagnies test, employés, Boss, Admin, superviseurs et jobs fictifs.
- [ ] **SACOMP-013** — Permettre suppression/restauration contrôlée des comptes test sans toucher au réel.
- [ ] **SACOMP-014** — Autoriser réinitialisation des mots de passe réels, jamais affichage du mot de passe Auth existant.
- [ ] **SACOMP-015** — Limiter la consultation des identifiants test au coffre sécurisé avec MFA et audit.
- [ ] **SACOMP-016** — Conserver historique support, recherche de tickets, réponses, clôture et réouverture.

## P0 — Super Admin — catalogue, tarifs, promos (SACATALOG, 15 points)
**Objectif :** Garder une configuration des offres centralisée, historisée et testable.
**Sources :** Prompt maître sections 35–38 / prompt paiement. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SACATALOG-001** — Gérer séparément Essentiel et Construction sans écraser les prix existants.
- [ ] **SACATALOG-002** — Préserver trois prix Essentiel 19/39/69 CAD et cinq sièges inclus selon catalogue.
- [ ] **SACATALOG-003** — Préserver supplément humain 3/4/5 CAD/mois selon offre.
- [ ] **SACATALOG-004** — Préserver bornes 1/3/illimitées et remise annuelle de référence 15 %.
- [ ] **SACATALOG-005** — Autoriser modification versionnée prix, sièges, bornes, établissements et visibilité.
- [ ] **SACATALOG-006** — Prévisualiser ancien/nouveau contrat avant application d’un changement.
- [ ] **SACATALOG-007** — Respecter les engagements historiques et ne jamais re-tarifer silencieusement.
- [ ] **SACATALOG-008** — Mettre à jour la matrice de fonctions par forfait côté serveur.
- [ ] **SACATALOG-009** — Séparer droits commerciaux et activation des modules par compagnie.
- [ ] **SACATALOG-010** — Préserver la création de codes promo sous contrôle Super Admin MFA.
- [ ] **SACATALOG-011** — Gérer promos test vs production sans mélange ni envoi arbitraire à Stripe.
- [ ] **SACATALOG-012** — Gérer limite d’utilisation, expiration, durée, forfaits admissibles et désactivation.
- [ ] **SACATALOG-013** — Conserver les codes utilisés et conditions contractuelles pour la traçabilité.
- [ ] **SACATALOG-014** — Tester l’idempotence des publications promos lors de réponses fournisseur incertaines.
- [ ] **SACATALOG-015** — Ajouter futur module GPS, dépenses, Wallet et événements à la matrice commerciale.

## P0 — Stripe, abonnements, taxes et sursis (STRIPE, 18 points)
**Objectif :** Terminer la vraie recette Stripe en mode test avant ventes.
**Sources :** prompt paiement.txt / Master / Billing. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **STRIPE-001** — Vérifier que les six Stripe Price IDs existent et correspondent au bon produit.
- [ ] **STRIPE-002** — Protéger les clés Stripe en secrets Edge uniquement.
- [ ] **STRIPE-003** — Vérifier Checkout sur les trois offres mensuelles et annuelles.
- [ ] **STRIPE-004** — Ne jamais accepter un prix, montant, Customer ID ou forfait transmis librement par le client.
- [ ] **STRIPE-005** — Réutiliser le Customer existant et empêcher deux abonnements actifs involontaires.
- [ ] **STRIPE-006** — Utiliser le webhook signé comme source de vérité, pas le retour Checkout.
- [ ] **STRIPE-007** — Tester événements en double, ordre inattendu, retards et reprises idempotentes.
- [ ] **STRIPE-008** — Tester prorata de sièges ajoutés et retirés selon la politique contractuelle.
- [ ] **STRIPE-009** — Tester passage Plus/Pro/Base et prévisualisation détaillée de facture.
- [ ] **STRIPE-010** — Tester rabais annuel, codes promo, périodes et restrictions de cumul.
- [ ] **STRIPE-011** — Tester TVA/TPS/TVQ, taxes appliquées et affichage correct au Québec.
- [ ] **STRIPE-012** — Tester portail client, mode de paiement et factures accessibles.
- [ ] **STRIPE-013** — Tester échec de paiement, **sursis paramétrable** selon les permissions Super Admin/contrats par compagnie (30 jours comme valeur initiale actuelle, modifiable et non codée en dur), prolongation exceptionnelle auditée et notifications. Après expiration, conserver pointage et lecture des heures selon la politique existante.
- [ ] **STRIPE-014** — Préserver pointage et accès aux heures durant la restriction commerciale.
- [ ] **STRIPE-015** — Tester annulation en fin de période et réabonnement.
- [ ] **STRIPE-016** — Rapprocher les paiements, remboursements et frais Stripe avec les rapports.
- [ ] **STRIPE-017** — Ne jamais lancer de vrai débit pendant la recette sans autorisation.
- [ ] **STRIPE-018** — Valider état complet des webhooks et Checkout sur vraies ressources Stripe Sandbox.

## P0 — Pointage Essentiel personnel (CORE, 18 points)
**Objectif :** Conserver un pointage fiable et une interface sans surcharge.
**Sources :** Design Accueil / Master / roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **CORE-001** — Navigation employé **conditionnelle au forfait** : **Essentiel de base conserve 4 onglets** « Punch · Heures · Horaire · Plus »; **Essentiel Plus et Essentiel Pro affichent 5 onglets** « **Punch · Heures · Horaire · Messages · Plus** », avec Messages en bas bien visible et compteur non-lus discret. Aucun faux bouton pour le forfait de base, ni restriction d'un droit déjà actif sans validation des contrats/entitlements côté serveur. Les autres modules se placent dans les onglets existants; navigation cohérente Web/Expo/mobile.
- [ ] **CORE-002** — Garder les états avant début, en travail, en pause, journée terminée.
- [ ] **CORE-003** — Retirer le gros en-tête employé, garder bonjour prénom, date et petit état sync.
- [ ] **CORE-004** — Utiliser un seul cadran central fixe en travail comme en pause.
- [ ] **CORE-005** — Afficher HH:MM:SS et un anneau faisant un tour toutes les 60 minutes.
- [ ] **CORE-006** — En mode pause, figer travail et afficher le compteur de pause sur le même cadran.
- [ ] **CORE-007** — Utiliser couleurs vert sauge travail et orange pause.
- [ ] **CORE-008** — Conserver exactement positions et dimensions des boutons entre les modes.
- [ ] **CORE-009** — Offrir commencer, finir, pause et reprendre en un seul appui sans modal bloquante.
- [ ] **CORE-010** — Utiliser anti-double clic serveur, idempotence et état confirmé après réponse.
- [ ] **CORE-011** — Placer cloche de pause à droite du cadran, même position tous modes.
- [ ] **CORE-012** — Configurer pause 15/30/45/60 minutes ou personnalisée.
- [ ] **CORE-013** — Configurer rappel 1/2/5/10 minutes avant fin ou aucun, sans arrêter la pause.
- [ ] **CORE-014** — Planifier/annuler rappels selon permissions natives et limitations PWA.
- [ ] **CORE-015** — Conserver totaux jour/semaine et historique exact après fermeture/réouverture.
- [ ] **CORE-016** — Ne pas afficher une énorme carte pour un seul établissement.
- [ ] **CORE-017** — Interdire changement de site non autorisé et ne pas mélanger avec un chantier.
- [ ] **CORE-018** — Faire tenir la page Punch mobile sans scroll vertical en usage normal.

## P0 — Bornes communes et accès Admin/Boss (KIOSK, 32 points)
**Objectif :** Finaliser borne tablette sécurisée, appairage et sessions mixtes.
**Sources :** Master / intégration 10 thèmes borne. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **KIOSK-001** — Maintenir URL publique kiosk.html sans identifiant secret dans le lien.
- [ ] **KIOSK-002** — Créer/renommer/révoquer borne depuis Boss et l’affecter à un site.
- [ ] **KIOSK-003** — Afficher Ouvrir la pointeuse et Copier le lien sur fiche borne.
- [ ] **KIOSK-004** — Utiliser code d’appairage à usage unique et expiration configurée.
- [ ] **KIOSK-005** — Ne pas stocker mot de passe personnel ni PIN en clair.
- [ ] **KIOSK-006** — Afficher clavier NIP et matricule avec heure, date et état sync.
- [ ] **KIOSK-007** — Verrouiller les tentatives excessives de NIP et journaliser sans fuite.
- [ ] **KIOSK-008** — Réinitialiser l’interface à 10 secondes d’inactivité par défaut.
- [ ] **KIOSK-009** — Permettre délais 5/10/15/30/60 secondes sans laisser d’identité persistante.
- [ ] **KIOSK-010** — Conserver même registre et session unique téléphone/tablette pour IN/OUT/pauses.
- [ ] **KIOSK-011** — Tester IN iPad/OUT téléphone, puis l’inverse et pauses croisées.
- [ ] **KIOSK-012** — Gérer appairage expiré, réutilisé, mauvais tenant et appareil révoqué.
- [ ] **KIOSK-013** — Prévoir mode borne seule vs borne avec accès Admin/Boss autorisé.
- [ ] **KIOSK-014** — Séparer session personnelle Admin/Boss du jeton technique de borne.
- [ ] **KIOSK-015** — Déconnecter automatiquement le mode Admin/Boss après 5 minutes d’inactivité.
- [ ] **KIOSK-016** — Conserver PWA installable sur Android et iPad sans promettre de verrouiller l’appareil.
- [ ] **KIOSK-017** — Ajouter à l’accueil de chaque borne PUNCH Essentiel Pro admissible un **gros bouton primaire « Scanner ma carte »** immédiatement visible, avec pictogramme QR/caméra, sans recherche dans un menu; ne pas le montrer si option non autorisée.
- [ ] **KIOSK-018** — Garder à l’accueil une option bien visible « Matricule / NIP » indépendante du scanner, fonctionnelle même sans caméra et sans forcer Wallet.
- [ ] **KIOSK-019** — Respecter les 10 thèmes de borne, orientations tablette et écrans réduits : gros bouton tactile, contraste, libellé lisible, aucun défilement inutile.
- [ ] **KIOSK-020** — Permettre au Boss/Admin habilité d’activer ou désactiver « Scanner ma carte » par compagnie et par borne compatible; vérifier option, forfait Pro, tenant et borne côté serveur.
- [ ] **KIOSK-021** — Réutiliser l’identité d’appairage/révocation existante, le moteur IN/OUT/pauses, la session unique et la logique de déconnexion sans ajouter de second registre.
- [ ] **KIOSK-022** — Définir états de borne explicites : accueil, demande caméra, scan, vérification, confirmation sécurisée, succès/erreur, retour accueil; aucun état bloqué ni donnée d’employé persistante.
- [ ] **KIOSK-023** — Couper systématiquement caméra/flux et effacer l’aperçu lors de l’annulation, timeout, succès, déconnexion, masquage durable de page et changement d’employé.
- [ ] **KIOSK-024** — Interdire au lecteur QR d’ouvrir l’administration ou de confondre les sessions Boss/Admin avec l’identité technique de la borne.
- [ ] **KIOSK-025** — Si QR/WALLET est indisponible, maintenir le matricule/NIP et son mode hors ligne déjà autorisé; ne jamais fabriquer une validation QR hors ligne non sécurisée.
- [ ] **KIOSK-026** — Valider sur iPad Safari/PWA et tablette Android Chrome/PWA, avec bornes actives/révoquées, touches, caméra et parcours utilisateur réels.
- [ ] **KIOSK-027** — Ne pas dépendre uniquement de l’API navigateur `BarcodeDetector` : fournir un **décodeur QR local de secours compatible Safari iPad/iOS et Chrome Android**, détection de capacité et tests PWA réellement effectués; aucune vidéo envoyée à un service externe.
- [ ] **KIOSK-028** — Prévoir, en option facultative, le **lecteur QR optique externe USB/Bluetooth** fonctionnant en mode clavier si le matériel et le système le permettent; scanner les écrans de téléphone, analyser seulement les entrées dans un champ dédié non administratif et appliquer exactement les mêmes vérifications serveur et NIP que la caméra.
- [ ] **KIOSK-029** — Ajouter **Boss/Admin → Bornes → Diagnostic du scanner** : tester la caméra, l’autorisation, le format QR et, si présent, le lecteur externe à partir d’un code de test non lié à un employé; indiquer statut de compatibilité et erreurs sans conserver de vidéo.
- [ ] **KIOSK-030** — Prévoir un **signal visuel et sonore facultatif** pour succès et refus, seulement après confirmation serveur de l’opération; rendre le volume/désactivation configurable, fournir équivalents accessibles et ne pas annoncer oralement un nom ou un montant d’heures.
- [ ] **KIOSK-031** — Documenter l’installation physique : support stable, orientation avant/arrière de caméra, angle de présentation des écrans Apple/Android, lumière/reflets, distance, alimentation, affichage lisible et confidentialité à plusieurs employés.
- [ ] **KIOSK-032** — Si le scanner est incompatible, caméra impossible ou lecteur externe absent, présenter un état explicite « Scanner indisponible » et préserver **Matricule/NIP** utilisable; ne pas promettre le scanner fonctionnel sur la seule détection d’une caméra.

## P0 — Borne hors ligne et récupération (OFFLINE, 12 points)
**Objectif :** Valider terrain, sécurité de journal, reprise et réconciliation.
**Sources :** KIOSK_OFFLINE / roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **OFFLINE-001** — Utiliser identité hors ligne liée à une borne enregistrée et autorisée.
- [ ] **OFFLINE-002** — Stocker les événements provisoires dans un journal durable chiffré.
- [ ] **OFFLINE-003** — Ne pas stocker PIN ni mot de passe en clair hors ligne.
- [ ] **OFFLINE-004** — Lier événements à signatures/HMAC et identifiants idempotents.
- [ ] **OFFLINE-005** — Limiter la durée d’utilisation de la preuve hors ligne.
- [ ] **OFFLINE-006** — Marquer les événements hors ligne comme provisoires avant approbation serveur.
- [ ] **OFFLINE-007** — Réconcilier de manière robuste après retour réseau et gérer doublons.
- [ ] **OFFLINE-008** — Refuser nouveaux événements d’une borne révoquée dès que vérification possible.
- [ ] **OFFLINE-009** — Traiter horloge de tablette erronée, fuseau et changements d’heure.
- [ ] **OFFLINE-010** — Tester perte d’alimentation, redémarrage et plusieurs salariés successifs.
- [ ] **OFFLINE-011** — Tester concurrence avec téléphone et plusieurs bornes pendant interruption.
- [ ] **OFFLINE-012** — Exiger tests physiques réseau/appareils avant déclaration de livraison.

## P1 — Horaires, équipes, rotations et disponibilités (SHIFT, 25 points)
**Objectif :** Achever le moteur de planification sur une source de vérité unique.
**Sources :** Master / Planning / Remplacements. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SHIFT-001** — Gérer établissements et départements avec droits par rôle.
- [ ] **SHIFT-002** — Gérer horaires ponctuels, récurrents, rotatifs jour/soir/nuit.
- [ ] **SHIFT-003** — Gérer quarts passant minuit et fuseaux horaires spécifiques au site.
- [ ] **SHIFT-004** — Gérer heures ambiguës/inexistantes aux changements saisonniers.
- [ ] **SHIFT-005** — Gérer disponibilités et indisponibilités des salariés.
- [ ] **SHIFT-006** — Gérer absences, congés et impacts sur horaires.
- [ ] **SHIFT-007** — Confirmer la lecture de chaque version d’horaire publiée.
- [ ] **SHIFT-008** — Conserver annulation/édition versionnées et motifs.
- [ ] **SHIFT-009** — Prévenir chevauchements et conflits d’affectations.
- [ ] **SHIFT-010** — Gérer modèles d’horaires réutilisables, leur archivage et versions.
- [ ] **SHIFT-011** — Compléter affectations par poste et qualification.
- [ ] **SHIFT-012** — Gérer plusieurs établissements Pro et limites contractuelles.
- [ ] **SHIFT-013** — Isoler les superviseurs à leurs départements et délégations validées.
- [ ] **SHIFT-014** — Permettre planification sans visibilité abusive des rémunérations.
- [ ] **SHIFT-015** — Mettre à jour calendrier immédiatement après affectation confirmée.
- [ ] **SHIFT-016** — Ajouter des **disponibilités hebdomadaires récurrentes** : jours/plages multiples, matin/soir ou heures exactes, début d'effet et fin optionnelle; saisie unique sans ressaisie chaque semaine.
- [ ] **SHIFT-017** — Donner priorité aux absences/congés approuvés et aux exceptions datées ou hebdomadaires sur la semaine type; afficher « inconnu » si aucune règle applicable et ne pas fabriquer une disponibilité.
- [ ] **SHIFT-018** — Permettre à l'employé ou à l'Admin/Boss habilité de saisir les disponibilités d'un salarié sans téléphone/courriel/compte; garder auteur, version, date, fuseau et avertir des conflits sans effacer un quart publié.
- [ ] **SHIFT-019** — Conserver souhait d'heures/semaine, limites applicables, ancienneté, qualifications, préférences matin/soir/nuit/week-end et volontariat aux quarts supplémentaires; ne pas inventer de règles légales ou conventionnelles.
- [ ] **SHIFT-020** — Définir **besoins de couverture récurrents** par site, département, poste/qualification, plages, nombre requis et exceptions de semaine; réutiliser modèles et couverture existants, sans deuxième moteur.
- [ ] **SHIFT-021** — Afficher ensemble besoins, heures à donner, employés disponibles/admissibles, quarts non couverts et conflits dans la console Admin; prévoir rappels de disponibilité et date limite facultatifs sans modifier un horaire publié.
- [ ] **SHIFT-022** — Construire le planificateur Essentiel Pro en **trois étapes visibles** : « Besoins » → « Employés » → « Générer, prévisualiser et publier »; sur mobile, tablette et PC, depuis modèles existants.
- [ ] **SHIFT-023** — Générer un brouillon par moteur déterministe/explicable et vérifiable par serveur, sans service IA payant; contraintes dures : congés, indisponibilité, qualifications, sites, chevauchement, repos, max heures, nuit et DST.
- [ ] **SHIFT-024** — Optimiser les contraintes souples de manière paramétrable : ancienneté, équité, heures souhaitées, rotations soirs/week-ends, stabilité et coûts connus; montrer les raisons des affectations et les quarts impossibles à couvrir.
- [ ] **SHIFT-025** — Prévoir mode **Simple par défaut** et avancé facultatif, brouillon versionné, ajustements tactiles, verrouillage de quarts, régénération partielle, validation humaine avant publication, notifications et refus de conflits de versions.

## P1 — Quarts disponibles, échanges et remplacements (COVER, 25 points)
**Objectif :** Définir trois parcours séparés avec règles d’approbation.
**Sources :** Remplacements dans Drive / planning. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **COVER-001** — Permettre au responsable de publier un quart libre Plus/Pro.
- [ ] **COVER-002** — Définir date, début/fin, site, département, poste et places restantes.
- [ ] **COVER-003** — Définir qualifications, expiration et note de l’offre.
- [ ] **COVER-004** — Afficher offres admissibles seulement à l’employé concerné.
- [ ] **COVER-005** — Permettre Postuler et Retirer candidature sans doublon.
- [ ] **COVER-006** — Afficher en attente/accepté/refusé/complet/annulé.
- [ ] **COVER-007** — Valider disponibilité, congés, conflit, site et qualification avant attribution.
- [ ] **COVER-008** — Effectuer réservation et affectation atomiques côté serveur, y compris deux acceptations simultanées sur **un seul quart**, sans attribuer la dernière place deux fois; revalider admissibilité, version, identité, société et droits au moment exact.
- [ ] **COVER-009** — Ajouter le quart à l’horaire et notifier la décision.
- [ ] **COVER-010** — Permettre à un salarié d'offrir volontairement son propre quart à remplacer (échange/libération) **sans confondre ce parcours avec le signalement d'absence**. Une offre volontaire non qualifiée de signalement ne déclenche pas automatiquement les vagues d'absence.
- [ ] **COVER-011** — Configurer par compagnie remplacement automatique OU approbation obligatoire : premier volontaire admissible réservé puis approuvé, ou affectation immédiate après acceptation admissible; aucun contournement de décision ou d'autorisations.
- [ ] **COVER-012** — Ne jamais effectuer un remplacement automatique sans contrôles serveur (RLS, tenant, permissions, forfait, qualification, chevauchement, repos, disponibilités); pour une absence, l'événement volontaire confirmé est en plus une condition obligatoire.
- [ ] **COVER-013** — Permettre échange de quart avec consentement des deux salariés.
- [ ] **COVER-014** — Distinguer quart vacant, remplacement et échange dans l’interface.
- [ ] **COVER-015** — Distinguer quart supplémentaire et calcul réel d’heures majorées.
- [ ] **COVER-016** — Ajouter coûts/couverture des candidats au Pro, jamais classement opaque.
- [ ] **COVER-017** — Journaliser décisions, erreurs de concurrence et changements de version.
- [ ] **COVER-018** — Créer « **Signaler mon absence** » sur un quart assigné : confirmation explicite **par l'employé titulaire** pour ce quart avant toute recherche automatique. Retard, no-show, absence de punch, GPS, anomalie et détection prédictive **ne déclenchent jamais d'offre**.
- [ ] **COVER-019** — Écran d'absence avec **neuf motifs sans présélection** : Maladie, Enfant malade, Rendez-vous médical, Urgence familiale, Obligation familiale ou garde, Problème de transport, Raison personnelle, Autre, Je préfère ne pas préciser; « Autre » ouvre une précision facultative, et aucun diagnostic ou texte personnel n'est exigé.
- [ ] **COVER-020** — Stocker la catégorie sous code stable et la note facultative limitée/échappée, liées au seul signalement; ne jamais dévoiler motif/note aux remplaçants, SMS/push d'offres ou exports généraux. Lecture réservée RH habilités, RLS, audit et rétention adaptée.
- [ ] **COVER-021** — Enregistrer signalement, quart/version, identité, horaire, audit et ouverture conditionnelle d'une unique recherche **idempotente au serveur**; double clic/réseau instable ne crée ni nouvelle absence ni seconde vague; le signalement n'est pas un punch OUT.
- [ ] **COVER-022** — Utiliser la **banque existante** de salariés volontaires pour les remplacements; filtrer et revalider disponibilités/exceptions, site, poste, qualifications, absences/congés, repos, conflits et limites d'heures; classer selon règles entreprise explicables.
- [ ] **COVER-023** — Proposer les quarts **par vagues** avec délais, relances, expiration, anti-spam et escalade configurable; notifications internes/push en priorité, SMS/Twilio optionnel seulement à la fin et après configuration.
- [ ] **COVER-024** — Après la première acceptation admissible, réserver OU attribuer exactement une fois selon COVER-011; fermer les autres offres et afficher « Quart déjà attribué » aux arrivants tardifs; si approbation refusée, relancer selon règles sans doubler les quarts.
- [ ] **COVER-025** — Si banque vide/aucune acceptation, laisser le quart à combler et alerter le responsable; fermeture automatique des offres lors de couverture manuelle/annulation; conserver les punchs, heures et paie déjà enregistrés même si quart commencé.

## P1 — RH, approbations, pauses et rapports paie (HR, 18 points)
**Objectif :** Sécuriser les écritures officielles et dossiers RH.
**Sources :** Tests / HR Payroll / prompts. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **HR-001** — Permettre demande de correction de punch et de pause avec justificatif.
- [ ] **HR-002** — Permettre demande de journée entièrement oubliée sans falsifier le registre.
- [ ] **HR-003** — Exiger approbation par un autre responsable autorisé.
- [ ] **HR-004** — Conserver original, nouveau calcul, auteur, décision et horodatage.
- [ ] **HR-005** — Refuser corrections d’une semaine verrouillée sans parcours spécial autorisé.
- [ ] **HR-006** — Appliquer pauses payées/non payées sans réduire les heures incorrectement.
- [ ] **HR-007** — Configurer politiques de pauses par département et version applicable.
- [ ] **HR-008** — Gérer fériés, vacances, absences et banques d’heures auditables.
- [ ] **HR-009** — Conserver certificats/formations versionnés et échéances.
- [ ] **HR-010** — Gérer documents RH privés et confirmations de lecture par version.
- [ ] **HR-011** — Isoler permission Documents, Certifications et Rémunération des autres rôles.
- [ ] **HR-012** — Gérer taux datés, primes soir/nuit, banques, règles d’heures sup.
- [ ] **HR-013** — Préparer exports de paie fondés sur périodes approuvées et fermées.
- [ ] **HR-014** — Afficher toute estimation salariale comme estimation, pas bulletin officiel.
- [ ] **HR-015** — Ajouter talons de paie PDF privés Pro, import/association/notification.
- [ ] **HR-016** — Ne jamais exposer le talon d’un employé à un autre.
- [ ] **HR-017** — Tester snapshots, périodes, règles rétroactives et retenues non implémentées.
- [ ] **HR-018** — Séparer le **motif déclaratif d'absence** des congés approuvés, justifications administratives, absences rémunérées, banques d'heures et décisions de paie : une catégorie choisie n'accorde ni ne refuse automatiquement aucun de ces droits.

## P1 — Budgets et coûts en temps réel (BUDGET, 11 points)
**Objectif :** Assurer un suivi de main-d’œuvre utilisable pour les Boss.
**Sources :** Roadmap Pro / migrations Supabase récentes. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **BUDGET-001** — Afficher présents/absents, heures actuelles, semaines et heures sup.
- [ ] **BUDGET-002** — Calculer coûts prévisionnels uniquement avec taux disponibles.
- [ ] **BUDGET-003** — Ventiler main-d’œuvre par établissement, département, poste si défini.
- [ ] **BUDGET-004** — Prévoir budgets configurables par période et unité de gestion.
- [ ] **BUDGET-005** — Afficher prévu/réalisé et écarts sans inventer le salaire manquant.
- [ ] **BUDGET-006** — Comparer couverts/non couverts et postes critiques.
- [ ] **BUDGET-007** — Prévoir avis seuil budget dépassé, sans bloquer le pointage.
- [ ] **BUDGET-008** — Distinguer rapport de paie, budget et paiement réel.
- [ ] **BUDGET-009** — Contrôler droits Rémunération pour tous les montants salariaux.
- [ ] **BUDGET-010** — Tester migrations récentes budgets déjà présentes sur Supabase avant création.
- [ ] **BUDGET-011** — Ajouter rapports CSV exportables, paginés et horodatés.

## P1 — Identités, invitations, authentification (INVITE, 12 points)
**Objectif :** Inscrire et activer les travailleurs sans doublon.
**Sources :** Master / Invitation email / Auth docs. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **INVITE-001** — Laisser Boss créer compagnie, sites, équipes puis inviter.
- [ ] **INVITE-002** — Permettre Google, Apple et courriel lorsque configurés correctement.
- [ ] **INVITE-003** — Permettre compte salarié sans courriel/téléphone via matricule et PIN.
- [ ] **INVITE-004** — Associer Auth ultérieur au même salarié et au même historique d’heures.
- [ ] **INVITE-005** — Séparer les canaux pointage mobile, borne et consultation.
- [ ] **INVITE-006** — Conserver invitation unique, expirante, liée au bon rôle et à la compagnie.
- [ ] **INVITE-007** — Ne jamais attribuer rôle Boss par erreur à un invité.
- [ ] **INVITE-008** — Envoyer courriel automatique via fournisseur configuré et consenti.
- [ ] **INVITE-009** — Gérer statuts préparée/envoyée/livrée/échec/ouverte/activée/expirée.
- [ ] **INVITE-010** — Gérer relance, remplacement de jeton, réessai idempotent.
- [ ] **INVITE-011** — Tester OAuth Google/Apple, redirections et expiration de session physiquement.
- [ ] **INVITE-012** — Garder SMS/Twilio en toute dernière phase; pas d’envoi sans autorisation.

## P2 — Événements, communications, notifications (COMM, 16 points)
**Objectif :** Centraliser événements professionnels et communications par équipe.
**Sources :** Nouveaux ajouts / notifications existantes. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **COMM-001** — Réutiliser annonces existantes avec confirmation de lecture.
- [ ] **COMM-002** — Permettre aux **Boss et Admin** autorisés de créer des événements d'entreprise **facultatifs ou obligatoires** : party de Noël, souper/activité d'équipe, réunion, visioconférence, formation; réutiliser le module événements/communications plutôt que créer un second calendrier.
- [ ] **COMM-003** — Inviter toute la compagnie, certains établissements/départements ou des employés précis, et utiliser les @mentions déjà autorisées; vérifier côté serveur le droit Boss/Admin, l'entreprise et le périmètre d'invitation, sans visibilité interentreprises.
- [ ] **COMM-004** — Distinguer invitation envoyée/lue, réponse **Je participe / Peut-être / Je ne participe pas**, présence prévue et présence constatée; laisser la réponse facultative ou obligatoire selon la configuration de l'événement.
- [ ] **COMM-005** — Permettre confirmer, peut-être, refuser ou demander correction; **ne pas obliger un motif de refus pour un événement social facultatif**. Pour une activité professionnelle obligatoire, toute justification suit les règles RH applicables, sans exposer de renseignements privés aux autres invités.
- [ ] **COMM-006** — Définir titre, catégorie, description courte, début/fin, fuseau de l'établissement, lieu/adresse OU visio OU hybride, échéance de réponse, rappels et documents autorisés; valider date/heure et éviter les chevauchements informatifs sans créer un quart.
- [ ] **COMM-007** — Permettre événement unique ou récurrent, modification/annulation versionnées (occurrence ou série), suivi des invitations et notifications idempotentes aux personnes concernées; réutiliser les préférences et canaux existants, sans doublon d'événement.
- [ ] **COMM-008** — Préserver les conversations privées d'équipe : Boss/Admin/Super Admin ne reçoivent pas automatiquement un droit de lecture du contenu privé. Réutiliser le moteur de messagerie actuel selon les droits et membres, sans affaiblir les protections Construction.
- [ ] **COMM-009** — Gérer préférences notifications par catégorie et canal.
- [ ] **COMM-010** — Tester push via FCM/APNs et réception lorsque app fermée.
- [ ] **COMM-011** — Afficher état fournisseur réellement vérifié et erreurs d’envoi.
- [ ] **COMM-012** — Respecter consentement et refus de notification.
- [ ] **COMM-013** — **Création guidée ultra-simple** dans Boss/Admin → Événements : (1) type et détails, (2) invités, (3) aperçu et publication; modèle prêt à l'emploi pour party de Noël, réunion d'équipe, formation ou vidéoconférence; les événements restent dans Horaire/Plus, **sans nouvel onglet pour les événements**. Le cinquième onglet Messages est réservé aux forfaits Plus/Pro (CORE-001).
- [ ] **COMM-014** — Pour visioconférences et réunions hybrides, saisir et valider un **lien HTTPS externe** Teams, Zoom ou Google Meet, avec bouton « Rejoindre » affiché seulement aux invités autorisés à l'approche de l'événement; **ne pas prétendre générer ou héberger un lien automatiquement** sans intégration OAuth/fournisseur configurée.
- [ ] **COMM-015** — Distinguer clairement événement **social facultatif** et réunion/formation à présence demandée ou obligatoire; participation/RSVP ne modifie **jamais automatiquement punch, horaire, paie, congé ou heures rémunérées**. Avertir l'Admin des conflits potentiels avec un quart sans le modifier; appliquer séparément les règles RH/légales pour les activités obligatoires.
- [ ] **COMM-016** — Donner au salarié l'accès aux événements qui le concernent depuis **Horaire → Événements** (ou Plus selon design existant), avec détails, réponse rapide, calendrier ICS privé réutilisé, rappels et état de participation; tableau Boss/Admin des réponses avec capacité/places facultative et liste d'attente optionnelle, sans exposition des invités non autorisés.

## P2 — Messagerie intégrée Essentiel Plus/Pro — expérience proche de Messenger (CHAT, 12 points)

**But :** offrir une messagerie professionnelle aussi simple que Messenger dans PUNCH Essentiel Plus et Pro : conversations individuelles, groupes, bulles, avatars, photos, fichiers, vocaux (si possibles), réactions, non-lus et confidentialité configurable. Le chat ne doit pas imposer de présence permanente en dehors du travail.

**Navigation validée par le propriétaire :** **5 onglets au bas de l'application pour Essentiel Plus et Pro** : **Punch · Heures · Horaire · Messages · Plus**; Messages est un **véritable onglet bas**, accessible d'un geste avec badge non-lus. **Essentiel de base conserve 4 onglets** Punch · Heures · Horaire · Plus, et ses fonctions de communication contractuelles préexistantes ne doivent pas être supprimées par mégarde. Ne pas ajouter un sixième onglet. Responsive pour Android/iPhone et PWA; ne pas couper les cinq onglets même sur petit téléphone (icônes + libellés compacts et safe-area).

**Anti-doublons obligatoires :** commencer par inspecter `src/messages/MessagesScreen.tsx`, `src/workforce/ManagementWorkspace.tsx`, `supabase/migrations/20261024035200_punch_360_team_chat_v1.sql`, `conversations`, `conversation_members`, `conversation_messages`, `private.is_chat_member`, les autorisations `essential_entitlements` et le catalogue serveur. La liste de fonctions Plus comprend déjà `messages` et Pro hérite de Plus; **ne pas créer une deuxième base de chat, ni un deuxième système de notification**. Préserver la séparation Construction/Essentiel et les salons privés de Construction, sans élargir l'accès Boss/Admin/Super Admin à leurs contenus. Réutiliser membres, départements, invitations, notifications `COMM-009–012`, événements et tâches. Vérifier l'état réel de code, migrations, tests et déploiement avant d'annoncer toute fonction livrée.

- [ ] **CHAT-001** — **Accès et droits par forfait :** le chat complet est accessible aux Boss/Admin/employés et responsables autorisés des compagnies Essentiel Plus/Pro via entitlements côté serveur, isolation `company_id` et contrôle de rôle; aucun employé non autorisé n'entre par URL/API directe. Une personne sans compte personnel continue de pointer sur une borne, mais doit activer son compte personnel facultatif rattaché au **même dossier salarié** pour utiliser le chat. **Jamais de chat privé sur une tablette de pointage commune**.
- [ ] **CHAT-002** — **Navigation et liste Messenger :** onglet **Messages dans la barre du bas**, ordre exactement « Punch · Heures · Horaire · Messages · Plus » sur Plus/Pro; bouton de création, recherche, avatars/initiales, derniers échanges, heure, nom du groupe et badge de messages non lus; onglet stable et lisible dans les 20 thèmes personnels, sur petit Android/iPhone, avec clavier et lecteurs d'écran. Essentiel base demeure à 4 onglets; ne pas placer Messages seulement dans « Plus » pour Plus/Pro.
- [ ] **CHAT-003** — **Conversations privées 1 à 1 :** démarrer une discussion avec un collègue actif et autorisé de la même entreprise, depuis une recherche simple, sans fil doublon pour la même paire d'usagers; bulles envoyées/reçues, heures, historique paginé, avatars et prévisualisation. Interdire toute lecture ou écriture par un non-participant même avec ID deviné.
- [ ] **CHAT-004** — **Groupes et canaux :** Boss/Admin habilités peuvent créer un groupe ciblé (équipe, département, site, projet interne) et en gérer les participants, nom et image; chefs délégués uniquement dans leur portée. Prévoir groupes privés, groupes de discussion normaux et annonces à sens unique autorisées, sans perdre la confidentialité des groupes privés existants. Pro peut relier des établissements de la **même compagnie**, jamais des tenants distincts.
- [ ] **CHAT-005** — **Envoi fluide et fiable :** textes, réponses citées, quelques réactions émojis, date/heure, statuts **Envoi / Envoyé / Échec**, réessai et anti-doublon idempotent; pagination, synchronisation après déconnexion et temps réel Supabase si réellement validé. Aucune mention « livré » ou « vu » inventée; limitation de taille, fréquence/abus et cache local prudent.
- [ ] **CHAT-006** — **« Vu » configurable dans Réglages → Messagerie → Confidentialité :** chaque utilisateur active/désactive les **confirmations de lecture**; choix privé par défaut ou explicite lors de l'onboarding selon UX. **Réciprocité** : si je désactive mes « Vu », je ne vois plus ceux des autres. Distinction exacte entre Envoyé (serveur), Lu/Vu (conversation réellement ouverte par destinataire habilité) et aucun statut de livraison appareil déduit abusivement. Dans les groupes, ne pas révéler une liste détaillée de lecteurs si leurs préférences ou droits ne le permettent pas. L'accusé obligatoire de lecture d'un plan/document RH reste **indépendant** des « Vu » du chat.
- [ ] **CHAT-007** — **Présence et saisie facultatives :** réglages séparés **« Afficher que je suis en ligne »** et **« Afficher quand j'écris »**; présence inactive/masquée par défaut recommandé, temps réel éphémère, expiration et déconnexion correcte. Aucun suivi GPS, disponibilité de travail, surveillance patronale de l'activité ou pression hors quarts à partir du statut « en ligne ».
- [ ] **CHAT-008** — **Pièces jointes et vocaux :** autoriser photos, images et PDF, aperçus et téléchargements via **Storage privé / URL éphémère**, limites taille/type et vérifications serveur; messages vocaux avec lecture simple en option selon permissions natives et coûts, sans bloquer la V1 texte. Prévenir pièces jointes malveillantes et fuites entre sociétés; pas d'images privées dans notifications si préférences interdisent.
- [ ] **CHAT-009** — **Notifications personnalisables :** alertes in-app/push pour messages, @mentions et groupes; **aperçu sur écran verrouillé activable/désactivable**, discussions mises en sourdine, horaires silencieux / mode tranquille hors travail, préférences individuelles et états d'envoi réels. Réutiliser les notifications existantes sans doublon ni spam; **SMS/Twilio à la fin** et seulement si opt-in/configuré.
- [ ] **CHAT-010** — **Contrôle des messages et sécurité :** permettre modifier ou retirer ses propres messages selon politique de rétention, archiver/masquer la conversation, bloquer/signalement d'abus selon règles de l'entreprise; suppression logique/version et audit technique minimal. RLS/tenant/role/participant et révocation immédiate au départ/changement de service/fin d'accès; **aucun Boss/Admin/Super Admin ne peut lire automatiquement les conversations privées**, et aucun motif d'absence, document RH ou salaire ne fuit dans les messages/suggestions.
- [ ] **CHAT-011** — **Intégration utile aux fonctions existantes :** bouton « Écrire au responsable » sur les tâches, quarts, événements et demandes autorisées; ouverture ou création de discussion seulement entre membres autorisés, sans partager automatiquement le détail RH ni inscrire sans accord dans un groupe privé. Séparer annonces entreprise, messagerie privée et commentaires de tâches; ne pas créer de doubles notifications.
- [ ] **CHAT-012** — **QA / disponibilité réelle :** tester Web/Expo/PWA sur 5 onglets et 4 onglets selon forfait, petits écrans, thèmes et safe-areas; confidentialité « Vu » des deux côtés, présence/écriture, groupes/droits, changement Plus→base/Pro, concurrence, duplications, déconnexion/réessai, pièces jointes, push réellement reçus, RLS et groupe privé Construction. Détailler **développé / testé / déployé / intervention externe**; ne pas déclarer Messenger fonctionnel à partir du seul écran, et ne pas utiliser les conversations privées d'une compagnie réelle pour la recette.

**Critères d'acceptation :** dans Essentiel Plus/Pro, un salarié touche l'onglet **Messages au bas**, retrouve Marie, lui écrit et reçoit sa réponse. Il peut désactiver « Vu », masquer son état en ligne, désactiver « Écrit… », limiter l'aperçu des notifications et silencer ses groupes. Le Boss peut discuter dans les groupes dont il est membre mais **pas espionner les groupes privés**. Essentiel base reste à quatre onglets; borne de pointage reste sans chat. Aucun deuxième moteur de messagerie ni contournement des forfaits.

## P2 — Tâches par poste, tâches de quart et formations internes (TASK, 10 points)
**Objectif :** permettre à une entreprise d'attribuer simplement le travail à réaliser durant les quarts et de vérifier les formations internes, sans complexifier le pointage.
**Décision produit :** Essentiel Plus = modèles de tâches par poste, tâches ponctuelles/récurrentes, suivi simple; Essentiel Pro = formations enrichies, questionnaires facultatifs, tableaux de bord et analyses avancées. Vérifier la matrice de forfait et les contrats existants avant application; ne pas activer silencieusement une fonction payante.
**Anti-doublons obligatoires :** réutiliser les identités et affectations `worker_id`, entreprises/sites/départements, quarts `scheduled_shifts`, rôles et délégations, documents RH/formation `HR-009/010`, événements `COMM-002/013–016`, notifications `COMM-009–012`, historique/contrôles `SEC` et remplacements `COVER-018–025`. Auditer le code et les migrations existants avant tout nouveau modèle. **Une tâche n'est ni un punch ni une demande de congé ni une certification officielle.**

- [ ] **TASK-001** — **Tâches permanentes par poste** : Boss/Admin habilité crée une bibliothèque de listes/modèles par rôle/poste (ex. caissier : ouverture des caisses, comptoir, fermeture), éventuellement par établissement/département. Lorsqu'un quart admissible est attribué, PUNCH propose ses tâches types sans dupliquer les employés, postes, quarts ou modèles.
- [ ] **TASK-002** — **Tâches ponctuelles** : Boss/Admin, ou chef délégué dans sa portée, attribue à un salarié, une équipe ou un quart précis une action à faire (ex. « Kim, nettoyer les présentoirs mardi »), avec instructions, responsable, date/heure d'échéance, priorité facultative et statut initial; ne jamais exposer des tâches à une autre compagnie.
- [ ] **TASK-003** — **Tâches récurrentes** : créer une fois une tâche quotidienne, hebdomadaire ou par type de quart (ouverture/fermeture), avec période de validité, exceptions, versions et génération idempotente; ne pas recréer une tâche à chaque rafraîchissement ni associer une tâche à un quart annulé.
- [ ] **TASK-004** — **Formations internes liées aux tâches** : assigner une consigne, un PDF privé ou une vidéo externe autorisée à un poste, salarié, équipe ou quart; réutiliser les documents RH et les événements/convocations existants. Suivre « assignée / consultée / terminée » et une attestation de lecture lorsque pertinente. En Pro, questionnaire facultatif avec seuil et tentatives configurables, distinct d'une certification réglementaire; ne pas inventer un LMS, une vidéo hébergée ou un certificat professionnel déjà acquis.
- [ ] **TASK-005** — **Suivi employé ultra simple** : quel que soit le nombre d'onglets du forfait, montrer **Horaire → Mon quart → Mes tâches** avec liste courte et progression « X/Y ». Un geste pour « Terminée », options « À faire / En cours / Terminée / Impossible », note/commentaire et photo facultatifs selon droits. Les formations hors quart restent sous **Plus → Mes formations**. Ne créer aucun onglet Tâches additionnel; le seul cinquième onglet Plus/Pro est Messages.
- [ ] **TASK-006** — **Tâches lors du remplacement pour absence** : seulement après une réaffectation de quart réellement confirmée par le serveur selon `COVER-018–025`, proposer au remplaçant les tâches **du quart** pertinentes à son poste/qualification; ne pas transférer automatiquement les tâches privées ou personnelles. Préserver auteur, preuves, historique, accomplissements déjà réalisés et échéances; annulation/modification de quart ne doit ni effacer ni doubler les tâches. Une alerte de retard ou un punch manquant ne déclenche aucun remplacement.
- [ ] **TASK-007** — **Tableau de bord Boss/Admin** : vue Aujourd'hui / Semaine / En retard, avec tâches non commencées, en cours, complétées ou bloquées, par employé/équipe/site et formations à terminer; filtres simples, responsable visible, actions de réassignation/rappel. Une vue courte par défaut, analyses avancées réservées Pro si configurées; éviter classement disciplinaire automatisé fondé sur le seul taux de tâches cochées.
- [ ] **TASK-008** — **Notifications et continuité** : signaler une nouvelle tâche, une échéance importante, un changement de responsable ou une formation assignée via la **file/préférences existantes**, avec rappels configurables et déduplication. En réseau absent, ne pas prétendre qu'une validation est enregistrée au serveur avant synchronisation; traiter les réessais et conflits de versions sans perte de preuve. SMS/Twilio optionnel seulement à la dernière phase.
- [ ] **TASK-009** — **Rôles, sécurité, audit et temps de travail** : contrôler côté serveur compagnie, site, rôle, délégation, droits de lecture/édition, documents et photos en Storage privé; conserver créateur, responsable, réalisation, modifications, horodatages et historique. La case cochée ou la formation consultée ne crée **jamais automatiquement** une session de punch, une heure rémunérée, une présence à un événement, une approbation de paie ou une certification obligatoire; appliquer séparément les règles RH et d'activités professionnelles rémunérées.
- [ ] **TASK-010** — **Recette réelle et critères d'acceptation** : tests pour tâches de poste, affectation à Kim sur un quart, tâches de ménage hebdomadaires, formation vidéo/PDF, coche/état bloqué/commentaire, changement d'horaire, annulation, remplacement unique, échec réseau/rejeu, concurrence et permissions multi-entreprises. Vérifier Web + Expo sur petits écrans et notifier seulement selon vrais canaux configurés; distinguer **développé / testé / déployé / fournisseur requis** avant de marquer terminé.

**Expérience attendue :** l'Admin ajoute « Ménage des présentoirs » à Kim le mardi en quelques gestes; Kim voit cette tâche directement dans son quart et peut la cocher. Le vendredi suivant, la tâche hebdomadaire prévue réapparaît une seule fois. En cas de signalement d'absence et de remplacement officiellement attribué, le nouveau salarié retrouve les tâches pertinentes du quart sans perdre l'historique de Kim. Un Boss peut voir les tâches restantes et les formations complétées, sans mélanger ce module avec le compteur d'heures.

## P2 — Calendriers personnels (CAL, 11 points)
**Objectif :** Permettre aux employés de suivre leurs quarts hors PUNCH.
**Sources :** Nouveaux ajouts / planning. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **CAL-001** — Publier les quarts de l’employé dans un agenda privé opt-in.
- [ ] **CAL-002** — Permettre export ICS de quart et événement unique.
- [ ] **CAL-003** — Proposer abonnement iCalendar personnel avec URL révocable.
- [ ] **CAL-004** — Gérer Google Calendar, Apple Calendar, Outlook via formats compatibles.
- [ ] **CAL-005** — Gérer modification/annulation sans doubler les événements.
- [ ] **CAL-006** — Respecter fuseaux sites, minuit et DST.
- [ ] **CAL-007** — Ne jamais partager les horaires d’autres employés.
- [ ] **CAL-008** — Prévoir filtre choix quarts, congés, événements selon permissions.
- [ ] **CAL-009** — Afficher état synchronisé vs non synchronisé et dernière mise à jour.
- [ ] **CAL-010** — Préparer adaptateurs bidirectionnels sans promettre API non connectées.
- [ ] **CAL-011** — Tester révocation lien et changement de rôle/compagnie.

## P2 — Cartes Wallet et pointage QR (WALLET, 66 points)
**Objectif :** Permettre une carte personnelle sécurisée Pro.
**Sources :** Nouveaux ajouts. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **WALLET-001** — Créer émission de cartes par employé pour le forfait Pro.
- [ ] **WALLET-002** — Gérer logo, nom, compagnie, identifiant opaque et QR.
- [ ] **WALLET-003** — Permettre ajout à Apple Wallet avec pass signé conforme.
- [ ] **WALLET-004** — Permettre ajout à Google Wallet via serveur et accès autorisé.
- [ ] **WALLET-005** — Conserver clés/certificats hors client et dépôt public.
- [ ] **WALLET-006** — Utiliser QR non sensible, révocable et anti-rejeu.
- [ ] **WALLET-007** — Ajouter validation de carte à la borne sans nouveau registre de punch.
- [ ] **WALLET-008** — Exiger confirmation/nip ou preuve complémentaire si QR statique.
- [ ] **WALLET-009** — Empêcher doublons IN/OUT entre borne QR et téléphone.
- [ ] **WALLET-010** — Gérer carte perdue, changement d’employeur, suspension et révocation.
- [ ] **WALLET-011** — Tester permissions caméra tablette, scan, refus et expiration.
- [ ] **WALLET-012** — Prévoir fonctionnement dégradé matricule/PIN en secours.
- [ ] **WALLET-013** — Réserver NFC VAS/Smart Tap à un lot ultérieur avec matériel compatible.
- [ ] **WALLET-014** — Ne pas déclarer Wallet livré avant certifications et essais sur appareils.
- [ ] **WALLET-015** — Sur l’écran d’accueil de la borne, implémenter réellement un **gros bouton « Scanner ma carte »** immédiatement reconnaissable, et non un simple texte ou lien caché dans les paramètres.
- [ ] **WALLET-016** — Conserver simultanément un bouton ou pavé **« Matricule / NIP »** aussi accessible pour les employés sans Wallet et comme secours.
- [ ] **WALLET-017** — Donner au bouton Scanner un format généreux adapté au doigt (cible tactile au moins 48×48 CSS px, idéalement plus grande), icône QR/caméra, contraste accessible et place stable pour les 10 thèmes.
- [ ] **WALLET-018** — Sur simple appui « Scanner ma carte », ouvrir une vue de scan avec titre « Présentez votre carte PUNCH devant la caméra » et instructions courtes; ne pas exiger une connexion personnelle au compte Boss.
- [ ] **WALLET-019** — Demander l’autorisation caméra **uniquement au moment du scan**, via API navigateur adaptée, sur origine HTTPS; ne pas activer caméra silencieusement au chargement de la borne.
- [ ] **WALLET-020** — Privilégier la caméra arrière si elle existe; proposer sélection de caméra avant/arrière ou périphérique lorsque disponible, sans échouer si une seule caméra existe.
- [ ] **WALLET-021** — Afficher un aperçu caméra fluide, un cadre de visée clair, des conseils distance/éclairage, et un état « Lecture en cours » compréhensible.
- [ ] **WALLET-022** — Décoder localement les QR de manière efficace, limiter la fréquence d’analyse, filtrer doubles lectures et ne déclencher qu’une vérification à la fois.
- [ ] **WALLET-023** — Ajouter « Annuler / Retour à la pointeuse » visible pendant tout le scan, utilisable au tactile et clavier, avec arrêt immédiat de la caméra.
- [ ] **WALLET-024** — Prévoir un délai d’expiration raisonnable du scan, distinct du délai d’inactivité classique de 10 secondes après punch; revenir à l’accueil sans conserver le QR.
- [ ] **WALLET-025** — En cas de permission refusée ou de caméra occupée, afficher une erreur utile et « Pointer avec matricule/NIP » sans bloquer l’appareil.
- [ ] **WALLET-026** — Gérer absence de caméra, navigateur non compatible, permission système désactivée, application PWA autonome et coupure caméra pendant le scan.
- [ ] **WALLET-027** — Traiter seulement le contenu décodé du QR côté serveur, jamais uploader, filmer, conserver ou journaliser le flux vidéo/captures du téléphone ou du visage.
- [ ] **WALLET-028** — Vérifier que les QR générés dans Apple Wallet et Google Wallet sont réellement lisibles sur les caméras iPad/Android, en conditions variées de luminosité, taille et distance.
- [ ] **WALLET-029** — Le QR transporte un identifiant opaque ou une preuve cryptographique de portée minimale : **aucun mot de passe, NIP, UUID Auth brut, courriel, secret serveur ou donnée RH**.
- [ ] **WALLET-030** — Définir et documenter la résistance à la copie/relecture : un QR Wallet statique ou une capture d’écran **ne suffit jamais seul** à enregistrer IN/OUT; exiger une deuxième preuve autorisée (ex. NIP) ou un mécanisme anti-rejeu réellement compatible avec les Wallet.
- [ ] **WALLET-031** — Vérifier côté serveur à chaque scan compagnie, borne appairée non révoquée, établissement autorisé, employé actif, détenteur de carte, révocation et absence d’accès intercompagnies.
- [ ] **WALLET-032** — Respecter l’abonnement Essentiel Pro, l’activation explicite du module Wallet par Boss/Admin et les permissions employé; aucune simple modification front ne doit contourner ces contrôles.
- [ ] **WALLET-033** — Permettre au Boss/Admin autorisé d’émettre, suspendre, révoquer ou réémettre des cartes individuelles, et d’activer Scanner par borne compatible, avec motif/audit.
- [ ] **WALLET-034** — Après vérification du QR, demander au serveur l’état officiel du salarié et déterminer l’action pertinente **IN ou OUT** selon sa session ouverte; ne pas deviner l’action dans l’interface.
- [ ] **WALLET-035** — Afficher avant écriture l’action exacte « Commencer ma journée » ou « Terminer ma journée », et demander la confirmation requise par la politique sécurisée; aucun punch silencieux dès la simple détection QR.
- [ ] **WALLET-036** — Si le QR est statique, demander un NIP personnel sur le pavé protégé avant de confirmer; masquer le NIP, limiter les essais et ne jamais enregistrer le NIP en clair.
- [ ] **WALLET-037** — Respecter les pauses, l’état « En pause », les actions autorisées et les règles actuelles de la borne; le scan ne doit pas terminer ou modifier une pause implicitement.
- [ ] **WALLET-038** — Appliquer au scan les mêmes garde-fous serveur que le pointage matricule/NIP : double punch, anti-chevauchement, idempotence, permissions, sessions concurrentes et périodes fermées.
- [ ] **WALLET-039** — Une confirmation serveur réussie affiche brièvement nom ou initiales minimisées, état IN/OUT et heure confirmée, puis efface toute information personnelle et revient à l’accueil.
- [ ] **WALLET-040** — Si réponse réseau perdue ou incertaine, présenter « Vérification nécessaire » et consulter l’état officiel avant de proposer un second punch; ne jamais afficher un faux succès.
- [ ] **WALLET-041** — Pour QR invalide, carte expirée, volée, révoquée, employé désactivé, forfait expiré ou mauvaise compagnie, expliquer « Carte non reconnue / non autorisée » sans révéler les données du salarié.
- [ ] **WALLET-042** — Quand le réseau manque, refuser la validation QR non prouvable; offrir le flux matricule/NIP existant si son mode hors ligne sécurisé est opérationnel et autorisé.
- [ ] **WALLET-043** — Garantir arrêt du flux caméra, destruction des données temporaires et retour au pavé partagé après succès, échec, annulation, déconnexion, expiration ou mise en arrière-plan prolongée.
- [ ] **WALLET-044** — Tester usage successif par plusieurs employés : aucune photo, carte, NIP, sélection, aperçu ou identité du précédent employé ne doit rester accessible.
- [ ] **WALLET-045** — Gérer la révocation immédiate après perte de téléphone, départ du salarié, changement de compagnie, suspension et rotation de cartes sans effacer l’historique des heures.
- [ ] **WALLET-046** — Éviter les SDK publicitaires et services externes de reconnaissance vidéo; journaliser seulement événements techniques, refus et pointages nécessaires avec rétention configurée.
- [ ] **WALLET-047** — Tester appareil tablette réellement : Android/iPad, Safari/Chrome/PWA installée, caméra avant/arrière, permission acceptée/refusée, luminosité, plusieurs QR et écran verrouillé/déverrouillé.
- [ ] **WALLET-048** — Tester sécurité intercompagnies, QR copié, capture d’écran, QR réutilisé, authentification NIP, essais excessifs, cartes révoquées, borne non appairée et employés non autorisés.
- [ ] **WALLET-049** — Tester flux complet Wallet → caméra → validation serveur → IN → OUT, pauses, reprise, téléphone/borne croisés, erreurs réseau, simultanéité et double scan.
- [ ] **WALLET-050** — Tester les dix thèmes de borne, rotations, tailles d’écran, accessibilité, clavier, retours automatiques et absence de faux messages « Fonctionnel » avant certificats Wallet et validation sur appareil.
- [ ] **WALLET-051** — Ajouter dans **Boss/Admin → Employés → Fiche employé → Carte virtuelle** les actions explicites « Envoyer ma carte », « Renvoyer le lien », « Remplacer la carte » et « Révoquer la carte », visibles seulement pour les gestionnaires habilités d’une compagnie Essentiel Pro ayant activé Wallet.
- [ ] **WALLET-052** — Sur changement de téléphone, proposer deux parcours distincts : **Renvoyer le lien** pour récupérer une carte encore valide selon les capacités du fournisseur, ou **Remplacer la carte** pour émettre une nouvelle version et invalider l’ancienne; décrire clairement les conséquences avant confirmation.
- [ ] **WALLET-053** — Permettre l’envoi au salarié par **courriel d’invitation sécurisé** si canal configuré; SMS seulement quand Twilio sera réellement activé plus tard; sinon, proposer un lien à usage unique remis via canal de confiance, sans exposer le QR ou l’identifiant dans les notifications.
- [ ] **WALLET-054** — Le lien d’installation doit être **aléatoire, temporaire, à usage unique, lié au bon salarié et à la bonne compagnie**, avec vérification d’identité appropriée avant l’émission ou l’ajout dans Apple Wallet/Google Wallet; ne jamais utiliser un simple lien public donnant accès à une carte d’autrui.
- [ ] **WALLET-055** — Au remplacement après perte, vol ou révocation, **désactiver atomiquement l’ancienne génération du jeton/QR côté serveur**; ne jamais considérer qu’une suppression du pass sur l’ancien téléphone est garantie ou suffisante pour invalider la carte.
- [ ] **WALLET-056** — Conserver exactement le même **dossier salarié, matricule, rôle, permissions, affectations, heures et identité facturable**, sans créer de deuxième employé, de deuxième place payante ou effacer un seul pointage.
- [ ] **WALLET-057** — Afficher sur la fiche salarié les états **Aucune carte / Active / Invitation envoyée / Lien expiré / Révoquée / Remplacée**, la date de dernière émission, le canal d’envoi et les tentatives sans exposer de NIP, code QR ou secret; consigner dans l’audit les actions et leur auteur.
- [ ] **WALLET-058** — Exiger une confirmation renforcée du gestionnaire pour « Remplacer » ou « Révoquer », limiter les renvois et les essais (quotas/anti-abus), vérifier permissions/tenant/forfait côté serveur et éviter les multiples cartes actives par erreur selon la politique retenue.
- [ ] **WALLET-059** — Fournir à l’employé une option personnelle « Ajouter de nouveau à Apple Wallet / Google Wallet » après authentification, sans lui permettre d’émettre la carte d’un collègue; si la carte précédente est révoquée, rediriger vers la nouvelle émission.
- [ ] **WALLET-060** — Tester **changement Android→Android, iPhone→iPhone, Android→iPhone, iPhone→Android**, téléphone perdu, lien consommé/expiré, mauvais destinataire, deux demandes simultanées, annulation, carte ancienne scannée, salarié désactivé et pointages conservés; ne déclarer « livré » qu’après essais fournisseur/appareil.
- [ ] **WALLET-061** — Évaluer le mécanisme Google Wallet de **QR/barcode tournant** avec vérification OTP, secret individuel côté serveur et fenêtre de validité courte; ne jamais ajouter un fallback statique qui rendrait la rotation inutile pour la sécurité.
- [ ] **WALLET-062** — Pour les passes Apple Wallet à code QR statique ou autre format non dynamique, exiger **NIP ou vérification supplémentaire**; ne pas prétendre qu’une carte visible dans Wallet prouve à elle seule la présence ou l’identité de la personne.
- [ ] **WALLET-063** — Un salarié inscrit à plusieurs compagnies doit obtenir une **carte distincte par compagnie**, avec identifiant, permission, émission, révocation et affichage clairement séparés; aucune carte d’une entreprise ne doit fonctionner sur la borne d’une autre.
- [ ] **WALLET-064** — Tester la lecture des **écrans Apple et Android** avec la caméra et des lecteurs externes optiques compatibles; privilégier les formats 2D réellement supportés et ne pas supposer qu’un scanner laser lit un écran de téléphone.
- [ ] **WALLET-065** — Journaliser des **statistiques techniques agrégées** par borne (lectures réussies, permissions caméra refusées, lecteur indisponible, échecs de décodage, délais) sans stocker images, QR bruts ni renseignements personnels dans la télémétrie.
- [ ] **WALLET-066** — Vérifier après remplacement de téléphone qu’un **ancien pass toujours visible** ou une capture de l’ancien QR n’autorise plus aucun pointage, même si la suppression distante de la carte sur l’ancien appareil n’est pas possible.

### Parcours de réémission de carte lors d'un changement de téléphone
1. Dans la fiche Employé, le Boss/Admin autorisé choisit **Carte virtuelle → Renvoyer le lien** (carte valide) ou **Remplacer la carte** (téléphone perdu/volé ou remplacement requis), puis vérifie l'identité et la bonne compagnie.
2. Le serveur crée un lien d'installation sécurisé, limité et temporaire, utilisable uniquement par l'employé visé. L'employé reçoit un courriel si l'envoi est configuré, un SMS quand le service sera disponible, ou un lien transmis de façon sécurisée.
3. L'employé ouvre le lien sur son nouveau téléphone, valide son identité et ajoute sa carte dans le Wallet compatible. Le lien expire ou se ferme après usage. Les données privées et le QR ne sont pas exposés dans le lien lui-même.
4. Si **Remplacer** a été choisi, l'ancienne génération de carte et son QR sont **refusés immédiatement par le serveur**, y compris si une copie de l'ancien pass reste affichée dans un ancien téléphone.
5. Aucune nouvelle place facturable, aucun nouveau dossier salarié et **aucune modification des heures, pauses, horaires ou historiques**. L'Admin voit l'état et le journal de l'opération sans pouvoir découvrir ou récupérer de secret.
6. Tester renvoi, remplacement, cartes volées, changement iPhone/Android, anciens QR, réémissions simultanées et invitation expirée sur appareils réels.

### Parcours fonctionnel obligatoire — bouton « Scanner ma carte » sur borne
1. Une borne d’entreprise **Pro**, appairée, autorisée et équipée d’une caméra affiche sur son accueil un **gros bouton « Scanner ma carte »** bien visible, ainsi que le pointage **Matricule/NIP**. Hors Pro ou module désactivé, ne pas afficher un bouton inopérant.
2. Un employé ouvre **sa carte PUNCH** depuis Apple Wallet ou Google Wallet sur son téléphone. La borne ne demande jamais son mot de passe de compte ou celui du Boss.
3. L’employé touche **« Scanner ma carte »**; la borne demande la permission caméra à cette étape uniquement, active le bon objectif et montre un cadre de visée avec retour/annulation.
4. L’employé présente le QR au cadre; la borne lit le contenu en local et lance une **vérification unique côté serveur** contre la compagnie, le forfait Pro, l’activation, la carte et l’appairage de borne.
5. Pour un **QR statique/copied possible**, la borne demande **une seconde preuve telle qu’un NIP**. Un simple QR ou sa capture d’écran ne peut jamais pointer seul; si un pass dynamique anti-rejeu est proposé, sa compatibilité réelle Apple/Google doit être prouvée.
6. Le serveur retourne l’état courant de présence et l’action IN ou OUT possible. L’écran demande explicitement de confirmer cette action (selon le flux de sécurité) et réutilise les mêmes RPC/événements officiels que le NIP et le téléphone.
7. Après confirmation serveur, afficher brièvement « Entrée enregistrée » ou « Sortie enregistrée » et l’heure réelle, fermer caméra, vider identité/PIN/QR temporaire et revenir automatiquement à l’accueil.
8. En cas de refus caméra, lecteur indisponible, QR invalide, réseau perdu ou permission refusée, montrer une erreur compréhensible avec **« Pointer avec matricule/NIP »**; ne jamais bloquer le pointage normal, inventer un succès ou conserver le flux caméra.
9. Test de recette : **une vraie tablette iPad + une Android** et des passes **Apple Wallet + Google Wallet**, incluant QR d’une autre compagnie, capture copiée, révocation, timeout, multi-employés et double pointage; noter **non testé** tant que non réalisé.

**Priorisation :** le bouton d’accueil relève du parcours Bornes P0 et ne doit pas modifier le fonctionnement existant. La création des passes, l’intégration QR et la certification des services Wallet sont des tâches Pro P2 dépendantes des protections P0. Conserver intégralement le matricule/NIP.


## P2 — Déplacements professionnels GPS Pro (GPS, 18 points)
**Objectif :** GPS uniquement pour employeurs admissibles et explicitement activé.
**Sources :** Nouveaux ajouts. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **GPS-001** — Créer module GPS Pro désactivé par défaut.
- [ ] **GPS-002** — Interdire entièrement Déplacements pour secteur commerce de détail.
- [ ] **GPS-003** — Empêcher activation si secteur inconnu jusqu’à classification validée.
- [ ] **GPS-004** — Afficher bouton Déplacements sur page Punch seulement si éligible et activé.
- [ ] **GPS-005** — Ne jamais créer cinquième onglet employé pour déplacements.
- [ ] **GPS-006** — Permettre Boss/Admin autorisé d’activer par entreprise, salarié, département.
- [ ] **GPS-007** — Imposer les mêmes gardes de forfait, secteur et rôle côté RPC et API.
- [ ] **GPS-008** — Démarrer et arrêter trajet par action explicite du salarié.
- [ ] **GPS-009** — Afficher indicateur visible pendant la collecte GPS.
- [ ] **GPS-010** — Gérer parcours, durée, distance, client/visite, notes et historique.
- [ ] **GPS-011** — Gérer trajets à étapes, pauses et pertes de signal sans inventer distance.
- [ ] **GPS-012** — Utiliser Expo Location arrière-plan sous consentement et droits natifs.
- [ ] **GPS-013** — Distinguer suivi natif fiable des limites d’une PWA.
- [ ] **GPS-014** — Permettre correction de distance motivée et auditable.
- [ ] **GPS-015** — Calculer indemnité par taux kilométrique configurable et daté.
- [ ] **GPS-016** — Soumettre, approuver/refuser avec motif et éviter autoapprobation.
- [ ] **GPS-017** — Exporter kilomètres/remboursements sans les traiter comme heures payées.
- [ ] **GPS-018** — Limiter rétention, accès à la carte et usage des positions privées.

## P2 — Dépenses, reçus et remboursements Pro (EXPENSE, 18 points)
**Objectif :** Gestion des frais professionnels, y compris commerce de détail.
**Sources :** Nouveaux ajouts. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **EXPENSE-001** — Créer module Dépenses Pro séparé du suivi GPS.
- [ ] **EXPENSE-002** — Autoriser le module Dépenses dans les commerces de détail s’il est activé.
- [ ] **EXPENSE-003** — Ajouter Mes dépenses dans l’onglet Plus uniquement si autorisé.
- [ ] **EXPENSE-004** — Permettre facture photographiée ou import PDF/image.
- [ ] **EXPENSE-005** — Conserver catégorie, fournisseur, date, description, montant et devise.
- [ ] **EXPENSE-006** — Gérer taxes TPS/TVQ, pourboire et sous-total de façon explicite.
- [ ] **EXPENSE-007** — Utiliser OCR comme proposition nécessitant validation de l’employé.
- [ ] **EXPENSE-008** — Garder original privé même si OCR échoue.
- [ ] **EXPENSE-009** — Gérer brouillon, soumis, correction, approuvé, refusé et remboursé.
- [ ] **EXPENSE-010** — Interdire approbation de sa propre demande et doublons.
- [ ] **EXPENSE-011** — Gérer limites de remboursement par employé ou politique.
- [ ] **EXPENSE-012** — Permettre avances de fonds si configurées, avec journal financier séparé.
- [ ] **EXPENSE-013** — Relier dépenses stationnement/repas à un trajet sans double comptage.
- [ ] **EXPENSE-014** — Permettre accès Boss/Admin RH autorisé aux justificatifs uniquement.
- [ ] **EXPENSE-015** — Gérer rapports par employé, site, mois, catégorie et client.
- [ ] **EXPENSE-016** — Exporter CSV, PDF et justificatifs pour comptabilité.
- [ ] **EXPENSE-017** — Ne jamais simuler virement bancaire sous statut remboursé.
- [ ] **EXPENSE-018** — Préparer adaptateurs QuickBooks/Sage sans fausses intégrations.

## P2 — Talons de paie numériques Pro (TALON, 11 points)
**Objectif :** Utiliser le stockage RH privé existant, éviter logiciel paie complet.
**Sources :** Nouveaux ajouts / RH. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **TALON-001** — Ajouter Mes talons de paie dans l’onglet Plus si droit Pro.
- [ ] **TALON-002** — Permettre import simple et lot multi-PDF par responsable autorisé.
- [ ] **TALON-003** — Associer chaque PDF au bon salarié et sa période de paie.
- [ ] **TALON-004** — Exiger contrôle d’association avant publication en lot.
- [ ] **TALON-005** — Afficher état privé publié/révoqué et notification au salarié.
- [ ] **TALON-006** — Limiter lecture/téléchargement au destinataire et au responsable rémunération.
- [ ] **TALON-007** — Utiliser Storage privé, URL de téléchargement à durée limitée et audit.
- [ ] **TALON-008** — Gérer erreur d’association et correction sans effacer l’historique.
- [ ] **TALON-009** — Permettre consultation et téléchargement depuis appareil personnel.
- [ ] **TALON-010** — Ne pas calculer impôts, retenues et paie officielle sans moteur conforme.
- [ ] **TALON-011** — Exporter CSV des heures fermées vers logiciel de paie.

## P2 — Design de l’écran Punch et interfaces (DESIGN, 14 points)
**Objectif :** Harmoniser sans modifier Construction.
**Sources :** Visuel accueil / thème Design report. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **DESIGN-001** — Conserver fond chaud #FAFBF8, sauge #779574, texte #2F4935, bordures #E1E8DB.
- [ ] **DESIGN-002** — Réutiliser références réelles Drive (travail/pause et vue globale).
- [ ] **DESIGN-003** — Avoir des composants arrondis, ombres discrètes et navigation claire.
- [ ] **DESIGN-004** — Maintenir stabilité pixel à pixel du cadran et des boutons travail/pause.
- [ ] **DESIGN-005** — Retirer textes/états répétés pour conserver de la place.
- [ ] **DESIGN-006** — Tester non-scroll écran Punch sur petits téléphones et safe-areas.
- [ ] **DESIGN-007** — Ne pas couper boutons sur Galaxy S25 Ultra, petits Android et iPhone.
- [ ] **DESIGN-008** — Assurer police agrandie, contraste, focus clavier et lecteurs d’écran.
- [ ] **DESIGN-009** — Harmoniser Employé, Admin, Boss sans donner aux rôles mêmes actions.
- [ ] **DESIGN-010** — Conserver l’interface Super Admin commune neutre aux deux éditions.
- [ ] **DESIGN-011** — Harmoniser tableaux et formulaires Web/Expo sans écrans factices.
- [ ] **DESIGN-012** — Vérifier les états vide, chargement, hors ligne, erreur et refus.
- [ ] **DESIGN-013** — Conserver icônes et boutons top right selon design public validé.
- [ ] **DESIGN-014** — Ne jamais importer les visuels ou modules propres à PUNCH Construction dans PUNCH Essentiel : **la météo de chantier reste uniquement dans Construction**, ainsi que jobs/plans/commandes de matériel. Préserver les deux éditions indépendantes.

## P2 — Thèmes et borne visuelle (THEMES, 11 points)
**Objectif :** Livrer vingt ambiances employés et dix thèmes borne réels.
**Sources :** visuel borne / Master. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **THEMES-001** — Conserver 20 thèmes personnels employés approuvés.
- [ ] **THEMES-002** — Vérifier que les thèmes 1–10 possèdent les bonnes références source.
- [ ] **THEMES-003** — Conserver les thèmes 11–20 déjà développés et ne pas les remplacer.
- [ ] **THEMES-004** — Implémenter dix thèmes de borne : sauge, clair, sombre vert, bleu clair, gris.
- [ ] **THEMES-005** — Compléter borne : noir premium, lavande, pêche, bleu nuit, sable.
- [ ] **THEMES-006** — Utiliser un unique composant fonctionnel pour les dix apparences de borne.
- [ ] **THEMES-007** — Permettre sélection, prévisualisation et persistance par borne.
- [ ] **THEMES-008** — Permettre thème par défaut et application à toutes bornes avec confirmation.
- [ ] **THEMES-009** — Vérifier contrastes, petits écrans, portrait/paysage et clavier.
- [ ] **THEMES-010** — Le thème ne doit jamais changer identité ni permissions de borne.
- [ ] **THEMES-011** — Conserver choix après redémarrage/reconnexion.

## P2 — Pages publiques, inscription, onboarding (COMMERCIAL, 13 points)
**Objectif :** Rendre inscription et vente compréhensibles.
**Sources :** Master / Site commercial / paiement. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **COMMERCIAL-001** — Présenter deux éditions distinctes dès la page publique.
- [ ] **COMMERCIAL-002** — Afficher trois cartes Essentiel 19/39/69 avec arguments différenciés.
- [ ] **COMMERCIAL-003** — Mettre Plus discrètement en évidence, Pro premium sans surcharge.
- [ ] **COMMERCIAL-004** — Afficher cinq personnes incluses et bornes par forfait.
- [ ] **COMMERCIAL-005** — Afficher mensualité, annualité -15%, total annuel et coûts des sièges.
- [ ] **COMMERCIAL-006** — Afficher prix avant taxes, décompte et données du catalogue serveur.
- [ ] **COMMERCIAL-007** — Offrir comparaison détaillée des fonctionnalités et FAQ.
- [ ] **COMMERCIAL-008** — Préserver parcours création compte → compagnie → places → Stripe → tableau Boss.
- [ ] **COMMERCIAL-009** — Permettre Google, Apple et courriel si réellement configurés.
- [ ] **COMMERCIAL-010** — Prévenir activation d’un abonnement par simple retour Checkout.
- [ ] **COMMERCIAL-011** — Garder boutons de connexion/inscription dans l’en-tête prévu.
- [ ] **COMMERCIAL-012** — Vérifier SEO de base, responsive, accessibilité et chargement.
- [ ] **COMMERCIAL-013** — Ne jamais vendre comme opérationnelle une fonction Pro non livrée.

## P1 — Archives, exports, restauration et PRA (ARCHIVE, 13 points)
**Objectif :** Prouver une vraie récupération et restauration contrôlée.
**Sources :** PR #14 / Company archives. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **ARCHIVE-001** — Conserver archives signées et chiffrées produites par l’application.
- [ ] **ARCHIVE-002** — Limiter export Boss/Super Admin autorisés et sessions MFA selon rôle.
- [ ] **ARCHIVE-003** — Exclure mots de passe, PIN, sessions, paiements et secrets des archives.
- [ ] **ARCHIVE-004** — Préserver documents privés et références de téléchargement éphémères.
- [ ] **ARCHIVE-005** — Vérifier signature/format/mot de passe avant prévisualisation d’import.
- [ ] **ARCHIVE-006** — Restaurer additivement les données manquantes sans écraser l’actuel.
- [ ] **ARCHIVE-007** — Lier toute restauration à la compagnie d’origine.
- [ ] **ARCHIVE-008** — Garder salariés récupérés désactivés jusqu’à autorisation.
- [ ] **ARCHIVE-009** — Refuser restauration automatique de punch ouvert et de permissions.
- [ ] **ARCHIVE-010** — Tester fichier corrompu, conflit, mauvaise clé et reprise idempotente.
- [ ] **ARCHIVE-011** — Tester vrai PDF binaire Storage avec Auth dans environnement isolé.
- [ ] **ARCHIVE-012** — Observer purge effective des fichiers temporaires expirés.
- [ ] **ARCHIVE-013** — Préparer sauvegardes infrastructure, politique RPO/RTO et exercice PRA.

## P3 — Langues, temps et accessibilité globale (LOCALE, 11 points)
**Objectif :** Finir l’internationalisation sans casser l’ergonomie.
**Sources :** Roadmap E29 / Master. **État initial :** nouveau / à développer ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **LOCALE-001** — Implémenter architecture de traduction avec clés versionnées.
- [ ] **LOCALE-002** — Livrer français et anglais complets en premier.
- [ ] **LOCALE-003** — Ajouter espagnol, portugais, italien, allemand.
- [ ] **LOCALE-004** — Ajouter arabe, chinois simplifié, hindi et tagalog.
- [ ] **LOCALE-005** — Tester affichage RTL arabe dans toutes les interfaces.
- [ ] **LOCALE-006** — Tester changement de langue par utilisateur.
- [ ] **LOCALE-007** — Gérer formats locaux date/heure/monnaie/nombre.
- [ ] **LOCALE-008** — Conserver fuseau site pour moteur temps indépendamment de langue.
- [ ] **LOCALE-009** — Traduire alertes, erreurs, courriels et contenus système.
- [ ] **LOCALE-010** — Éviter chaînes codées en dur dans Web et Expo.
- [ ] **LOCALE-011** — Tester écrans compacts avec textes allongés et lecteurs d’écran.

## P3 — QA, vrais appareils, déploiement et lancement (QA, 20 points)
**Objectif :** Livrer un produit commercialisable sans confondre compilation et recette.
**Sources :** Prompt final tests / roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **QA-001** — Construire matrice exigences → code → test → preuves → verdict.
- [ ] **QA-002** — Tester cinq rôles et permissions sensibles dans deux compagnies fictives.
- [ ] **QA-003** — Tester un parcours complet Boss → compagnie → invitation → punch → heures → paie.
- [ ] **QA-004** — Tester branches Plus/Pro, changement de forfait et restrictions.
- [ ] **QA-005** — Tester concurrence sur dernier quart, approbations et double punch.
- [ ] **QA-006** — Tester minuit, DST, déconnexion et sessions révoquées.
- [ ] **QA-007** — Tester hors ligne/retour réseau sur Android/iPhone/iPad physiques.
- [ ] **QA-008** — Tester 20 thèmes employés et 10 thèmes de borne avec vraies captures.
- [ ] **QA-009** — Tester petits écrans, orientation, accessibilité, clavier et zoom.
- [ ] **QA-010** — Tester Stripe Sandbox et fournisseurs OAuth/notifications/mail réels.
- [ ] **QA-011** — Exécuter npm ci, TypeScript, tests Node, SQL rollback et Edge Deno.
- [ ] **QA-012** — Compiler et signer vrais builds Android/iOS plutôt que se limiter à Metro.
- [ ] **QA-013** — Vérifier CI, GitHub Pages, contenu publié et routes servies.
- [ ] **QA-014** — Vérifier charge/concurrence sur environnement isolé.
- [ ] **QA-015** — Exécuter restauration test et exercices d’incident/PRA.
- [ ] **QA-016** — Protéger les données de production et consigner les actions à faire manuellement.
- [ ] **QA-017** — Établir verdict GO / GO conditionnel / NO-GO par domaine.
- [ ] **QA-018** — Tester que retard, no-show, GPS absent, non-punch ou anomalie **sans signalement confirmé** produisent zéro offre; signalement confirmé répété reste une seule demande, sans effacer l'historique d'heures.
- [ ] **QA-019** — Tester les neuf motifs, aucune valeur présélectionnée, « Autre »/raison personnelle/option privée, notes facultatives malicieuses, annulation, rôles/RLS et absence de fuite vers notifications/offres/exports.
- [ ] **QA-020** — Tester **deux acceptations en concurrence réelle** en mode approbation et automatique : un seul gagnant, refus tardif explicite, réponse perdue, offre expirée, qualification retirée, site/département, nuit/DST et quart déjà commencé.

## P4 — Services, intégrations et SMS en dernier (SERVICES, 11 points)
**Objectif :** Ne pas bloquer les lots prioritaires sur les configurations externes.
**Sources :** Prompt maître / Services / Twilio. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **SERVICES-001** — Vérifier état fournisseur courriel et configuration DNS/SPF/DKIM si nécessaire.
- [ ] **SERVICES-002** — Valider webhooks courriels signés, rebonds, livraisons et reprises.
- [ ] **SERVICES-003** — Configurer FCM/APNs/EAS pour la réception push native.
- [ ] **SERVICES-004** — Tester stockage autorisations notification et désinscription.
- [ ] **SERVICES-005** — Configurer certificats Apple Wallet et accès Google Wallet pour Pro.
- [ ] **SERVICES-006** — Choisir OCR justifié et limiter coûts/exposition des factures.
- [ ] **SERVICES-007** — Préparer clés/API paie ou calendrier seulement si intégration activée.
- [ ] **SERVICES-008** — Conserver secrets uniquement dans gestionnaires côté serveur.
- [ ] **SERVICES-009** — Afficher Super Admin état de chaque service et dernier contrôle réel.
- [ ] **SERVICES-010** — Reporter l’intégration SMS/Twilio à la fin, conformément à la priorité du propriétaire.
- [ ] **SERVICES-011** — Tester SMS, quotas, consentements, retours de livraison sans vrais envois imprévus.

## Exigences explicites de gestion des prompts et du tableau de bord
1. Utiliser le Drive « promt » et ses sous-dossiers comme boîte d’entrée (jamais comme source d’un secret public).
2. Rapprocher fichiers nouveaux/modifiés aux IDs existants : ne pas dupliquer deux fois la même exigence.
3. Pour chaque lot et tâche, renseigner état d’audit, état de développement, tests, état de déploiement, preuve, bloqueur, prochaine action et date de mise à jour.
4. Conserver un tracker JSON versionné et une vue Web responsive lisible sur Android; son contenu reflète des preuves, jamais un pourcentage inventé.
5. Lors d’une session Work, lire le tracker et les nouveaux prompts du Drive; mettre les statuts à jour par PR avec références de code/test.
6. La simple présence d’une page Web temporaire ne prouve pas une synchronisation automatique Drive/Work; l’ajouter uniquement avec une automatisation expressément configurée et sécurisée.
7. Prioriser les régressions du moteur commun, les tests de rôle, les cas limites et les migrations sans effet destructif.
8. À la fin de chaque session, indiquer exactement la tâche suivante avec les IDs, sans faire croire à une exécution en arrière-plan.

## Verdict de lancement
Établir un verdict **GO, GO CONDITIONNEL ou NO-GO** après QA de bout en bout, correction, retest, politique de sauvegarde, revue de confidentialité, appareil réel et tests Stripe/OAuth/fournisseurs. Lancer uniquement les fonctions pleinement validées et clairement présentées comme telles. **Ne pas déclarer le prompt terminé tant que les points non validés ne sont pas traités ou expliqués individuellement.**