# PUNCH-AUDIT-GLOBAL-20261028 — matrice de reprise

**Priorité confirmée sur `main` par la PR #219.** Mandat en cours ; cette matrice n'atteste pas une recette de l'application entière.

## Règle de couverture et état initial

Chaque ligne de la matrice doit être affinée par **page/sous-page, état, rôle, viewport, objectif client, défaut mesuré, priorité, correction, capture, verdict**. Vérifier les états chargement, vide, erreur, sélection, refus d'accès, désactivé, succès, hors ligne, clavier et contenu long selon pertinence. Un écran absent reste « non livré » ou « NON VÉRIFIÉ », pas « UX OK ».

| Famille du vrai produit | Rôle et formats | Audit initial et preuve | Statut |
| --- | --- | --- | --- |
| Accueil/vente Essentiel et Construction | Public, S25/iPad/PC | Captures GitHub Actions existantes, quatre états publics par édition; inventaire détaillé des contrôles et alertes ajouté par ce lot | En contrôle automatisé partiel |
| Connexion / création / récupération | Public, S25/iPad/PC | Navigations entre les états déjà exercées par `visual-capture.cjs`; aucune soumission ni Auth réelle | En contrôle automatisé partiel |
| Espace salarié, carte QR et pointage téléphone | Salarié, petits/grands téléphones | Aucun compte de test utilisé par ce lot | NON VÉRIFIÉ |
| Borne non appairée : code, langue, navigation clavier | Opérateur, petit téléphone/S25/iPad/PC + RTL | PR #221 fusionnée, TypeScript et navigateur verts : 4 viewports, Enter/RTL et cibles ≥44 px | Contrôle automatisé partiel ; matériel NON VÉRIFIÉ |
| Borne appairée fictive : identification matricule/NIP et création du NIP | Opérateur, petit téléphone/S25/iPad/PC + RTL | PR #222 fusionnée, TypeScript et navigateur verts : 8 états DOM sur 4 viewports, pavé, Entrée, focus et RTL sans appel externe | Contrôle automatisé synthétique ; authentification NON VÉRIFIÉE |
| Borne appairée réelle : autorisations, pause, pointage, synchronisation, caméra QR | Opérateur, tablette portrait/paysage | Permissions et opérations réelles non testées; sens QR employé → caméra tablette maintenu | NON VÉRIFIÉ |
| Carte QR Wallet et scanner caméra d'une borne Essentiel Pro | Salarié affiche Apple/Google Wallet ; caméra tablette scanne | **Écart confirmé** : ni interface Scanner ma carte dans `web/live/kiosk.js`, ni décodage caméra dans la page, ni action QR dans `supabase/functions/essential-kiosk/index.ts`. Fonction prévue sous `KIOSK-017–028` et `WALLET-*`; permissions/forfait/tenant/révocation et PIN de confirmation restent à concevoir et valider en serveur | NON LIVRÉ / À DÉVELOPPER ; ne pas simuler un bouton fonctionnel |
| Boss/Admin — réconciliation des pointages hors ligne Web/Expo | Responsable autorisé, téléphone/tablette/PC | PR #224 fusionnée avec tests CI/Chromium verts sur 320/S25/iPad/PC, confirmation en deux étapes, annulation et relecture, données strictement fictives | CONTRÔLE SYNTHÉTIQUE ; recette authentifiée NON VÉRIFIÉE |
| Heures, corrections, validation, export | Boss/Admin/chef/salarié selon droits, tablette/PC/téléphone | Contrats de temps et isolation des compagnies à préserver | NON VÉRIFIÉ |
| Horaires, missions, trajets et hors ligne | Chef/Boss/Admin/salarié, multi-formats | `MISSION-012` en validation avant la campagne, ne pas écraser ni marquer terminé | NON VÉRIFIÉ |
| Personnel, messages, notifications, réglages et autres pages réellement livrées | Rôles autorisés, multi-formats | Inventaire exhaustif par route et bouton à réaliser | NON VÉRIFIÉ |
| Super Admin, MFA, tableaux, catalogue et contrats | Super Admin, PC/iPad surtout; téléphone d'urgence | Vérifier vraies données et protections serveur, sans opération réelle | NON VÉRIFIÉ |
| Super Admin — journal d’audit, recherche et export | Super Admin MFA, téléphone/tablette/PC | PR #225 fusionnée (CI/Chromium SUCCESS sur 320/S25/iPad/PC) : effacement après refus d’accès, erreurs neutres et filtres/export contrôlés | CONTRÔLE SYNTHÉTIQUE ; MFA réelle NON VÉRIFIÉE |
| Super Admin — annuaire d'entreprises, fiche et contrôles de service | Super Admin MFA, téléphone/tablette/PC | Défaut de confidentialité après refus RPC : ancienne liste/fiche conservée et message serveur brut. Branche de correction : effacement, rétroaction accessible partagée, UI responsive sauge, tests négatifs et captures fictives | À VALIDER EN CI ; session réelle NON VÉRIFIÉE |
| Construction et fonctions conditionnées aux forfaits | Rôles autorisés, multi-formats | Découvrir les pages/états réels; garder distinct d'Essentiel | NON VÉRIFIÉ |

## Première protection technique de la campagne

- `visual-capture.cjs` enrichit les **24 captures d'états publics réellement exécutés** avec le recensement des contrôles DOM affichés, y compris ceux situés sous la ligne de flottaison. Pour chaque contrôle : type, nom accessible, action, taille, état désactivé, visibilité dans le viewport, ordre et index. Jamais de valeur de formulaire.
- `ux-public-inventory.cjs` signale les libellés accessibles manquants, les IDs dupliqués et les pseudo-boutons inaccessibles au clavier. Le résultat `public-ui-inventory.json` est versé dans l'artefact `punch-visual-captures`; les constats sont **à examiner/corriger** et ne constituent pas une approbation visuelle.
- `tests/ux-public-inventory.test.mjs` couvre les contrôles hors écran et la détection des écarts. `tests/ux-design-contract.test.mjs` protège les invariants sauge, focus, cibles tactiles et dispositions responsive fondamentales.
- Les tests existants imposent déjà des cibles tactiles de 44 px sur les quatre états publics et le contrôle de 24 captures. **Les pages privées et l'exécution réelle de chaque bouton ne sont pas couvertes par ces preuves publiques.**

## Limites, concurrence et prochaine étape

La PR #217 modifie `web/live/app.js`, `essential.js`, `essential.css`, `tests/essential-ui.test.mjs` et le maître ; elle reste indépendante. La PR #86 est une préparation Storage non intégrée. Les travaux de `MISSION-012`, MFA, prix, heures, droits, QR et isolations sont préservés. Ne pas générer ni approuver de nouvelles baselines à partir des rendus dégradés.

**Prochain correctif utilisateur :** examiner l'artefact `public-ui-inventory.json` et les captures sur le SHA final de ce lot; corriger les défauts publics confirmés sur une branche non conflictuelle ou après résolution de #217, puis étendre progressivement l'inventaire aux vrais parcours authentifiés avec comptes isolés et preuves par rôle/format. Verdict global actuel : **NON VÉRIFIÉ**.

## Lot suivant — borne non appairée (corrigé en branche, état à attester en CI)

**Constat fonctionnel vérifié dans le code avant correction :** `kiosk.js` annulait toutes les touches `Enter` et essayait toujours de cliquer `[data-key="OK"]`. Sur l'écran non appairé, ce bouton n'existe pas; le code d'appairage au clavier ne pouvait pas être confirmé par Entrée. La même interception perturbait les contrôles natifs comme le choix de langue. Un changement de langue reconstruisait aussi l'interface sans restaurer le focus.

**Correction proposée :** `kiosk-keyboard.js` ne traduit Entrée en clic explicite que pour le champ d'appairage ou les champs d'identification autorisés selon l'état; les boutons, le sélecteur de langue, les répétitions, la composition IME et l'état occupé conservent leur comportement natif. `kiosk.js` protège les actions de pointage existantes, restaure le focus du sélecteur de langue et conserve les refus serveur. Surfaces clavier/focus de 44 px; la région d'annonce d'état demeure locale (`role="status"`) plutôt que tout le document. La mise à jour du cache PWA inclut le nouveau module.

**QA à constater avant fusion :** tests clavier Node et CI TypeScript; script navigateur `visual-kiosk.cjs` sur petit téléphone 320 px, S25, iPad et PC; contrôle de l'absence de débordement, des cibles de 44 px, de l'action Enter sans réseau, de la sélection RTL arabe et du focus. Captures `kiosk-unpaired-*.png` et `kiosk-public-audit.json` jointes au paquet visuel. Les tests n'utilisent ni compte, ni code réel, ni appareil appairé : **aucune recette de pointage réel, d'Auth, de caméra ou de synchronisation attestée**. Aucun nouveau modèle Figma approuvé automatiquement.

## Couverture supplémentaire — identification et enrôlement sur appareil synthétique

Nouvelle couverture navigateur (sans mutation applicative) : appareil *strictement fictif* inscrit dans IndexedDB du navigateur d'essai, chargement des vraies pages de borne déjà appairée, état matricule/NIP et état création du NIP, boutons du pavé (chiffre/effacer), `Enter` depuis matricule sans envoi de demande, sélection arabe RTL en conservant le focus et les champs. Captures et mesures sur quatre viewports (320 px, S25, iPad, PC), protégées par le workflow visuel. Aucun fournisseur externe contacté, aucun jeton ou numéro réel. Les résultats demeurent **syntétiques** : ils ne valident ni l'appairage serveur, ni le scan QR, ni l'enregistrement des heures, ni l'appareil physique.

## Lot 4 — états chargement/refus de la borne (correction à valider sur PR)

**Constat confirmé dans les sources avant correction** : le gestionnaire `kiosk.js` posait `state.busy=true` sans mettre l'écran à jour avant le `await`; boutons et champs demeuraient visuellement actifs et le message de traitement n'était pas annoncé. Le rendu après la réponse existait, mais pas pendant l'attente. Le message d'échec était placé après le long formulaire et le pavé, donc difficile à repérer sur petite tablette/téléphone. Cette lacune concerne appairage, identification, enrôlement NIP, synchronisation et actions autorisées.

**Correction locale** : `kiosk-processing.js` désactive les contrôles visibles sans reconstruire le formulaire ni écrire les valeurs dans une trace; affiche immédiatement une annonce `role=status` dans une région près de l'en-tête; `aria-busy` sur la section, sans bloquer l'annonce située à l'extérieur. Message « Traitement en cours » traduit dans les 10 langues via le dictionnaire officiel; style sauge et affichage compact sans bloc vide. Le `finally` existant récupère l'état selon le résultat réel et réactive l'interface. Aucune garantie de succès serveur, aucune opération d'heures/paie supplémentaire.

**QA obligatoire** : test de l'état en attente et retour après réponse simulée refusée, pas de double envoi ni exposition de NIP en clair, captures de la borne fictive en attente et RTL sur quatre viewports, CI TypeScript/Node/visuel sur SHA final, cache PWA à jour. Régression des 24 états publics et 12 états de borne déjà couverts. **Les preuves navigateur ne certifient pas une connexion au serveur, une caméra, Safari/iPad réel ni une politique de pointage.**

## Lot 5 — confirmation des décisions sur les pointages hors ligne (branche en validation)

**Constat client/QA** : dans `web/live/kiosk-offline-review.js` et `src/workforce/KioskOfflineReviewPanel.tsx`, un seul appui sur « Confirmer les observations » ou « Refuser » lançait directement la RPC de réconciliation après un motif. Sur tablette partagée et petit téléphone, une mauvaise touche pouvait entraîner une décision sensible sur les heures. Le serveur conserve les vrais droits, mais le client n'offrait pas de seconde vérification explicite du **lot concerné**.

**Correctif** : deux étapes pour Boss/Admin, avec identité du salarié/borne rappelée, choix exact (approuver/refuser), motif figé jusqu'à annulation et bouton final « Enregistrer »; aucune RPC d'écriture à la première sélection. Relecture de la liste autorisée avant l'écriture; si lot fermé/disparu, compte changé ou motif altéré, refus côté interface. Pendant la requête finale, contrôles désactivés; erreurs serveur génériques sans détails privés. Annulation sans écriture. Le serveur `review_kiosk_offline` demeure seul arbitre des droits, règles, heures et conflits. Aucun compte réel modifié.

**Responsive et harmonisation** : Web utilise une famille `.offreview-*` dédiée avec palette sauge, boutons adaptatifs de 48 px, focus clavier et annonce `role=status`; Expo reprend les deux étapes et le style sauge avec `Pressable` et confirmation accessible. Les traductions Web restent celles des dix langues Essentiel, sans rendre une nouvelle chaîne publique inventée; Expo demeure partiellement en français, limite à reprendre dans sa localisation complète.

**Preuves attendues** : tests Node contre premier appui, double confirmation, annulation, compte changé, motif changé, lot fermé, refus fournisseur; contrôle TypeScript/Expo et captures du vrai contrôleur Web avec données strictement fictives sur 320 px, S25, iPad et PC, dans `visual-captures`. Vérifier le SHA final et la publication servie. **Ce lot ne prouve pas une approbation réelle, une authentification Boss/Admin, ni les heures finales en base de données.**

## Lot 6 — journal d’audit Super Admin, refus MFA et confidentialité

**Constat de code** : après consultation des événements, une nouvelle demande `platform_search_audit` refusée par droits/MFA conservait les anciennes lignes privées dans le DOM. En plus, `s.error=err.message` exposait directement le diagnostic serveur. L’export CSV restait disponible même si le contexte d’accès avait changé. Les filtres date inversés n’étaient pas refusés localement.

**Correctif Web** : sur refus de permission (code SQL `42501` ou HTTP 401/403), vider lignes/cursseur/filtres et retirer les détails du rendu; message sûr « Accès expiré ou refusé. Reconnectez-vous avec MFA ». Erreurs de disponibilité neutralisées et filtres date+fuseau validés; export vide désactivé à l’écran. La RPC serveur reste seule source des événements et de leurs permissions; la neutralisation CSV contre formules est préservée. Aucun événement ni donnée Supabase modifié.

**QA attendue** : simulations de droit retiré après liste privée, export impossible d’anciennes lignes, réponse tardive après déconnexion, date invalide et date inversée, CSV sécurisé; vrais rendus sur téléphone 320/S25, iPad et PC par injection de données de test et refus RPC fictif, avec captures avant/après et vérification d’absence de débordement. **Une simulation visuelle ne prouve pas la vraie session MFA, les RLS SQL ni la publication réelle.**

## Lot 7 — annuaire Super Admin et cohérence Design System (branche en validation)

**Constat observable dans le code** : `web/live/platform-directory.js` conservait l'ancienne liste de sociétés et la fiche ouverte si une nouvelle recherche ou opération recevait un refus `42501`/401/403; le message du fournisseur était affiché directement. Le champ de consultation et les commandes de service pouvaient rester visibles malgré la perte d'accès. Les boutons répétaient du HTML local sans attribut type explicite et sans famille de mise en page cohérente sur téléphone.

**Correctif proposé** : un seul intégrateur conserve la RPC comme autorité sur les données, les accès, versions et règles de suspension; il efface liste, fiche et états de service lors d'un refus, neutralise les erreurs exposées, valide la forme des réponses et rend visible l'état « Vérification en cours » sans laisser de double soumission. Le module partagé `platform-ui-guards.js` harmonise les messages accessibles et la détection des refus entre annuaire et journal d'audit. Le CSS `platform-directory.css` réutilise les variables de marque sauge et les boutons `.ess-btn` existants, avec enveloppement responsive sans écraser `essential.css` (PR #217). Mise à jour explicite du cache PWA et du chargement des styles.

**Preuves exigées** : tests Node des refus sur recherche/pagination/fiche/suspension, absence de fuite après logout ou donnée tardive, messages serveur non exposés, attente, filtres et maintien du contrat de service; revalidation du journal d'audit après factorisation; captures de la vraie interface avec données synthétiques et refus simulés sur 320 px, S25, iPad et PC, boutons >=44 px et absence de débordement, CI sur SHA final. Pas d'appel de RPC de mutation réelle, de session MFA de production ou de test matériel. Garder le statut **NON VÉRIFIÉ** pour permissions réelles, publication Pages et toutes les pages non couvertes.
