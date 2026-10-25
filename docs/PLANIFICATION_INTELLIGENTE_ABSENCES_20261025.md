# PUNCH Essentiel Plus / Pro — planification intelligente et signalement d'absence

Décision fonctionnelle du 25 octobre 2026. **Statut : spécification validée, non développée dans ce lot documentaire.**
Document de référence unique pour les nouveaux écarts; ne pas recopier l'implémentation déjà présente. Éditions : Essentiel Plus (disponibilités avancées, calendrier manuel, quarts vacants/échanges); Essentiel Pro (générateur optimisé et remplacement automatique). Les droits finaux passent par le catalogue serveur/contrats, jamais par un drapeau client.

## Invariant non négociable

**Aucune recherche, offre ou attribution automatique de remplaçant sans un signalement d'absence explicite et confirmé par l'employé titulaire du quart concerné.** Un retard, aucun punch, un GPS absent, un quart commencé mais non pointé, une anomalie, une pause, une notification ignorée ou une prédiction ne sont jamais des déclencheurs de signalement d'absence. Ils peuvent conserver leurs alertes habituelles indépendantes. Le signalement d'absence est une action volontaire authentifiée, visible avec confirmation; elle devient un événement serveur audité, horodaté et idempotent. L'administrateur peut traiter manuellement les absences selon ses droits, mais cela ne doit pas déclencher par erreur le flux automatique réservé au signalement d'absence de l'employé.

Le signalement d'absence est attaché à un quart précis, jamais à toute la semaine par défaut. Respecter fenêtre autorisée, édition/entreprise, fuseau horaire, état du quart, autorisation et identité stable, y compris les salariés sans compte personnel (processus manuel distinct). Raison facultative/confidentielle : les remplaçants n'apprennent pas le motif. Un signalement d'absence ne modifie ni n'efface les punchs/heures déjà enregistrés, et ne ferme pas automatiquement une session en cours. Un quart déjà couvert ou annulé ne déclenche pas de nouvelles offres.

## Motifs d'absence — expérience employé et confidentialité

Au moment d'appuyer sur **« Signaler mon absence »** pour un quart, présenter clairement la date, le poste et les heures, puis proposer une liste de motifs prédéfinis, faciles à comprendre :
- **Maladie**
- **Enfant malade**
- **Rendez-vous médical**
- **Urgence familiale**
- **Obligation familiale ou garde**
- **Problème de transport**
- **Raison personnelle**
- **Autre** (champ de précision libre **facultatif**)
- **Je préfère ne pas préciser** (toujours offert pour protéger la vie privée)

Une note additionnelle peut être facultative pour tout motif. Ne jamais exiger de diagnostic, de justificatif médical ni de description intime pour simplement signaler son absence. La sélection ne peut pas automatiquement octroyer/refuser un congé payé, modifier les soldes de vacances, ni décider d'un motif réglementaire. Sauvegarder la catégorie et le texte libre avec le signalement du quart, autoriser la lecture seulement aux managers RH habilités, journaliser les accès sensibles et appliquer une conservation limitée/configurable. Les remplaçants ne reçoivent **que** les informations nécessaires sur le quart à couvrir et **jamais** la catégorie ou la note. L'admin peut voir **« Absence signalée »** immédiatement, sans exposer le détail du motif à tous les superviseurs. Après « Confirmer mon absence », et pas avant, l'événement serveur peut ouvrir la recherche de remplacement. Prévoir annulation avant confirmation et retours clairs après soumission.

## Principe UX : trois étapes, zéro configuration hebdomadaire répétée

- **Étape 1 — Besoins** : poste/qualification, établissement, département, nombre de personnes, horaires et modèles récurrents déjà chargés; vision des heures et quarts à couvrir. Prévoir les besoins variables/exceptions et les postes exclusifs sans doubler la couverture agrégée actuelle.
- **Étape 2 — Employés** : disponibilités habituelles récurrentes, exceptions par date/semaine prioritaires, souhait de volume horaire, minimum/maximum autorisé, type de poste/qualifications, préférence de jour/soir/week-end et consentement à recevoir des offres supplémentaires. Présentation claire Disponible / Indisponible / Inconnu, aucune disponibilité inventée. L'admin peut saisir pour le salarié sans téléphone; journal d'auteur et permissions. Les quarts déjà publiés restent inchangés lors d'une modification de disponibilité, mais le conflit est signalé.
- **Étape 3 — Générer, prévisualiser, publier** : brouillon automatique sur les quarts ouverts; nombre de quarts couverts, heures par personne, anomalies, explications des quarts non couverts et comparaison avant/après. Déplacement manuel simple, échange, verrouillage de quarts, régénération des seuls quarts déverrouillés. Publication volontaire, notifications et confirmations de lecture; jamais publier automatiquement un horaire global sans validation.

Démarrage ultra simple : **Mode Simple par défaut** (règles sûres préconfigurées, générer puis publier) et **Mode Avancé facultatif** (poids ancienneté, équité, heures voulues, coûts, nuits/week-ends et préférences). Première utilisation guidée en moins de quelques écrans. Mobile Android/iPhone, tablette et PC, libellés clairs FR/EN, pas de colonnes tronquées. Un salarié peut maintenir ses disponibilités une fois; modifier les exceptions, pas ressaisir chaque semaine. Rappels facultatifs de date limite de mise à jour (push interne en premier, canaux externes selon configuration); aucune exception après gel ne réécrit une affectation officielle.

## Ordre d'implémentation, dépendances et priorités

### P0 — Vérifier et réutiliser avant de coder

Auditer le dépôt et la base officiels, PR actives et migrations : scheduled_shifts, essential_availability, recurrent/rotating shifts, shift swaps, vacances/absences, quarts vacants/candidatures, entitlements, horaires nuit/DST, couverture Pro, qualifications et postes, notifications internes/push, horaires/versionnage et audit. Faire une matrice « déjà livré / partiel / manquant / tests / déployé ». Étendre les modèles existants et leur RLS; ni deuxième moteur de planning, ni duplicata d'identité, de table de quart, de système d'offres, ni de notifications. Conserver Construction.

### P1 — Bases communes Plus/Pro : disponibilités + besoin récurrent

1. Disponibilité hebdomadaire récurrente par jour et plage (éventuellement plusieurs plages), périodes d'effet, date de fin facultative et exceptions par date/semaine; priorité explicite : absence/congé approuvé et exception ponctuelle > modèle récurrent. Statut inconnu tant qu'aucune règle applicable; jamais supposer « disponible ».
2. Saisie depuis « Mes disponibilités » par le salarié, saisie déléguée par manager autorisé pour salarié sans compte, versionnement, historique, fuseau du site, validations de chevauchement, détection des conflits avec quarts publiés (sans les supprimer).
3. Souhait d'heures par semaine, contraintes min/max (contrat et règles locales), postes, qualifications/certifications valides et acceptation des propositions de quarts supplémentaires. Rappels de mise à jour configurables avant le gel.
4. Besoins de couverture récurrents par poste/département/site, exceptions semaine et horaires d'ouverture saisis; conserver et étendre modèles de quarts, couverture/qualification existants. Tableau « besoins / heures à attribuer / personnes admissibles ».

### P2 — Génération automatique Pro et UX en trois étapes

1. Construire moteur **déterministe et explicable** sans dépendance à une API IA payante, côté serveur ou composant fiable vérifié serveur, sur la base des règles métiers réelles. Refuser tout conflit dur : indisponibilité explicite, congé approuvé, qualification absente/expirée, double quart/chevauchement, repos minimum, maximum d'heures applicables, sites, autorisations et quarts verrouillés.
2. Optimiser selon priorités configurables : ancienneté, heures souhaitées, équilibre des heures, distribution des soirs/week-ends, préférences de poste, coût/budget (si connu), stabilité de l'horaire précédent. Paramètres par entreprise, valeurs initiales simples; calcul visible pour chaque proposition, journaliser version de règles et résultat. Ne jamais inventer un tarif, une règle légale ou une disponibilité.
3. Brouillon versionné, comparaison, modification tactile/glisser-déposer si accessible, régénération partielle, alertes et motifs de quarts non couverts; validation finale du Boss/Admin habilité seulement. Verrou de concurrence à la publication, audit et notification.
4. Simulateur local fictif mobilisable séparément pour démontrer les trois étapes; ne pas appeler « livré » tant que le vrai moteur connecté, la persistance et les contrôles serveur ne sont pas testés.

### P3 — Signalement d'absence et banque de remplaçants, à la demande EXPLICITE du salarié

1. Ajouter bouton « Signaler mon absence » sur un quart assigné dans Horaire (et éventuellement accueil), avec confirmation, horaire concerné, choix de motif prédéfini ou non précisé, note facultative privée et état « Absence signalée ». Vérifier permissions côté serveur et idempotence. Éviter les déclencheurs implicites (y compris no-show). Notifier l'admin du signalement d'absence.
2. À la **validation serveur du signalement d'absence**, créer une demande unique de couverture reliée au quart et extraire la banque de salariés volontaires/admissibles : site/département/poste, qualifications en cours, disponibilités avec exceptions, absence/congé, conflits/temps de repos, plafond d'heures, restrictions de rôle, préférence d'heures supplémentaires. Ordonnancement configurable (ancienneté, équité, heures, préférences); afficher les raisons d'inéligibilité sans exposer de renseignements privés.
3. Envoyer **des offres par vagues** avec délai de réponse configurable et élargissement si aucune réponse; notifications internes/push d'abord, SMS optionnel en dernier lorsque Twilio sera configuré. Déduplication, expirations, annulations et rappels; éviter le spam et respecter les préférences.
4. **Une seule attribution possible.** Première acceptation admissible réserve/gagne le quart selon mode configuré par Boss : (A) « approbation obligatoire » = un seul candidat réservé, approbation du responsable avant affectation; (B) « auto-remplacement » = première acceptation valide affectée immédiatement. Dans les deux cas, effectuer réservation/affectation par transaction SQL atomique, contrôle de version/tenant, verrouillage ou mise à jour conditionnelle, idempotence, revalidation d'éligibilité à l'instant de l'acceptation, refus « déjà attribué » pour les autres clics concurrents; annuler/fermer les autres offres et notifier chacun du résultat. Aucun employé ne peut s'auto-approuver hors mode autorisé.
5. Si aucune acceptation admissible avant échéance, alerter le gérant, proposer relance manuelle / nouvelle vague / ajuster la couverture; ne jamais affecter par défaut une personne indisponible. Si gagnant annule après attribution, relancer une nouvelle recherche uniquement via une action explicite de gestion ou une nouvelle procédure confirmée, en préservant l'historique. Si l'admin couvre manuellement, clôturer toutes les offres devenues obsolètes.
6. Gestion prudente des signalements d'absence sur quart déjà commencé : conserver les punchs existants et l'historique, traiter l'absence restante sous supervision, pas de fermeture automatique de temps en cours ni de réécriture de paie.

### P4 — Canaux, observabilité, recette

1. Réutiliser la file de notifications déjà présente, l'audit, les préférences, mécanismes d'expiration et déduplication. Une offre contient établissement, poste, date/heure, durée et délai, mais **jamais le motif de santé/personnel** du collègue absent.
2. Tester sur fixtures isolées : deux acceptations concurrentes => exactement un gagnant; réponses tardives; retry réseau, appareil fermé, expiration, double clic, changement de disponibilité/qualification, signalement répété, quart annulé/modifié, approbation requise ou automatique, RLS multi-entreprise, employés sans Auth, DST Québec, heures de nuit, période passée, dépassement heures/repos et sessions punch ouvertes. Tester « aucun punch », « retard » et « no show » => **aucune offre**.
3. Tests TypeScript, unitaires, DOM, SQL transactionnels, accessibilité mobile/tactile et parcours réel appareils avant validation; compte rendu distinct « développé / testé / déployé / intervention externe requise ».
4. SMS/Twilio **à la toute fin**, conformément à la décision actuelle; préparer interfaces/adaptateurs/test doubles sans SMS réel, sans exiger les clés au chat. Ni paiement réel ni message réel pendant recette. Un « envoyé » signifie confirmation fournisseur, pas simplement mise en file.
5. Rester dans Supabase officiel mlabstdxxwjdpfaxiwmg, réutiliser l'identité et la isolation RLS, ne toucher à aucune entreprise réelle par tests, conserver contrats, archives, historiques et PUNCH Construction.

## Critères d'acceptation produit (tous obligatoires)

- Un salarié règle sa semaine type puis une exception sans devoir tout ressaisir; l'admin voit les disponibilités et les besoins dans le même écran.
- L'admin crée un brouillon d'horaire Pro en trois étapes, revoit conflits/heures/couverture, ajuste et publie avec notification.
- Aucun remplacement automatique n'est créé pour un salarié absent au punch, en retard ou hors GPS.
- Un signalement d'absence explicite et confirmé sur un quart déclenche une seule recherche; la banque admissible reçoit les offres configurées; exactement une réservation ou affectation réussit malgré concurrence.
- Le mode « approbation obligatoire » n'affecte pas avant validation; le mode « auto-remplacement » attribue uniquement au gagnant admissible; historique et alertes visibles.
- Sans remplaçant, quart ouvert + notification manager, jamais d'attribution forcée.
- Les fonctions déjà présentes ne sont pas dupliquées; les protections des punchs, tenant, RLS, contrats, paie, archives et édition Construction restent intactes.

## Consigne de reprise

Ne pas commencer par recoder ce qui existe. Lire les sources officielles et les bilans les plus récents, comparer cette spécification à l'état technique du moment, intégrer les seuls écarts par petites PR avec tests et preuves, puis tenir la roadmap à jour. Ne pas confondre un prototype interactif local avec une fonctionnalité connectée livrée.