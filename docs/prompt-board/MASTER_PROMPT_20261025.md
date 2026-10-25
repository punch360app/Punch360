# PUNCH 360° — PROMPT MAÎTRE CONSOLIDÉ ET PRIORISÉ
**Édition du 25 octobre 2026 — 431 exigences identifiées en 27 lots.**

Tu es une équipe de développement senior (architecture SaaS, full-stack, Expo/React Native, PostgreSQL/Supabase, sécurité, QA, design et DevOps). Tu dois **reprendre le projet existant et développer réellement**, sans te limiter à une maquette ou un audit. Ne redemande pas « continue » après chaque lot; travaille tant que la séance et les permissions le permettent, en documentant honnêtement les dépendances restantes. Tu ne peux pas supposer une exécution automatique entre deux sessions.

## Références immuables et périmètre
- GitHub officiel : https://github.com/punch360app/Punch360
- Supabase exclusif : `mlabstdxxwjdpfaxiwmg` (aucun autre projet).
- Web Essentiel : https://punch360app.github.io/Punch360/?edition=essential
- Borne : https://punch360app.github.io/Punch360/kiosk.html
- Drive source : https://drive.google.com/drive/folders/1vnzIYol5OZxV3MySFZQjzcxV-VhRGfD4
- Références dépôt : `docs/README_COLLABORATEUR_WORK.md`, `docs/PUNCH_MASTER_ROADMAP.md`, `docs/PUNCH_WORK_CONTINUATION.md`, `docs/CONTINUATION_PROMPT_20261025.md`, `docs/PLATFORM_ACTIONS_AUDIT_20261025.md`, `docs/ESSENTIAL_MIXED_PUNCH_SPEC.md`, les documents de modules et tests. Inspecter les fichiers réellement présents et les nouvelles PR avant toute décision.
- Deux produits séparés : PUNCH Essentiel (trois forfaits) et PUNCH Construction (fonctionnalités/prix indépendants). Super Admin commun. Protéger données réelles, historisations et contrats.
- Forfaits Essentiel de référence : 19/39/69 $ CAD mensuels, 5 sièges, suppléments 3/4/5 $/mois, bornes 1/3/illimitées et -15 % annuel. Toujours lire la version contractuelle serveur, ne pas figer ces valeurs dans le front.
- Développement principalement Essentiel et Super Admin transversal; Construction en tests de non-régression, sans refonte non demandée.

## Résultats vérifiés au départ et limites
- PR archives #14 déjà fusionnée ; PR documentation/suivi #26 créée en brouillon : consulter leur état récent.
- Super Admin partiel : protections MFA, tarification/catalogue, comptes test et coffre, support, promotions, rapports, annuaires en consultation déjà documentés. Ne pas les recoder. Actions commerciales réelles, traitement comptes réels, Stripe fournisseur et recette appareils restent ouverts.
- Projet Supabase actif, Edge Functions présentes; l’inventaire des migrations Supabase a montré deux migrations de budgets postérieures au main inspecté. **Réconcilier le drift avant toute migration**.
- Auditeur Supabase a remonté de nombreuses fonctions SECURITY DEFINER exécutables avec rôle authentifié, et protection contre les mots de passe compromis non activée; effectuer revue et remédiation contrôlée, sans révoquer arbitrairement les fonctions métier légitimes.
- Beaucoup de fonctions disposent de code et de tests logiciel/SQL, mais **aucune preuve de recette universelle appareil/fournisseur/charge**. Les statuts initiaux du tracker reflètent cette incertitude.

## Ordre de livraison impératif
**P0** sécurité, continuité des données, Super Admin et facturation, pointage/borne; **P1** gestion des horaires, RH, budgets et archives; **P2** nouveaux modules commerciaux Pro, événements, design et site public; **P3** langues et recette globale; **P4** intégrations secondaires et SMS à la fin. Un lot indépendant peut avancer si un fournisseur bloque un autre.

## Règles de preuve et clôture
Pour chaque ID ci-dessous : auditer l’existant → choisir fichiers/schéma/règles → coder → appliquer contrôles serveur → tester avec données fictives → vérifier CI/déploiement → documenter PR/commit/migration/tests → actualiser la roadmap et le tracker. Conserver **quatre états indépendants** : développé, testé, déployé, intervention externe. « Terminé » seulement si les critères fonctionnels, sécurité et recette pertinente sont démontrés. Ne pas publier de secrets, fichiers RH/GPS ni prompts bruts privés dans le dépôt public. Ne jamais présenter un hash Auth comme mot de passe récupérable. Ne pas lancer de vraies transactions, SMS ou actions destructrices pour tester.

## P0 — Reprise, Drive et traçabilité (GOV, 15 points)
**Objectif :** Centraliser les demandes sans perdre les travaux déjà réalisés.
**Sources :** Drive / prompts + GitHub roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **GOV-001** — Confirmer le dépôt officiel punch360app/Punch360 et le main réellement actuel.
- [ ] **GOV-002** — Confirmer l’unique projet Supabase mlabstdxxwjdpfaxiwmg avant toute opération.
- [ ] **GOV-003** — Lire les sept documents de travail Drive et les deux sous-dossiers de visuels.
- [ ] **GOV-004** — Lire le README collaborateur, continuation, roadmap et les spécifications pertinentes.
- [ ] **GOV-005** — Inventorier toutes les PR ouvertes et branches de collaborateurs avant d’écrire.
- [ ] **GOV-006** — Réconcilier les migrations du dépôt et de Supabase sans rejouer les migrations appliquées.
- [ ] **GOV-007** — Ne jamais repartir de zéro ou remplacer le moteur de pointage partagé.
- [ ] **GOV-008** — Conserver PUNCH Construction intact et ses prix, autorisations et écrans séparés.
- [ ] **GOV-009** — Éclater les prompts volumineux en exigences avec identifiants stables et critères vérifiables.
- [ ] **GOV-010** — Associer chaque exigence à ses fichiers, RPC, Edge Functions, PR et tests.
- [ ] **GOV-011** — Maintenir GitHub comme source de vérité du suivi; Drive reste boîte d’entrée.
- [ ] **GOV-012** — Mettre à jour le tracker, la roadmap et la continuation après chaque lot.
- [ ] **GOV-013** — Garder les prompts bruts et secrets hors du dépôt GitHub public.
- [ ] **GOV-014** — Différencier développé, testé, déployé et intervention externe pour chaque point.
- [ ] **GOV-015** — Ne jamais affirmer qu’un prompt est terminé si une de ses sous-exigences manque.

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
- [ ] **STRIPE-013** — Tester échec de paiement, délai de sursis configurable et notifications.
- [ ] **STRIPE-014** — Préserver pointage et accès aux heures durant la restriction commerciale.
- [ ] **STRIPE-015** — Tester annulation en fin de période et réabonnement.
- [ ] **STRIPE-016** — Rapprocher les paiements, remboursements et frais Stripe avec les rapports.
- [ ] **STRIPE-017** — Ne jamais lancer de vrai débit pendant la recette sans autorisation.
- [ ] **STRIPE-018** — Valider état complet des webhooks et Checkout sur vraies ressources Stripe Sandbox.

## P0 — Pointage Essentiel personnel (CORE, 18 points)
**Objectif :** Conserver un pointage fiable et une interface sans surcharge.
**Sources :** Design Accueil / Master / roadmap. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **CORE-001** — Garder 4 onglets employés fixes : Punch, Heures, Horaire, Plus.
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

## P0 — Bornes communes et accès Admin/Boss (KIOSK, 26 points)
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

## P1 — Horaires, équipes, rotations et disponibilités (SHIFT, 15 points)
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

## P1 — Quarts disponibles, échanges et remplacements (COVER, 17 points)
**Objectif :** Définir trois parcours séparés avec règles d’approbation.
**Sources :** Remplacements dans Drive / planning. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **COVER-001** — Permettre au responsable de publier un quart libre Plus/Pro.
- [ ] **COVER-002** — Définir date, début/fin, site, département, poste et places restantes.
- [ ] **COVER-003** — Définir qualifications, expiration et note de l’offre.
- [ ] **COVER-004** — Afficher offres admissibles seulement à l’employé concerné.
- [ ] **COVER-005** — Permettre Postuler et Retirer candidature sans doublon.
- [ ] **COVER-006** — Afficher en attente/accepté/refusé/complet/annulé.
- [ ] **COVER-007** — Valider disponibilité, congés, conflit, site et qualification avant attribution.
- [ ] **COVER-008** — Effectuer approbation atomique, sans attribuer dernière place deux fois.
- [ ] **COVER-009** — Ajouter le quart à l’horaire et notifier la décision.
- [ ] **COVER-010** — Permettre à un salarié d’offrir son propre quart à remplacer.
- [ ] **COVER-011** — Configurer par compagnie remplacement automatique OU approbation obligatoire.
- [ ] **COVER-012** — Ne jamais effectuer un remplacement automatique sans tous les contrôles serveur.
- [ ] **COVER-013** — Permettre échange de quart avec consentement des deux salariés.
- [ ] **COVER-014** — Distinguer quart vacant, remplacement et échange dans l’interface.
- [ ] **COVER-015** — Distinguer quart supplémentaire et calcul réel d’heures majorées.
- [ ] **COVER-016** — Ajouter coûts/couverture des candidats au Pro, jamais classement opaque.
- [ ] **COVER-017** — Journaliser décisions, erreurs de concurrence et changements de version.

## P1 — RH, approbations, pauses et rapports paie (HR, 17 points)
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

## P2 — Événements, communications, notifications (COMM, 12 points)
**Objectif :** Centraliser événements professionnels et communications par équipe.
**Sources :** Nouveaux ajouts / notifications existantes. **État initial :** partiellement développé ou à vérifier ; aucun élément ci-dessous ne doit être présumé validé sans preuve.
- [ ] **COMM-001** — Réutiliser annonces existantes avec confirmation de lecture.
- [ ] **COMM-002** — Créer réunions, formations, fêtes et événements obligatoires Plus/Pro.
- [ ] **COMM-003** — Permettre invitations compagnie, site, département et @mentions.
- [ ] **COMM-004** — Distinguer invitation lue, réponse, présence prévue et présence constatée.
- [ ] **COMM-005** — Autoriser confirmer, refuser avec raison, demander correction.
- [ ] **COMM-006** — Définir lieux, heures, échéances de réponse et rappels.
- [ ] **COMM-007** — Historiser modification et annulation avec notifications.
- [ ] **COMM-008** — Préserver conversation privée équipe séparée des Admin/Boss.
- [ ] **COMM-009** — Gérer préférences notifications par catégorie et canal.
- [ ] **COMM-010** — Tester push via FCM/APNs et réception lorsque app fermée.
- [ ] **COMM-011** — Afficher état fournisseur réellement vérifié et erreurs d’envoi.
- [ ] **COMM-012** — Respecter consentement et refus de notification.

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

## P2 — Cartes Wallet et pointage QR (WALLET, 50 points)
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
- [ ] **DESIGN-014** — Empêcher tout visuel Construction dans l’édition Essentiel.

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

## P3 — QA, vrais appareils, déploiement et lancement (QA, 17 points)
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