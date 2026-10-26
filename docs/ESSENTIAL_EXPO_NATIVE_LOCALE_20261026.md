# Essentiel — langue native Expo et navigation RTL (26 octobre 2026)

Ce lot étend la **première couche de localisation Web existante** aux interfaces natives Expo Android/iPhone. Il appartient au prompt original **« Validation SQL archives »**, pas au prompt maître consolidé.

## Livré dans ce lot

- Réutilisation directe du dictionnaire `web/live/essential-locale.js` par `src/i18n/essential-native-locale.js`, afin que la même clé représente le même texte dans le navigateur et Expo; **10 langues** : fr, en, es, pt, it, de, ar, zh, hi, tl.
- Traductions supplémentaires des rubriques courantes Boss/Admin, titre de gestion, affichage d'abonnement, transferts Boss, postes, équipes, horaires, RH et navigation.
- `ManagementWorkspace.tsx` : bouton de langue accessible pour Essentiel, menu de sélection; navigation, tableaux de bord, état d'accès restreint, actions de support/facturation et commandes principales localisées.
- `EssentialWorkspace.tsx` : choix de langue dans « Plus », quatre onglets Punch/Heures/Horaire/Plus, bonjour, actions principales de pointage et labels essentiels, titre des heures/horaire, partie du menu personnel localisés.
- La préférence est stockée **par identifiant d'utilisateur** dans AsyncStorage `punch-locale:<userId>`; jamais dans les réglages d'un établissement. Un compte différent charge d'abord le français, puis sa propre préférence, sans réutiliser celle du précédent.
- Arabe : direction RTL appliquée aux barres de navigation et aux textes pertinents. Les montants, heures et identifiants ne sont pas réécrits ni inversés automatiquement.
- **Construction inchangé** dans ManagementWorkspace : pas de réécriture forcée des libellés historiques de Construction.
- Tests : `tests/essential-native-locale.test.mjs`, notamment équivalence du dictionnaire Web/Expo, couverture des 10 langues, isolation des comptes, repli sûr et RTL arabe. La compilation TypeScript vérifie les intégrations Expo.

## Ce qui n'est pas traduit dans cette étape

**Ce n'est pas encore une certification linguistique complète**. Certains messages des modules spécialisés (paie/RH, politiques d'entreprise, contrats et formulaires), la borne, les invitations/SMS, les erreurs SQL, le Super Admin et d'autres écrans Expo restent en français. Aucune traduction juridique/salariale automatique n'a été déployée. Les dates et devises doivent être vérifiées pour chaque langue, de même que le rendu RTL sur appareil réel. Ces exigences restent **ouvertes** jusqu'à une recette humaine et complète.

Aucune migration Supabase ni nouveau service tiers. La traduction ne change pas la logique de pointage, les droits, les tarifs ou les historiques.

**Important :** continuer exclusivement le prompt original « Validation SQL archives » avant de passer au prompt maître parallèle.
