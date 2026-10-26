# PUNCH 360° — Guide de démarrage pour collaborateur et ChatGPT Work
**Mis à jour : 25 octobre 2026 | dépôt officiel : `punch360app/Punch360`**

> **COMMENCER ICI.** Source unique des exigences : [Prompt maître, 542 points](prompt-board/MASTER_PROMPT_20261025.md). Ce guide explique comment reprendre PUNCH sans repartir de zéro ni endommager les données réelles. Il ne certifie pas la fin du développement. Vérifier le dernier commit, les documents et les tests **avant** d'affirmer qu'une fonction est livrée.

## 1. Accès nécessaires (chaque collaborateur utilise ses propres comptes)

- **GitHub :** https://github.com/punch360app/Punch360 — accepter l'invitation de collaborateur puis configurer, dans son propre ChatGPT Work, la connexion GitHub autorisée au dépôt. Ne jamais se connecter avec le mot de passe du propriétaire.
- **Supabase :** projet `mlabstdxxwjdpfaxiwmg` — https://supabase.com/dashboard/project/mlabstdxxwjdpfaxiwmg ; accepter l'invitation **Developer** reçue par courriel, puis connecter **son propre** accès Supabase à Work. Vérifier que le projet affiché est exactement celui-ci avant toute requête ou migration.
- **Site public :** https://punch360app.github.io/Punch360/
- **Pointeuse commune Essentiel (PWA Web) :** https://punch360app.github.io/Punch360/kiosk.html
- **Compte propriétaire de la plateforme :** `punch360app@gmail.com` (référence d'administration seulement, **ne pas utiliser ou partager ses identifiants**).

Les invitations peuvent être en attente tant que le collaborateur ne les a pas acceptées. Être invité dans Supabase/GitHub n'installe pas automatiquement les connexions dans **son** Work : il doit autoriser les deux applications depuis son propre compte ChatGPT.

**Rôles et sécurité :** accès GitHub avec droits d'écriture pour le code ; Supabase Developer plutôt que Owner. Ne pas demander d'accès Super Admin de production pour coder. Ne jamais échanger mot de passe, token, `service_role`, clé Stripe, secret Twilio, certificat ou code MFA dans les chats, commits ou captures. Les secrets restent dans les gestionnaires de secrets côté serveur.

## 2. Comprendre le produit en 60 secondes

**Deux éditions commerciales distinctes, un moteur partagé et un Super Admin central :**

| Produit | Cible et interface | Règle absolue |
| --- | --- | --- |
| **PUNCH Essentiel** | Bureaux, commerces, restaurants, manufactures ; design épuré blanc chaud et vert sauge ; employé : **Punch · Heures · Horaire · Plus** | **Aucun** job, plan de chantier, commande de matériel, météo de chantier ou visuel Construction dans Essentiel |
| **PUNCH Construction** | Chantiers et équipes mobiles ; jobs, transferts, GPS, plans, commandes et messagerie selon les modules autorisés | Conserver ses fonctions, règles de sécurité, interface et prix indépendants |
| **Super Admin PUNCH 360°** | Console unique pour superviser les deux éditions (clients, abonnements, forfaits, paiements, support) | Authentification forte, rôle plateforme vérifié côté serveur, pas d'accès privé injustifié |

**Essentiel, forfaits décidés :** 19 / 39 / 69 $ CA par mois ; cinq personnes comprises ; +3 / +4 / +5 $ par personne supplémentaire par mois ; remise annuelle 15 % ; bornes comprises 1 / 3 / illimitées (usage raisonnable). Les tarifs doivent venir du catalogue serveur. **Ne pas remplacer les prix Construction par ceux d'Essentiel.** Une borne n'est pas une place humaine facturable.

## 3. Où regarder dans le dépôt

| Emplacement | Utilité |
| --- | --- |
| `README.md` | Vue générale ; certaines sections historiques sont antérieures aux livraisons récentes |
| `docs/IMPLEMENTATION_STATUS.md` | État technique général ; lire aussi ses liens d'actualisation en tête |
| `docs/ESSENTIAL_BILLING_20261024.md` | État récent de Stripe, PWA borne, liens Ouvrir/Copier, minuterie et limites de validation |
| `docs/prompt-board/MASTER_PROMPT_20261025.md` | **Source unique des 542 exigences** après consolidation de l'ancien giga-prompt |
| `docs/ESSENTIAL_PLANNING_20261024.md` | Horaires, rotations, quarts vacants, candidatures, superviseurs, couverture |
| `src/messages/MessagesScreen.tsx` | Moteur de conversations à **réutiliser et sécuriser** pour Essentiel Plus/Pro; onglet bas Messages sur ces deux forfaits, sans toucher aux salons privés Construction |
| `docs/PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md` | Nouveaux écarts priorisés : disponibilités récurrentes, optimiseur Pro en trois étapes, signalement d'absence volontaire avec motifs prédéfinis confidentiels et remplaçant unique; aucun no-show automatique, SMS dernier |
| `docs/ESSENTIAL_THEMES_20261024.md` | Thèmes personnels **11–20** présents, autres thèmes en attente |
| `docs/ESSENTIAL_PROGRESS_20261024.md` | Identités salariés, appairage, NIP, pointage téléphone/borne, tests et limitations historiques |
| `docs/ESSENTIAL_MIXED_PUNCH_SPEC.md` | Spécification des bornes ; **section 14 : lien public de PWA sans code dans l'URL** |
| `docs/SPEC_COMPLETE.md`, `docs/REQUIREMENTS_AUDIT.md`, `docs/BILLING.md` | Exigences globales et constats ; distinguer historique et état récent |
| `web/live/` | Application Web publiée via GitHub Pages ; `app.js`, `kiosk.html`, `kiosk.js`, `kiosk.css`, `kiosk.webmanifest`, `sw.js` |
| `src/` | Application Expo / React Native et modules partagés |
| `supabase/` | Migrations, fonctions Edge et scripts SQL de validation |
| `tests/` | Tests Node/DOM et régressions, dont `tests/kiosk-ui.test.mjs` |
| `.github/workflows/deploy-web.yml` | Publication de `web/live/` sur GitHub Pages depuis `main` |

Si le fichier a bougé, **le rechercher dans le dépôt**. Ne pas inventer un chemin ou considérer un ancien compte rendu comme vérité définitive.

## 4. État réel à la dernière documentation consultée

**Du code existe déjà :**
- Essentiel et Construction sont séparés ; écrans Web/Expo, registres de temps, pauses et plusieurs flux RH de base.
- Salariés Essentiel sans compte Auth obligatoire, association de compte personnel, appairage de borne, NIP sécurisé et pointage en ligne avec registre partagé ; scénarios SQL et Node/DOM documentés.
- La PWA borne possède sa page d'appairage et un jeton d'appareil limité. Lien **Ouvrir la pointeuse** / **Copier le lien** depuis la gestion des bornes **décrit comme intégré** dans `ESSENTIAL_BILLING_20261024.md` ; code temporaire d'appairage saisi séparément (jamais dans l'URL).
- Délai employé sur borne **10 secondes par défaut**, réglages 5/10/15/30/60, nettoyage des données personnelles et retour accueil, avec tests logiciels.
- Horaires avancés : départements, superviseurs, rotations, disponibilités, **quarts vacants et candidatures**, remplacements/échanges et couverture Pro selon la documentation de planification.
- Catalogue Essentiel et gestion tarifaire, bases Stripe Web/Expo et intégration serveur ; les docs décrivent un certain nombre de fonctions et de tests déployés, **pas une validation de facturation avec le fournisseur**.
- Une partie de la galerie personnelle Employé (**thèmes 11–20**) est développée. Cela ne signifie pas que les vingt thèmes ni les dix thèmes de bornes sont tous livrés.

**À ne pas déclarer terminé sans nouvelle preuve :**
- Paiements Stripe réels et parcours complets en environnement de test fournisseur ; taxes, promotions avancées et rapprochements.
- SMS Twilio réels, délivrabilité ; ils sont reportés selon les dernières priorités.
- **Connexion personnelle Admin/Boss depuis une borne commune** avec fermeture administrative à cinq minutes : la documentation récente la dit **désactivée / à développer** pour l'appareil partagé, même si les consoles Admin/Boss existent sur Web/Expo.
- **Les 10 thèmes visuels de la borne** (Classique Sauge, Clair Moderne, Sombre Élégant, Bleu Calme, Gris Minimal, Noir Premium, Lavande Doux, Pêche Chaleureux, Bleu Nuit, Sable Naturel), approuvés comme design mais à vérifier/coder ; ils sont **distincts des 20 thèmes personnels employés**.
- Mode pointage hors ligne **sur la borne** : non livré. Une page PWA mise en cache **ne signifie pas** que le pointage hors ligne est accepté.
- Vérifications physiques Safari/iPad, Android, iPhone, APK/IPA signé, sécurité terrain et conformité de paie ; sauvegardes/restauration, traduction, RH et fonctions avancées encore ouvertes.

La source de vérité est le **code du commit courant + tests réexécutés + état vérifié du serveur**, puis les documents à jour. Si la documentation se contredit, consigner l'écart et vérifier avant d'écrire.

## 5. Quelle tâche faire en premier

**Ne pas coder un nouveau système en parallèle de celui qui existe.** Commencer par un audit court : lire `ESSENTIAL_BILLING_20261024.md`, `ESSENTIAL_PLANNING_20261024.md`, `ESSENTIAL_MIXED_PUNCH_SPEC.md`, les composants concernés et les tests. Confirmer le statut actuel des fonctionnalités suivantes :

1. **Pointeuse PWA** : boutons d'ouverture/copie, URL statique sans code ou token, appairage et révocation, délai de 10 secondes, retour après fermeture de la PWA. Tester ce qui est déjà codé avant de le refaire.
2. **Thèmes de borne** : développer les **dix apparences** approuvées avec un seul composant fonctionnel, choix par borne dans Boss, aperçu, persistance Supabase, vérifications contrastes et tests. Références visuelles à récupérer auprès du propriétaire si elles ne sont pas présentes dans le dépôt.
3. **Admin/Boss sur borne** : accès explicitement activable par Boss, authentification séparée complète, **aucun identifiant mémorisé**, sortie immédiate vers la pointeuse et fermeture après **5 minutes**. Ne jamais donner de droits Admin au jeton de borne ; évaluer l'isolation de session PWA avant développement.
4. **Heures disponibles (Plus/Pro)** : les quarts vacants et candidatures existent partiellement. Vérifier le parcours complet Admin publication → employé postule dans Horaire → Admin accepte/refuse → affectation atomique, conflits/notifications, limites de forfait ; fonctions de coûts et couverture réservées Pro.
5. **Super Admin commun et page de vente** : dashboard sobre à six indicateurs, filtre Tout/Essentiel/Construction, matrice de tarifs, trois cartes **avec arguments commerciaux différents**, Stripe et droits vérifiés.
6. **Validation de commercialisation** : QA de régression Essentiel/Construction, accès par rôle, tests multi-entreprise, flux fournisseur dans des environnements sûrs, appareils réels, données et conservation.

Si le propriétaire assigne une tâche différente, suivre sa priorité, **mais respecter les règles de sécurité et de test**.

## 6. Méthode de travail avec GitHub et Supabase

1. Vérifier les deux invitations acceptées et les connecteurs disponibles dans Work. Ne jamais utiliser un projet Supabase au nom ou à l'ID différent.
2. Lire l'état du dépôt avant de toucher au code ; noter commit de départ et modifications non fusionnées. Vérifier les branches et PR ouvertes.
3. Choisir une **fonctionnalité étroite** et un résultat vérifiable. Créer une branche dédiée (ex. `feature/essential-kiosk-themes`). Éviter de pousser directement dans `main` ; proposer une Pull Request avec description et résultats de tests.
4. Garder les modifications Supabase sous forme de **migrations versionnées** dans le dépôt, revues avant application. Examiner RLS, tenant, permissions des RPC, stockage et secrets. Utiliser une base/staging ou transactions annulées pour les tests SQL. **Ne pas modifier des données réelles** pour tester.
5. En local ou environnement d'exécution Work capable de lancer les commandes :
   ```bash
   npm ci
   npm run check
   npm test
   node --check web/live/app.js
   node --check web/live/kiosk.js
   ```
   Pour les Edge Functions, vérifier TypeScript/Deno et les scripts SQL pertinents seulement lorsque l'environnement est configuré. Exécuter aussi les tests spécifiques au module modifié. Ne pas prétendre avoir lancé ces commandes si Work n'y a pas accès.
6. Pour le Web, le workflow GitHub Pages publie `web/live/` depuis `main`. **Une branche/PR n'est pas automatiquement le site public.** Vérifier l'état du déploiement avant de tester l'URL publique.
7. Faire vérifier la PR, documenter les risques, fusionner après autorisation/revue, puis revalider les parcours touchés. Préserver les heures, les données commerciales et le comportement Construction.

**Tests interdits en production :** suppression de salariés ou d'heures, factures Stripe réelles, envois SMS coûteux, tests de charge agressifs, changements de rôles plateforme, contournement RLS ou tests offensifs hors environnement autorisé.

## 7. Suivi partagé entre les deux Work

Si absents, créer **après avoir inspecté ce qui existe** :
- `docs/PUNCH_MASTER_ROADMAP.md` : une ligne par exigence, ID, édition, statut (`À FAIRE / EN COURS / TERMINÉ ET TESTÉ / BLOQUÉ`), critères, dépendances, preuves, commit/PR.
- `docs/PUNCH_WORK_CONTINUATION.md` : dernier commit, travail fait, tests réellement exécutés, blocages, propriétaire de la tâche, prochaine action précise.

**Ne pas marquer « TERMINÉ ET TESTÉ » si seules la maquette, la compilation ou la documentation existent.** Pour éviter les conflits entre deux Work : assigner les tâches, travailler sur des branches séparées, ne jamais écraser les changements non fusionnés de l'autre.

## 8. Prompt à coller dans le Work du collaborateur

> Je rejoins le dépôt GitHub **punch360app/Punch360** en tant que collaborateur et le projet Supabase **mlabstdxxwjdpfaxiwmg** avec mon propre accès Developer. Lis d'abord `docs/README_COLLABORATEUR_WORK.md`, puis les statuts récents `docs/ESSENTIAL_BILLING_20261024.md`, `docs/ESSENTIAL_PLANNING_20261024.md` et `docs/ESSENTIAL_MIXED_PUNCH_SPEC.md`. Inspecte le code actuel et les PR ouvertes. **Ne repars pas de zéro.** PUNCH Essentiel et Construction ont des interfaces distinctes, mais partagent leur moteur de temps et un Super Admin. Identifie les écarts réels entre fonctionnalités codées et décisions validées, vérifie ce qui est déjà fait, puis prends **une première tâche cohérente non terminée** dans la priorité du propriétaire. Travaille sur une branche dédiée, n'expose aucun secret, n'altère pas les vraies données Supabase. Implémente, ajoute des tests, exécute les contrôles possibles, puis prépare une PR et mets à jour la roadmap/continuation. Rapporte exactement les fichiers changés, tests exécutés, résultats, blocages et prochaine tâche, sans inventer de validation ni annoncer le produit commercialisable prématurément.

---

**Rappel au collaborateur :** ce dépôt contient de vrais mécanismes de sécurité, de temps et de facturation. Une amélioration visuelle ne doit jamais supprimer une heure, autoriser une autre compagnie ou donner un rôle plus élevé. **Sécurité des heures + séparation Essentiel/Construction + tests vérifiables d'abord.**
