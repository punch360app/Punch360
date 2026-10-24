# PUNCH 360° — Essentiel : pointage mixte téléphone + tablette commune
**Statut : conception fonctionnelle et technique officielle — 24 octobre 2026.** Ce document décrit le comportement cible ; il ne certifie PAS qu'un mode kiosque est déjà développé ou livré.

## 0. Décision produit

**PUNCH Essentiel offre trois canaux utilisant les mêmes données et les mêmes règles métier :**
1. **Mobile individuel** Android/iPhone (application Expo/native, puis Web/PWA au besoin).
2. **Tablette commune** Android/iPad verrouillée en **mode borne de pointage**, avec identification individuelle et NIP secret.
3. **Consultation Web** des heures et horaires personnels ; pointage Web éventuel uniquement si le Boss l'autorise explicitement pour l'établissement.

**Mode mixte activable par le Boss ; défaut suggéré « Téléphone + tablette commune »**. Une entreprise peut désactiver un canal par site sans invalider les heures déjà enregistrées. Un utilisateur peut commencer sa journée sur une borne et la terminer sur son téléphone (ou inversement). Une seule session de travail active par personne et compagnie, jamais par appareil.

L'édition Construction est inchangée : le kiosque n'y apparaît pas automatiquement. Essentiel conserve son thème **blanc chaud #FAFBF8, vert sauge #779574, texte vert foncé #2F4935, contours #E1E8DB**, style zen et accessible. Aucun numéro de job, matériel ni plan de chantier dans les interfaces Essentiel.

## 1. Deux modes de pointage, un seul registre

| Action | Téléphone personnel | Borne tablette commune |
|---|---|---|
| Identification | Session personnelle Supabase Auth | Identifiant d'employé + NIP **à chaque action** ; pas de session générale d'un employé |
| Pointage IN / OUT | Bouton principal + confirmation | Boutons visibles **après identification** + confirmation |
| Pause non payée / Reprise | Bouton secondaire si session ouverte | Bouton secondaire si session ouverte |
| Heures / historique / corrections | Données personnelles et statut approbations | **Jamais** afficher l'historique ni les coordonnées privées d'un collègue |
| Lieu | GPS à la demande, vérifications selon politique | Établissement connu par appairage de l'appareil (pas de GPS réclamé à chaque salarié) |
| Réseau | Journal local existant à confirmer | Journal propre au périphérique, événements identifiés par salarié et appareil (voir §6) |
| Confirmation | Compteur actif mis à jour depuis les heures réelles | Réponse « Enregistré, HH:MM », puis déconnexion automatique de l'écran |
| Données | Dans une seule compagnie et avec RLS | Aucun accès au compte Auth d'un employé stocké sur la borne |

**Règle déterminante :** si une personne pointe IN sur son téléphone et OUT sur la tablette, l'heure de sortie clôt la même session. Une double tentative IN sur l'autre appareil doit afficher « Vous êtes déjà au travail depuis HH:MM » et proposer seulement les actions compatibles. L'état est rechargé du serveur avant chaque transaction en ligne. Le moteur refuse tout chevauchement et les réessais idempotents n'ajoutent aucune heure.

## 2. Employé — téléphone personnel

### Navigation fixe
**Punch · Heures · Horaire · Plus**, sans défilement de l'Accueil ; seules listes, historiques, détails et formulaires secondaires peuvent défiler.

### Accueil sage clair
- En-tête PUNCH Essentiel, date, photo et prénom, notification discrète.
- Établissement identifié sans afficher le numéro technique `ESSENTIEL`.
- Carte centrale aérée : état **Pas commencé / Au travail / En pause / Journée terminée**, chronomètre HH:MM:SS et action primaire contextuelle :
  - **Commencer ma journée** si aucune session active ;
  - **Terminer ma journée** si la journée est ouverte ;
  - en pause : **Reprendre le travail** en action prioritaire et « Terminer » disponible avec confirmation.
- Action secondaire **Prendre une pause non payée** ou **Reprendre**.
- Total net aujourd'hui, total net cette semaine, prochain quart, signal « Synchronisé / Sur cet appareil / En attente de vérification ».
- Si le salarié a pointé sur la tablette, l'application doit afficher cette session dès la synchronisation/réouverture ; pas de deuxième journée.

### Heures / Horaire / Plus
- Heures : total brut, pauses, net, historique et corrections en attente (sans appliquer directement les heures demandées).
- Horaire : prochain quart, changements de poste, demandes de congé selon autorisations.
- Plus : profil, contacts d'urgence, certifications si applicables, réglages, connexion/déconnexion et confidentialité.
- Aucun catalogue de chantier ni messagerie obligatoire pour Essentiel ; conserver les modules explicitement activés par la compagnie.

## 3. Tablette commune — interface « Borne de pointage »

### Écran verrouillé de bienvenue
- Logo **PUNCH Essentiel** ; nom de la compagnie et de l'établissement ; date et heure locale **America/Toronto**, adaptées si établissement dans un autre fuseau.
- Très grands boutons, contraste suffisant, mode paysage/portrait. Afficher « Pointeuse sécurisée » et « Réseau disponible / Hors ligne ».
- Saisie **Identifiant employé**, ou scan QR/NFC **uniquement comme raccourci vers l'identifiant** (jamais comme secret d'authentification).
- Pavé numérique accessible et champ **NIP de 6 chiffres** masqué ; possibilité de corriger/supprimer les chiffres ; aucune liste publique d'employés.
- Instructions courtes, langues adaptées, boutons utilisables avec des gants fins selon la taille d'écran.
- Aucune photo/document personnel avant identification. La borne ne donne pas accès à l'administration, aux messages ni aux exports.

### Écran après authentification
- « Bonjour, [Prénom] » ; état de la journée confirmé auprès du serveur ou marqué hors ligne.
- **Punch IN**, **Début pause**, **Fin pause**, **Punch OUT**, selon état. Un bouton primaire, actions secondaires peu nombreuses.
- Si une session existe sur téléphone, proposer les bonnes actions, **sans deuxième IN**.
- Afficher l'heure et un numéro de confirmation court **non sensible**.
- **Effacer automatiquement le nom et les détails à l'écran après 10–15 secondes d'inactivité** et immédiatement après confirmation. Bouton « Terminer / Déconnexion ».
- Ne jamais montrer l'historique détaillé, les contacts d'urgence, les données d'autres salariés ou les permissions d'admin.
- Après refus du NIP : message neutre « Identifiant ou NIP invalide », ne pas divulguer si l'employé existe.

### Exemple de disposition (wireframe, pas une maquette à publier)
```
┌──────────────────────────────────────┐
│  p  PUNCH Essentiel   08:02 • En ligne│
│       Atelier Principal              │
│                                      │
│       Bonjour, bienvenue             │
│    Identifiant employé [______]      │
│           NIP : ••••••               │
│      [1] [2] [3]                     │
│      [4] [5] [6]                     │
│      [7] [8] [9]                     │
│       [←] [0] [✓]                    │
│                                      │
│  Connexion protégée • Essentiel      │
└──────────────────────────────────────┘
┌──────── APRÈS VALIDATION ────────────┐
│  Bonjour, Alex                        │
│  Statut : Au travail depuis 7 h 03   │
│  [Début pause]      [PUNCH OUT]       │
│  Retour accueil automatique          │
└──────────────────────────────────────┘
```
Le navigateur mobile ne doit **jamais** posséder une clé d'administration permanente. Préférer l'application tablette native et son stockage matériel sécurisé pour les identifiants de borne ; la Web/PWA en borne gérée nécessite une analyse de risques spécifique.

## 4. Admin — console opérations

L'Admin **ne punche pas** : aucune entrée/sortie personnelle, même en mode borne.

Accueil **Essentiel Administration**, distinct de l'Employé :
- Présents, en pause, absents, retards, sorties oubliées.
- Aujourd'hui : événements réels, provenance **Téléphone / Borne n°**, statut de synchronisation.
- Demandes de corrections, pauses à valider, événements hors ligne, anomalies GPS, quarts manqués.
- Roster des employés et établissement ; aucune liste de NIP en clair.

Menu de gestion :
- **Employés** : matricule unique par compagnie, statut, rattachement établissement, génération/réinitialisation contrôlée de NIP avec remise sécurisée à l'employé. **Ne jamais pouvoir lire un NIP existant**.
- **Tablettes / Bornes** : associer une tablette à l'établissement via QR/code d'appairage temporaire délivré à l'Admin, nommer la borne « Réception », « Entrée usine », etc., voir dernière synchronisation, version et état; activer/désactiver ou révoquer à distance.
- **Règles de pointage** : téléphone seul, tablette seule ou mixte ; GPS téléphone requis/optionnel, précision/rayon ; pauses ; validation hors ligne.
- **Horaire et heures** : quarts jour/soir/nuit, approbation des corrections, fermeture de semaine et exports selon autorisation.
- **Audit** : chaque changement de mode, de borne et de NIP avec auteur, heure, motif. Aucune modification silencieuse du registre.

L'Admin ne voit pas les informations financières et ne peut pas contourner le verrou de gestion pour factures impayées.

## 5. Boss — direction et configuration

Interface propre à la direction : blanc chaud/sauge avec statistiques, **pas de gros bouton Punch IN**.

Accueil :
- Personnes au travail / en pause / absentes / en retard.
- Total hebdomadaire, heures supplémentaires à valider, coûts estimatifs de main-d'œuvre lorsque les taux sont configurés.
- Alertes sur bornes hors ligne, erreurs de NIP répétées, heures inhabituelles, demandes à approuver.
- Par établissement, département et plage horaire ; export CSV.

Gestion :
- Choisir les modes autorisés à l'inscription et par site.
- Créer/révoquer les bornes, donner le droit de configuration aux Admin désignés.
- Définir exigences de NIP, délais de déconnexion, rayon et règles de pauses, politique hors ligne.
- Créer et gérer les établissements (V1 : un établissement Essentiel ; multiétablissement = évolution commerciale).
- Abonnement, membres facturables, factures, droits et permissions des Admin.
- Rapports consolidés et journal des actions sensibles.

Un Boss/Admin n'a pas besoin d'un NIP employé pour gérer la borne ; en revanche il **ne peut jamais puncher au nom d'un employé sans procédure distincte et auditable**. Les corrections sont soumises à approbation ; pas d'usurpation de session.

## 6. Sécurité, autorisations et fonctionnement hors ligne

### Enregistrement et attestation d'une borne
1. Boss/Admin connecté crée une borne dans **Plus / Administration → Bornes de pointage**.
2. Le serveur émet un **code d'appairage aléatoire à usage unique et à durée très courte**, lié à la compagnie et à l'établissement.
3. L'app tablette dédiée saisit/scan le code, s'enregistre et obtient un identifiant d'appareil ainsi qu'un jeton de borne à permissions limitées.
4. **Jeton stocké dans Android Keystore / iOS Keychain** ; jamais dans le code source ou `localStorage` partagé sans protection.
5. Le serveur contrôle à chaque action : borne non révoquée, bonne compagnie/établissement, politique active et mode autorisé. Révocation immédiate possible.
6. Tout lien QR utilisé pour l'appairage expire et ne donne pas accès à un compte administrateur.

### NIP et protection contre abus
- Identifiant employé opaque et unique dans la compagnie ; NIP personnel **6 chiffres minimum**, configurable vers 8, jamais récupérable en texte clair.
- Vérification **côté serveur** dans une Edge Function protégée ; dérivation lente du secret (Argon2id ou équivalent) avec sel individuel, et secret serveur éventuel ; ne jamais utiliser de simples comparaisons SQL en clair.
- Limiter les tentatives par appareil, matricule et réseau ; exemple cible 5 échecs puis blocage temporaire de 15 minutes + alerte responsable ; seuils configurables.
- Réinitialisation de NIP avec identité vérifiée et audit ; jamais envoyer le NIP brut par notification ou courriel en clair. Première définition directement par l'employé ou au kiosque avec code d'enrôlement temporaire et présence contrôlée.
- Le compte Supabase `auth.users` d'un employé avec téléphone ne doit jamais être enregistré sur la tablette partagée.
- Les jetons kiosque donnent **seulement** accès à ses endpoints limités de pointage et d'état minimal, jamais à `company_members`, `emergency_contacts`, au stockage CCQ, aux messages ou aux données RH.

### Employés sans courriel ou smartphone
- Le Boss/Admin doit pouvoir créer un **dossier salarié interne** sans forcer un faux courriel.
- Prévoir une entité `company_workers` ou modèle équivalent avec identifiant salarié stable, `company_id`, établissement et lien Auth `user_id` **facultatif**.
- Un salarié qui active ultérieurement son téléphone relie son vrai compte au même dossier et au même historique, avec contrôle d'identité/permissions.
- **Attention : le schéma actuel couple encore l'employé à `auth.users` pour les punchs.** Planifier une migration contrôlée et des tests de compatibilité ; ne pas faire croire que le salarié sans compte Auth est déjà supporté.

### Événements et idempotence
- Un seul registre serveur partagé : employé × compagnie × sessions/pauses.
- Chaque événement inclut `event_id` UUID stable, `company_id`, `worker_id`, `device_id`, `mode`, action, heure locale déclarée si offline, heure reçue serveur, version de politique et indicateur de confiance.
- Le serveur valide état **OUT → IN → PAUSE → REPRISE → OUT** ; impossible de sortir ou prendre une pause sans session ouverte, d'entrer deux fois ou de reprendre sans pause.
- Serveur = horodatage autoritaire en ligne. Client = file durable et ordre causal pour offline, sous contrôle des conflits.
- Fonction transactionnelle sérialisée par salarié+compagnie ; mêmes protections qu'avec le journal de punch existant ; réessai avec même UUID = résultat identique.
- **Ne pas créer une deuxième table de punch indépendante pour la tablette.** Ajouter seulement métadonnées de canal/appareil au registre partagé.

### Mode hors ligne sur une tablette partagée
- Avant toute coupure, la tablette doit avoir été appairée et avoir synchronisé une liste **strictement nécessaire** d'identifiants autorisés, protégée au repos. Ne jamais conserver une liste visible de salariés ou des NIP en clair.
- Vérification d'identité hors ligne uniquement via une stratégie explicitement conçue et auditée (vérificateurs individuels protégés par coffre matériel, durée d'autorisation courte) ; **ne pas prétendre une authentification forte hors ligne si elle n'est pas vérifiable**.
- Temps sauvegardés localement, événements ordonnés et marqués **« Enregistré sur cette tablette — non synchronisé »**.
- Rétablissement réseau : envoi idempotent dans l'ordre, contrôle de la bonne compagnie et de l'appareil, résolution des conflits ; les événements hors ligne douteux requièrent une validation Admin/Boss.
- Si les preuves d'identité hors ligne ont expiré (suggestion : 24 h depuis la dernière synchronisation) ou si le périphérique n'est pas enregistré, désactiver le punch hors ligne plutôt que de créer de fausses heures officielles.
- Perte/vol de tablette : révocation, effacement de la session de borne et incident de synchronisation à traiter, sans effacer les événements déjà validés côté serveur.

## 7. Règles commerciales
- Le forfait de base Essentiel proposé reste **19 $ CA/mois pour 5 membres actifs, puis +3 $ CA/membre** ; ne pas modifier sans validation commerciale.
- **Seuls les êtres humains actifs sont des places payantes** (Employé, Chef, Admin, Boss). Une tablette appairée n'est jamais une place employé payante.
- Proposition : inclure **une borne par établissement** dans Essentiel ; nombre supplémentaire configurable par Super Admin, **sans supplément inventé maintenant**.
- Les invitations smartphone restent soumises au paiement confirmé; le mode tablette seul doit suivre les mêmes contrôles de places et de statut salarié.
- En statut de paiement `grace` : accès complet. En `restricted` : **les employés existants doivent toujours pouvoir faire IN, PAUSE, REPRISE, OUT sur mobile ET sur les bornes déjà autorisées**, consulter leurs heures/export personnels ; Admin/Boss voient leur portail de paiement et les registres nécessaires mais ne modifient pas les opérations. Ne jamais désactiver les jetons de borne uniquement pour impayé.
- Un appareil désactivé pour motif de sécurité ne doit jamais rester utilisable, même si les employés ont le droit de pointer ailleurs.
- Pas de matériel/commandes/plans Construction dans Essentiel.

## 8. Structure de données proposée (à migrer après audit)

| Objet | But |
|---|---|
| `company_workers` | Identité métier stable, y compris personnes sans Auth |
| `worksites` | Établissement Essentiel et fuseau horaire ; V1 un seul, évolutif |
| `time_devices` | Tablette appairée, type, site, statut, dernière synchro, rotation/révocation |
| `device_enrollment_codes` | Codes uniques à expiration courte, stockés sous forme hachée |
| `employee_pin_credentials` | Vérificateurs de NIP forts, historique rotations, blocages |
| `time_event_receipts` | Adapter le journal existant à `worker_id` + canal + appareil, sans dupliquer sessions |
| `punch_sessions`, `punch_breaks` | Registre commun déjà existant, à rendre compatible `worker_id` |
| `audit_events` | Appairage, révocation, reset NIP, tentatives suspectes et corrections |

**Ne pas exécuter cette migration depuis un client Web ou en contournant les RLS.** Le serveur doit gérer les créations d'appareils, identités et secrets avec droits minimaux. Préparer migrations avec retour arrière, vérifications RLS et préservation des heures existantes.

## 9. Parcours d'activation

1. Boss sélectionne **PUNCH Essentiel** pendant son inscription ; paie son forfait (ou environnement de test explicitement autorisé).
2. Boss crée son établissement, ses employés (avec ou sans téléphone), horaires, politiques de pause et de localisation.
3. Dans **Gestion → Bornes de pointage**, il choisit « Ajouter une tablette ».
4. La tablette se connecte en mode borne, saisit un code d'appairage et reçoit uniquement son identité appareil.
5. L'Admin aide les salariés à activer un NIP avec une procédure de vérification, sans le voir.
6. Un employé peut ensuite utiliser son téléphone, la tablette, ou les deux, selon le réglage de l'établissement.
7. Le Boss voit « Bornes actives », dernier contact, erreurs de synchronisation et heures à approuver.
8. En restriction de paiement, la borne existante poursuit les punchs ; les modifications administratives attendent le règlement.

## 10. Critères d'acceptation incontournables

- [ ] Borne appairée à une seule compagnie / site ; jamais à un autre tenant.
- [ ] Un invité ou autre compagnie ne peut pas enregistrer de borne.
- [ ] Personne sans compte Auth peut avoir une identité métier et un NIP, **sans faux email**.
- [ ] NIP inexistant/non vérifié/5 échecs : accès refusé, message neutre, journal audit.
- [ ] Les membres n'ont pas accès aux NIP ni aux secrets d'appareil.
- [ ] IN téléphone → OUT tablette = une session et une durée exactes.
- [ ] IN tablette → PAUSE tablette → REPRISE téléphone → OUT téléphone = même journée, pauses déduites une seule fois.
- [ ] Double IN simultané : seul un succès, pas de chevauchement.
- [ ] Réessai avec même `event_id` après perte de réseau : même reçu, aucune deuxième opération.
- [ ] Tablette perdue/révoquée : plus aucun événement accepté en ligne.
- [ ] Hors ligne tablette : état **provisoire** toujours identifiable; refus si preuves expirées.
- [ ] La tablette revient automatiquement à l'accueil et oublie les données de l'employé.
- [ ] Ni historique, ni autres salariés, ni contact d'urgence sur tablette.
- [ ] Admin n'a pas d'option de punch personnel et ne voit jamais les NIP.
- [ ] Boss voit santé/état des bornes, pas les secrets.
- [ ] Multientreprise : salariés, appareils et pointages restent isolés.
- [ ] Même en `restricted`, salarié existant peut toujours pointer mobile/tablette, sauf borne révoquée.
- [ ] Export CSV brut/pauses/net cohérent quelle que soit la provenance.
- [ ] Parcours UI Android/iPhone/tablette portrait & paysage accessible et sans défilement sur les écrans principaux.
- [ ] Aucune régression du moteur Essentiel ou des interfaces Construction.

## 11. Ordre de développement recommandé
1. **P0 — Sécurité et identité** : schéma salarié sans Auth, appairage, rôle borne, PIN, RLS, audit et tests interentreprise ; interdire toute commande d'administration depuis la borne.
2. **P1 — Moteur unifié** : reprendre `sync_punch_event` et `sync_break_event` avec identifiants de salariés, canal, périphérique et idempotence ; tests des transferts téléphone ↔ borne.
3. **P1 — Écrans** : borne native sage + « Bornes de pointage » Admin/Boss, synchronisation du statut côté employé téléphone.
4. **P1 — Défaillances** : coupure réseau, confinement, rejet NIP, vol, horloge locale fausse, DST et passage minuit.
5. **P2 — Compléments** : badges/NFC, QR matricule, multiétablissements, éventuellement calcul des primes de quarts, langues.

## 12. Accès personnel facultatif à l'horaire lorsque la compagnie choisit l'iPad commun — NOUVELLE DÉCISION OFFICIELLE

**L'utilisation de la borne partagée n'empêche JAMAIS un employé d'ouvrir son propre compte mobile.** L'entreprise peut choisir **« Pointage uniquement sur iPad »** et permettre simultanément **« Consultation personnelle des horaires et heures sur l'app »**. L'accès de consultation est inclus pour tout salarié actif, sans imposer un smartphone à ceux qui n'en ont pas.

### Parcours employé
1. Boss/Admin crée d'abord un **dossier salarié interne** dans la compagnie (matricule, prénom/nom, rôle Employé, établissement, département, horaires, autorisations, statut payant selon forfait). Ce dossier reste utilisable en kiosque même sans adresse courriel.
2. L'Admin peut activer un **NIP secret** individuel pour pointer sur l'iPad sécurisé, sans voir le NIP une fois créé.
3. Lorsque l'employé veut accéder à son horaire sur téléphone, Boss/Admin déclenche **Inviter sur l'application** depuis ce dossier, via SMS ou courriel, ou imprime un QR d'activation temporaire. Invitation **liée cryptographiquement au dossier `worker_id` et à `company_id`**, aléatoire, à usage unique, à courte durée configurable. **Un QR/matricule seul ne doit jamais permettre de revendiquer un salarié.**
4. L'employé installe PUNCH Essentiel Android/iPhone ou ouvre la PWA et se connecte/crée un compte personnel via Google, Apple ou courriel. En cas de création, confirmer la propriété du canal d'invitation. L'invitation est ensuite échangée côté serveur contre le rattachement **de son seul `auth.uid()` au dossier salarié existant**, après vérification anti-rejeu, statut de la compagnie, appartenance et absence de liaison à un autre compte.
5. La création du compte personnel **ne crée ni un second salarié ni une seconde place facturable**, ne réinitialise ni le NIP, ni les horaires, ni le pointage kiosque, et n'accorde jamais un rôle Boss/Admin. Si le dossier est déjà lié à un autre compte, refuser le rattachement et déclencher une procédure de récupération vérifiée.
6. L'employé retrouve ses horaires, ses heures personnelles y compris celles enregistrées sur iPad, ses demandes de congé et ses notifications. Il reste libre de pointer sur iPad même après activation de l'application.
7. Si l'Admin modifie, publie ou annule un quart, l'application synchronise l'horaire, identifie la version/date et prévient l'employé si les notifications sont activées. Accusé de lecture facultatif selon la politique RH.

### Droits distincts du canal de pointage
Le Boss configure deux options indépendantes, par établissement et éventuellement par salarié :

| Réglage | iPad commun | App personnelle |
| --- | --- | --- |
| **Mode A — iPad seulement (avec app personnelle)** | PUNCH IN/PAUSE/REPRISE/OUT | Horaire, heures, demandes, notifications, **aucun punch mobile** |
| **Mode B — téléphone + iPad** | PUNCH IN/PAUSE/REPRISE/OUT | Les mêmes actions de punch autorisées + espace personnel |
| **Mode C — téléphone seulement** | Borne désactivée pour le salarié | Punch mobile + espace personnel |

**Défaut proposé si l'entreprise choisit iPad commun : Mode A + consultation personnelle activée.** Un accès personnel ne doit PAS activer le pointage sur téléphone par accident. Le verrouillage doit être contrôlé **côté serveur**, pas simplement par l'absence du bouton.

### Interface employé personnel (design Essentiel)
- Barre fixe **Punch · Heures · Horaire · Plus** et choix parmi les **20 thèmes Essentiel** personnels ; la tablette commune conserve son thème uniforme d'entreprise.
- Si le pointage téléphone est désactivé, onglet **Punch** : carte explicite **« Pointage sur la tablette de l'entreprise »**, état aujourd'hui mis à jour depuis le serveur, dernière entrée/sortie, sans bouton de pointage mobile. Il est possible de mettre l'onglet **Horaire** en premier au démarrage dans ce mode, sans casser la structure à 4 onglets.
- **Horaire** : vue semaine et mois, prochain quart, début/fin, établissement, département/poste, notes de l'Admin, changements récents, disponibilités, proposition d'échange de quart à soumettre (après implémentation du workflow), congés approuvés. Aucun horaire d'un collègue non autorisé.
- **Heures** : historique personnel brut, pauses, net, statut synchronisé/à vérifier et demandes de correction ; heures de l'iPad et du téléphone réunies.
- **Plus** : profil, disponibilité, vacances/congés, notifications, Apparence, aide, sécurité, connexion/déconnexion.
- L'interface personnalisée de l'employé peut être **lecture seule pour l'horaire**, tout en permettant les demandes de congé/échange sans altérer directement le calendrier publié.

### Interfaces Admin et Boss
- **Admin → Employés → [salarié]** : état `Borne seulement / Compte personnel invité / Compte personnel activé`, méthode d'invitation, relance, révocation des accès personnels, réinitialisation sécurisée, date du dernier accès (sans divulguer secrets et contenus privés).
- **Admin → Horaires** : publication de quarts, modifications, notifications ciblées, conflits, demandes de disponibilités et échanges.
- **Boss → Paramètres Essentiel → Modes de pointage** : cases indépendantes **« Autoriser le pointage sur tablette »**, **« Autoriser le pointage sur téléphone »**, **« Permettre l'accès personnel à l'horaire »** (proposer cette dernière activée). Contrôles par site, avec journal d'audit.
- **Boss → Utilisateurs et places** : chaque salarié actif compte **une** place, même si NIP borne + compte personnel. Inviter un compte rattaché à une personne existante n'est **pas un ajout de siège** ; réserver une place uniquement lors de la création d'un nouveau salarié actif non déjà compté.

### Confidentialité, invitations et récupération
- Les données de paie, profil, horaire, contacts, heures ne sont consultables que par le salarié lui-même et les responsables autorisés ; la borne ne peut jamais ouvrir l'app personnelle d'un employé.
- L'employé ne rejoint jamais librement une compagnie en devinant un matricule, une adresse courriel ou un code affiché sur la tablette.
- Ne pas permettre le rattachement libre par correspondance d'e-mail, par nom, ou par simple NIP. Éviter le détournement d'identité d'un salarié existant.
- Une invitation non acceptée expire et peut être renouvelée par l'Admin ; cela n'ouvre jamais un deuxième siège pour ce salarié déjà actif.
- Si le compte téléphone est perdu ou compromis, récupération + nouveau rattachement après vérification forte par responsable autorisé, révocation de l'ancien accès et journalisation.
- En cas de non-paiement après sursis, les salariés actifs conservent les punchs sur iPad, la consultation de leurs horaires/heures et leurs exports personnels selon les règles commerciales déjà décidées.

### Critères d'acceptation supplémentaires
- [ ] Une compagnie **iPad seulement** peut inviter un salarié à consulter l'horaire sur son téléphone, sans lui donner la capacité de Punch IN/OUT mobile.
- [ ] Un salarié sans courriel reste capable de pointer sur iPad, sans invitation personnelle obligatoire.
- [ ] L'activation Google/Apple/email revendique **un dossier déjà présent** ; pas de salarié dupliqué, pas de nouvelle place facturable.
- [ ] Un employé voit les mêmes heures sur iPad (ses confirmations) et son téléphone (son historique), sans exposer les heures de collègues sur la borne.
- [ ] Modification d'horaire et nouvelle affectation apparaissent dans l'app après synchronisation, avec notification si activée.
- [ ] Rejeu d'invitation, code expiré, compte personnel déjà lié, autre compagnie, matricule deviné et tentative de promotion de rôle : refus et audit.
- [ ] La désactivation du punch mobile est imposée par serveur même si l'employé tente d'appeler l'API directement.
- [ ] Aucune perte d'heures ou d'horaire lors de la création, révocation et récupération du compte personnel.

**Statut : conception validée, pas encore développée.** Modèle salarié `worker_id` et invitations d'activation sont à développer et tester avant de revendiquer la compatibilité kiosque + app personnelle.

## 13. Ce qui est réellement livré au 24 octobre 2026
**Déjà dans le dépôt** : édition Essentiel, écran employé sage, création de compagnie/établissement technique, journal mobile hors ligne, punch IN/OUT et pauses, heures, horaires et exports partiels, rôles Admin/Boss différents, politique d'impayé, isolation RLS.

**NOUVELLEMENT VALIDÉ DANS CE DOCUMENT SEULEMENT** : mode mixte, appareil partagé, NIP, indépendance des identités métier, création/révocation de bornes, interface Borne, mode hors ligne borne, jointure sessions téléphone/tablette et écrans Admin/Boss correspondants.

**Aucun prototype kiosque n'est déclaré fonctionnel sans migrations, endpoints, UI et tests.**

## 13. Compte personnel facultatif même lorsque l'entreprise choisit une tablette commune

**Décision officielle : le choix d'une tablette commune ne prive jamais un employé de son compte personnel PUNCH Essentiel.** Le Boss peut configurer « Pointage autorisé sur tablette seulement » tout en laissant **Consultation personnelle sur téléphone** activée. La création de compte personnel est **facultative pour l'employé**, possible à l'embauche ou plus tard.

### Parcours Employé
1. Le Boss/Admin crée d'abord **un seul dossier salarié** (matricule, compagnie, établissement, horaire et droits, éventuellement sans email et sans téléphone). Le salarié pointe immédiatement à la borne avec son identifiant et NIP après enrôlement sécurisé.
2. L'entreprise lui fournit une **invitation personnelle** via courriel ou SMS, ou un **code d'activation/QR temporaire à usage unique** remis en personne. Le QR est un moyen d'ouvrir le flux et **ne constitue pas à lui seul une preuve d'identité** : exiger vérification additionnelle adaptée et protection anti-usurpation.
3. L'employé télécharge PUNCH Essentiel (Android/iPhone ou site Web), crée son compte par courriel/mot de passe ou Google/Apple, puis **confirme son adresse/identité**. Un code d'association, lié au `worker_id` existant, à la compagnie, à une durée d'expiration courte et à un nombre de tentatives limité, établit le lien. **Jamais de rapprochement automatique par nom, adresse courriel saisie ou matricule seul.**
4. L'identité Auth se rattache au dossier salarié initial et **réutilise les heures, pauses, horaires, demandes et affectations déjà enregistrés à l'iPad** ; aucun deuxième dossier, aucune seconde place facturable.
5. L'employé choisit **un des 20 thèmes PUNCH Essentiel**, synchronisé dans son profil individuel. L'iPad commun conserve le thème de borne choisi par la compagnie et n'affiche pas le thème d'un salarié.
6. L'app personnelle affiche : **Horaire et prochain quart, Mes heures/historique, Pauses, Congés/absences et demandes, Modifications d'horaire, Notifications, Plus/profil**. Les informations visibles sont **strictement personnelles**.
7. Le bouton Punch mobile est activé **seulement si le Boss l'autorise** pour cet employé/établissement ; sinon afficher « Pointage sur la tablette de l'entreprise » avec un **accès en lecture seule à l'horaire et aux heures**. Ne pas forcer l'installation du téléphone pour pointer à la borne.
8. Le compte personnel peut être créé après des semaines ou mois de pointage borne ; les heures restent attachées au **même salarié stable** et restent consultables depuis son activation.

### Parcours Boss et Admin
- Réglage Essentiel par établissement : **Canal de pointage = tablette / mobile / mixte** ; option distincte et indépendante **Accès personnel à l'horaire et aux heures = autorisé (défaut)**.
- Dans Employés : `Compte mobile : non activé / invitation envoyée / activé / désactivé`, bouton **Inviter à créer son compte**, **Renvoyer l'invitation** (sans invalider des heures), **Révoquer l'accès personnel** avec journal d'audit.
- L'Admin/Boss peut associer un compte seulement via procédure d'enrôlement vérifiée : ne peut pas connaître le mot de passe, lier un compte tiers arbitraire ou agir en tant que salarié.
- Les modifications d'horaires et congés déclenchent une notification à l'app personnelle quand elle est activée ; sans app, conserver l'information sur l'horaire accessible au kiosque selon les politiques de confidentialité.
- Un salarié existant peut choisir de **ne jamais créer de compte** sans conséquence sur l'accès à la borne et ses heures. La suppression/désactivation de son accès personnel ne supprime pas ses punchs ni son dossier métier.
- **Facturation :** un salarié actif = **une place payante**, qu'il utilise la borne seule ou la borne + l'app. L'iPad n'est pas un salarié facturable. L'activation du compte personnel ne déclenche aucun supplément de places.

### Sécurité et critères de recette
- Utiliser un `worker_id` immuable, facultativement relié à `auth_user_id` après activation ; l'application personnelle ne doit pas créer automatiquement une nouvelle appartenance Boss ni un nouveau salarié.
- Un code d'activation expire et ne peut être consommé qu'une fois. Tentatives limitées et lien vérifié serveur ; ne pas exposer le NIP de borne dans le processus de connexion personnel. NIP ≠ mot de passe Supabase.
- Si le salarié possède déjà un compte Auth, lui permettre de se connecter puis **rejoindre le dossier métier existant après invitation vérifiée**, plutôt que d'en créer un doublon.
- Un compte personnel ne voit que **son** horaire, ses heures, ses congés et ses messages autorisés, jamais ceux d'un autre salarié, même avec connaissance d'un matricule.
- Tester « 3 semaines de pointage tablette → activation compte → affichage de toutes les anciennes heures », « compte lié à mauvais matricule » (rejet), « employé sans email » (borne toujours accessible), « mobile en lecture seule », « suppression d'accès personnel sans suppression heures » et « aucun siège supplémentaire après activation ».
- Le verrou de gestion pour non-paiement ne doit pas retirer au salarié actif l'accès à son historique personnel ni bloquer la continuité du punch sur tablette.

**Implémentation :** ceci est une exigence officielle à réaliser après la migration contrôlée `company_workers`/identité métier prévue plus haut ; ni l'enrôlement à partir d'une invitation ni la liaison compte → salarié sans Auth ne sont encore déclarés livrés.



## 14. Lien direct vers la PWA d'appairage depuis la fiche d'une borne — DÉCISION OFFICIELLE (24 octobre 2026)

### Objectif
Depuis **PUNCH Essentiel → Administration/Boss → Bornes de pointage → [Borne]**, le Boss doit trouver immédiatement comment ouvrir la pointeuse sur son iPad ou sa tablette Android. Aucun besoin de rechercher ni de composer manuellement l'adresse.

**Adresse publique cible de la page borne :** `https://punch360app.github.io/Punch360/kiosk.html` (fichier source actuel `web/live/kiosk.html`, publié à la racine du site via `.github/workflows/deploy-web.yml`). Vérifier la disponibilité effective sur GitHub Pages avant de déclarer le parcours livré.

### Interface Boss — fiche de borne
- Afficher l'état **À appairer / Active / Hors ligne / Révoquée**, le nom de la borne et l'établissement.
- Ajouter le bouton principal **« Ouvrir la pointeuse »**, ouvrant l'URL HTTPS publique **statique** de `kiosk.html` (nouvel onglet si approprié).
- Ajouter **« Copier le lien »**, copiant uniquement cette même URL publique et sans secret.
- Facultatif : QR code qui encode **uniquement l'URL publique statique** ; aucun code, aucune donnée d'identité, aucun jeton.
- Le **code temporaire d'appairage** est généré séparément par le serveur, présenté uniquement dans la vue sécurisée du Boss autorisé, avec possibilité de le régénérer et de le saisir **manuellement sur la tablette**.
- Un lien vers la PWA peut être partagé; il ne prouve pas le droit d'appairer. L'ouverture de la page n'authentifie pas un Boss et n'enrôle jamais automatiquement la borne.

### Interdictions de sécurité explicites
- **Ne jamais transmettre le code d'appairage dans l'URL**, y compris chemin, paramètres de requête (`?code=`), fragment (`#...`), lien profond, raccourci PWA, QR ou outil d'analyse.
- Ne jamais inclure les jetons de borne, jetons Auth, identifiants Admin/Boss, session ou secrets dans les liens de navigation, prévisualisations ou journaux de clic.
- Le code est saisi dans la page borne puis vérifié **côté serveur**, usage unique, lié à la compagnie et à l'établissement, expiration cible **10 minutes**; invalider après usage et journaliser l'appairage.
- La page publique non appairée ne présente aucun registre d'heures, aucune liste de salariés et aucune console de gestion.
- Ne pas ajouter de stockage de code d'appairage dans le navigateur de la tablette. **Seule une autorisation technique limitée, révocable et protégée de l'appareil** peut persister après l'appairage.

### Parcours recommandé — PWA maintenant, application native ensuite
1. Le Boss crée une borne et ouvre sa fiche.
2. Il clique sur **« Ouvrir la pointeuse »** ou copie le lien vers l'iPad.
3. Sur l'iPad, il ouvre `kiosk.html` dans Safari, puis peut choisir **Sur l'écran d'accueil** pour installer la PWA. Sur Android, utiliser le navigateur compatible.
4. Le Boss obtient séparément un code temporaire depuis sa session de gestion et le saisit dans la page d'appairage de la tablette.
5. Le serveur lie l'appareil à **une seule** compagnie/établissement. La tablette revient à l'accueil de pointage; nul besoin de réappairer chaque jour.
6. Les salariés saisissent chaque fois leur matricule et NIP. Aucun identifiant personnel prérempli. Après pointage, retour automatique à l'accueil; **10 secondes d'inactivité par défaut**, réglables par l'Admin autorisé à 5/10/15/30/60 secondes.
7. Les responsables peuvent accéder à l'Administration sur une borne qui l'autorise, avec leur **compte personnel** et jamais leur simple NIP; expiration administrative par défaut **5 minutes** et retour à la pointeuse. Cet accès peut être interdit par le Boss sur une borne donnée.
8. Les salariés peuvent librement quitter la PWA et utiliser d'autres applications; aucun mode kiosque OS verrouillé n'est imposé. À la réouverture, les sessions personnelles ne sont jamais restaurées; seul le statut technique appairé persiste.
9. Prévoir une future app native iPad/Android **sans refaire le backend, les identités salariés, l'appairage ni le registre de temps**.

### Critères de recette
- [ ] La fiche Boss affiche un lien explicite et ses actions **Ouvrir / Copier**, en utilisant l'URL publique statique réellement publiée.
- [ ] L'URL ouverte, copiée et intégrée au QR ne contient **aucun code temporaire, jeton ou secret**, même dans le fragment.
- [ ] Une personne possédant seulement le lien ne peut pas appairer de borne sans code temporaire valide obtenu séparément.
- [ ] Code invalide, expiré, déjà consommé, autre compagnie ou borne révoquée : refus côté serveur.
- [ ] Ouvrir la page sur un nouvel iPad affiche **Appairer cette borne** sans révéler des données internes.
- [ ] Une borne déjà appairée s'ouvre directement sur l'accueil employé avec champs vides, sans nouvelle invitation d'appairage.
- [ ] 10 secondes d'inactivité après une identification effacent matricule, NIP et état employé; **aucune session personnelle restaurée** après fermeture/réouverture.
- [ ] Aucun changement du parcours PUNCH Construction.
- [ ] Tests à réaliser sur iPad Safari/PWA, tablette Android et PC; ne pas déclarer une page PWA pleinement installable si manifeste/service worker et installation n'ont pas été vérifiés.

**Statut : exigence ajoutée au cahier des charges.** Le fichier `web/live/kiosk.html` existe, mais les boutons **Ouvrir / Copier** de la fiche et la validation du déploiement effectif restent à vérifier ou implémenter; cette modification documentaire ne constitue pas leur livraison.
