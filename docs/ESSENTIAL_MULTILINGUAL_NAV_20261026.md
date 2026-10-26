# PUNCH Essentiel — base multilingue et RTL (premier lot)

Ce lot constitue la **première livraison technique** de l'exigence de dix langues du prompt original « Validation SQL archives ». **Il ne signifie pas que l'intégralité de PUNCH est traduite.**

## Locales déclarées
Français (fr, par défaut), English (en), Español (es), Português (pt), Italiano (it), Deutsch (de), العربية (ar, RTL), 简体中文 (zh), हिन्दी (hi), Filipino (tl).

Chaque clé du dictionnaire de navigation Essentiel est fournie dans les dix langues. Les chaînes absentes retombent sur le français sans bloquer l'interface. La préférence est stockée **localement, par identifiant de compte** sous `punch-locale:<userId>`, jamais en configuration partagée de l'établissement. Aucun jeton, NIP ou donnée de salarié n'est stocké dans cette préférence.

## Couverture effectivement codée
- Barres **Punch · Heures · Horaire · Plus**.
- Les entrées principales du menu « Plus » et le choix de langue dans les paramètres Essentiel.
- Les actions principales « Commencer/Terminer ma journée », « Reprendre », certains résumés et date de l'accueil employé.
- Le RTL arabe s'applique au conteneur personnel Essentiel; les montants, heures numériques, dates dans les champs et identifiants conservent leur sens de lecture gauche-droite.
- Aucun changement pour les modules PUNCH Construction.
- Les paramètres expliquent explicitement que les formulaires spécialisés, annonces serveur, notifications, aide juridique/paie et contenus RH peuvent rester en français.

## Tests
- `tests/essential-locale.test.mjs` contrôle les dix codes, toutes les clés, le RTL et l'isolation par utilisateur.
- `tests/ui.test.mjs` simule le changement arabe → anglais, le sens RTL/LTR et le stockage personnel.
- Les tests simulant l'interface injectent le module de langue lors de l'évaluation du bundle Web pour éviter de le confondre avec une variable globale inexistante.

## Travail encore nécessaire
Traduire et réviser **toutes** les sous-pages Essentiel (planification, paie, RH, messages, invitations, bornes, Super Admin, etc.), l'Expo natif, les erreurs serveur, les courriels et notifications. Prévoir une QA linguistique humaine, les pluriels et formats de date/devises selon la locale, ainsi que l'accessibilité RTL réelle sur iPhone et Android. Ne pas traduire automatiquement les termes juridiques ou de paie sans révision.

Pas de nouvelle migration Supabase. Le projet officiel et les flux Construction restent inchangés. Ne pas passer au prompt maître tant que le prompt original n'est pas clôturé.
