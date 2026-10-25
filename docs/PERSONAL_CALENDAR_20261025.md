# Horaire personnel — export iCalendar (.ics), 25 octobre 2026

## Livré en source Web / Expo
- Bouton **Télécharger mon horaire (.ics)** sur l'onglet Horaire Web si le compte a un dossier salarié associé; sur Expo, bouton **Partager mon horaire (.ics)** via la feuille de partage Android/iOS.
- Le fichier n'exporte que les quarts **publiés et non annulés** du salarié authentifié, appartenant à la compagnie courante. Un manager ne peut pas exporter les horaires d'autrui par ce bouton.
- Champs minimaux : créneau UTC, emplacement si visible, version de quart et identifiant stable par compagnie. **Aucun salaire, courriel, NIP, commentaire RH, numéro de téléphone ou autre employé.**
- Export sous la forme **instantané manuel** : pas de lien d'abonnement, de partage serveur, de synchronisation automatique ni de capacité de révocation après diffusion du fichier. Le fichier doit être considéré comme privé.
- Les dates sont exportées en UTC, évitant les heures locales ambiguës du changement d'heure Québec. Pliage des lignes à 75 octets Unicode, échappement RFC 5545, CRLF, séquence de version.
- Limite : les requêtes calendrier chargent au plus 1 000 quarts. Pour éviter un export incomplet trompeur, le bouton refuse le téléchargement si le nombre chargé atteint la limite.
- Expo crée un fichier dans le cache natif et présente la feuille de partage; tente d'effacer le fichier après la fin du partage.
- Ne modifie aucun horaire, aucune table Supabase, et n'utilise ni fournisseur ni secret. Construction inchangé.

## Tests
- `tests/personal-calendar.test.mjs` : isolation de compagnie/salarié, événements annulés, heures UTC/DST, caractères spéciaux et Unicode, identifiants, omission de données privées.
- `tests/planning-ui.test.mjs` : bouton disponible pour le salarié, filtrage de collègues, refus de pagination tronquée et export sans dossier personnel.
- CI `PUNCH TypeScript` : TypeScript, dépendances Expo, Node/DOM et validation de la syntaxe Web.
- **Vraie recette de partage iOS/Android, ouverture dans Calendrier Apple / Google / Outlook non exécutée dans cette séance.** Aucun build signé testé. Ne pas déclarer ces intégrations terminées sur la seule présence d'un fichier.

## Suite du prompt global
- Abonnement iCalendar personnel par URL à capacité signée/révocable, sans exporter les événements d'autres salariés.
- Mise à jour/annulation automatique de l'événement côté abonnés après changement de quart, lien révoqué à changement de rôle et changement de compagnie, tests DST.
- Fournisseurs Google Calendar, Outlook, Apple Calendar et push OAuth seulement après configuration explicite.
- Continuer les priorités du `docs/PUNCH_MASTER_ROADMAP.md` et de `docs/PUNCH_WORK_CONTINUATION.md`. SMS/Twilio en dernier.
