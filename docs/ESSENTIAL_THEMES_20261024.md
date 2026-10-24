# Dix thèmes employés — première série

Les thèmes approuvés 11–20 sont sélectionnables dans **Plus → Apparence**, sur Web et dans Expo. Ils utilisent un catalogue commun, des palettes et motifs distincts, un bouton circulaire de pointage et les mêmes actions métier. Galerie, aperçu réversible, accès au véritable écran Punch avec le thème essayé, confirmation et sauvegarde du choix personnel côté Supabase.

Le choix enregistré est mis en cache par utilisateur pour la prochaine ouverture hors ligne; il est relu du serveur à la connexion et au retour au premier plan. Un échec d’enregistrement affiche une erreur et ne prétend pas avoir synchronisé. Les réponses tardives après déconnexion sont ignorées. La préférence reste personnelle, sans nouveau salarié ou place facturable.

RLS : lecture et écriture de son propre choix seulement; catalogue autorisé vérifié par contrainte serveur. Le thème n’accorde aucune permission et ne modifie ni bornes ni consoles de gestion. Les originaux sont conservés dans `docs/design/essential-2026-10-24`.

Validation : 45 tests Node/DOM, dont quatre tests de thèmes; contraste texte/fond, texte/carte et bouton vérifié à 4,5:1 minimum pour chaque palette. Script SQL transactionnel `essential_appearance.sql` : lecture/écriture personnelles, refus d’identité étrangère et d’un thème inconnu. TypeScript et bundles Android/iOS produits. Aucun essai sur appareil physique ou de distribution native annoncé.

Ce lot livre les dix designs transmis, pas vingt designs inventés. Le prompt complet garde les autres travaux ouverts documentés. SMS reportés à la fin selon la nouvelle priorité de l’utilisateur.
