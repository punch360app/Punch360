# Essentiel — abonnements calendrier personnels iCalendar

## Fonctionnement
Un salarié ayant un compte personnel valide peut créer un **lien secret d'abonnement** depuis Mon horaire, sur le Web et l'application Expo. Il le copie dans une application Calendrier compatible avec l'abonnement par URL iCalendar.

Le serveur fournit les quarts du salarié pour **30 jours passés et 365 jours futurs**, identifiants stables, versions croissantes et événements `STATUS:CANCELLED` lors des annulations. Les mises à jour apparaissent lorsque le fournisseur recharge le lien (l'application PUNCH ne contrôle pas sa fréquence). Maximum 1000 événements : en cas de dépassement, retour indisponible au lieu d'un calendrier silencieusement incomplet.

## Sécurité
- Le jeton de 256 bits est généré avec `extensions.gen_random_bytes(32)`. **Le jeton en clair ne reste jamais dans Supabase** : seule son empreinte SHA-256 est persistée dans `private.essential_calendar_feed_tokens`, sans permission directe anon/authenticated, RLS activée.
- Le lien apparaît **une seule fois** à sa génération ou rotation; le statut ultérieur n'affiche jamais le secret. Un nouveau lien **révoque automatiquement l'ancien**. Révocation explicite également.
- Triggers DB révoquent immédiatement le lien lors d'un retrait/changement de rôle, fermeture d'appartenance à l'entreprise, perte du compte personnel, désactivation du dossier salarié ou changement d'identité.
- L'API lecture `personal_calendar_feed_read` est exécutable **par le service_role seulement**; elle revérifie à chaque requête la compagnie, le salarié, le compte Auth et l'appartenance active. Elle ne renvoie ni courriel, NIP, téléphone, salaire, notes ni données d'autres salariés.
- La fonction Edge `essential-calendar` est publiquement accessible (clients calendriers sans JWT), mais se protège **par le jeton URL vérifié en base**. Requêtes invalides/révoquées → 404. Son secret serveur `SUPABASE_SERVICE_ROLE_KEY` ne figure jamais dans le client Web/Expo.
- **Toute personne qui possède le lien peut lire le calendrier personnel**. Ne pas l'afficher publiquement et le révoquer s'il est exposé. Un calendrier tiers auquel il est ajouté conservera ce lien sur ses propres serveurs.

## Fichiers
- Migration `supabase/migrations/20261026014500_essential_personal_calendar_feeds.sql` (numéro à aligner après installation).
- `supabase/functions/essential-calendar/index.ts` et `ical.mjs`. Déployer la fonction avec `verify_jwt=false` **uniquement parce qu'elle vérifie elle-même les liens secrets**.
- Interfaces `web/live/planning.js` et `src/workforce/EssentialPlanningPanel.tsx`.
- Tests `supabase/tests/essential_personal_calendar_feeds.sql`, `tests/calendar-feed.test.mjs`, `tests/calendar-feed-ui.test.mjs`.

## Validation et limitations
- SQL `BEGIN/ROLLBACK` avec utilisateurs/compagnie fictifs : identité/Auth session vivante, service_role uniquement, lecture un seul salarié, rotation, révocation, changement de rôle, perte/restauration d'accès personnel et absence de résurrection d'anciens jetons.
- Tester après migration appliquée. Tester également Edge déployée avec un jeton invalide, puis vrai lien sur une entreprise fictive et client calendrier.
- **Pas d'intégration OAuth directe Google/Apple/Microsoft**, pas de notification push à chaque changement : cette première version utilise un abonnement iCalendar standard.
- Les événements annulés restent présents avec statut annulé durant la fenêtre temporelle, pour faciliter la suppression chez les clients compatibles.
- Les quarts restent en UTC au niveau iCalendar, y compris pendant les changements d'heure Québec.
- Projet original **« Validation SQL archives »** en cours. Ne pas basculer au prompt maître parallèle avant sa clôture.
