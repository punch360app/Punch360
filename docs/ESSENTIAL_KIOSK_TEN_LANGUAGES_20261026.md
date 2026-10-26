# PUNCH Essentiel — borne tactile multilingue, lot 1 (26 octobre 2026)

**Projet : prompt original « Validation SQL archives ».** Ce lot localise les **écrans principaux d'identification et de pointage de la borne commune** en 10 langues, sans modifier les règles Supabase de pointage ni les NIP.

## Livré
- Langues : français par défaut, anglais, espagnol, portugais, italien, allemand, arabe (RTL), chinois simplifié, hindi, filipino.
- Sélecteur de langue accessible dans l'en-tête de la borne PWA; aucun compte salarié nécessaire pour sélectionner.
- Écrans principaux : appairage, identification, création du NIP, matricule, état du quart, début/fin de journée, pauses payées/non payées, navigation, statut en ligne/hors ligne.
- L'écran de pointage utilise maintenant « **Commencer ma journée** » et « **Terminer ma journée** » en français au lieu d'étiquettes exclusivement anglaises.
- Le NIP et le matricule saisis ne sont pas écrits dans les préférences du navigateur. Lors du changement de langue, les valeurs des champs ouverts restent dans la mémoire du DOM de la page, sans persistance. **Après chaque retour automatique, fin d'opération, annulation ou départ de l'employé, la langue redevient le français**; la borne est commune et n'associe pas un choix de langue à un salarié.
- Conteneur RTL pour l'arabe; NIP, numéro d'employé, horodatage et pavé numérique restent en LTR pour la saisie et la cohérence.
- Style tactile responsive, textes longs autorisés à passer à la ligne.
- PWA : version des scripts/CSS rehaussée; `kiosk-locale.js` ajouté au cache de code du Service Worker, pour les écrans déjà ouverts en mode hors ligne.

## Sécurité
- Aucune modification des appels serveur ni de la validation de NIP.
- Aucun jeton ou secret d'employé dans le dictionnaire.
- Aucune nouvelle API ou droit Supabase accordé.
- Les messages d'erreur techniques de sécurité et le rapprochement hors ligne restent en français dans ce premier lot, afin d'éviter une traduction ambiguë de la gestion d'incidents. La traduction de ces messages nécessite une revue par scénario et un test du parcours complet.
- La borne ne stocke pas la langue dans localStorage, sessionStorage ni dans les dossiers salariés.

## Tests
- `tests/kiosk-locale.test.mjs` vérifie les 10 langues, les libellés, la conservation temporaire du PIN lors d'un changement de langue, la confidentialité et le retour au français.
- Les tests existants `tests/kiosk-ui.test.mjs` et `tests/kiosk-offline-ui.test.mjs` sont mis à jour pour charger le nouveau vocabulaire et conserver leur couverture de gestion hors ligne/anti-doublon.
- CI GitHub TypeScript/Node/DOM et déploiement Pages à valider avant clôture du lot.

## Encore nécessaire pour la clôture du prompt original
- Traduire et réviser tous les messages de sécurité, incidents, journal provisoire et assistance de la borne dans les 10 langues.
- Vérifier l'accessibilité et la mise en page RTL physiquement sur tablette iPad/Android, pavé numérique et hauteur d'écran.
- QA linguistique humaine, particulièrement règles légales et temps rémunéré, avant déclaration de traduction totale.
- Les modules RH/paie, Super Admin, notifications et certaines sous-pages Web/Expo restent également à traduire. Les intégrations Stripe sandbox, OAuth, calendrier externe et les essais de mise en production restent ouverts.
- SMS/Twilio à la fin, comme convenu; le prompt maître consolidé reste distinct et **non abordé ici**.
