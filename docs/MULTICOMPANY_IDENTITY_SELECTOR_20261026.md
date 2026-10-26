# PUNCH Essentiel/Construction — une identité Auth, plusieurs entreprises

## Problème
Une même personne peut être employée ou administratrice dans plusieurs commerces utilisant PUNCH. Le système doit **conserver un seul compte de connexion** mais jamais fusionner les rôles, les quarts, les pointages, les données RH et les autorisations des entreprises. La version antérieure de `AuthGate.tsx` chargeait seulement une ligne `.limit(1).maybeSingle()` et masquait donc la seconde entreprise.

## Fonction
- Récupérer les appartenances **actives** depuis `public.company_members` sous l'identité Auth courante, avec nom de la compagnie et édition via jointure protégée par RLS.
- Le module commun `web/live/company-workspaces.js` reconstruit les espaces à partir des lignes retournées par le serveur, filtre les rôles autorisés, les identifiants d'entreprise et les doubles, sans utiliser l'adresse courriel comme permission.
- Si plusieurs entreprises et aucune sélection valide enregistrée : **page de choix obligatoire**. Ensuite, bouton « Changer d’entreprise » dans les menus de gestion et les espaces personnels; dans Expo, bouton discret au-dessus de l'écran quand plusieurs compagnies sont disponibles.
- Chaque sélection est **revérifiée en ligne** auprès de la session Auth et des appartenances actives. Si l'employeur a retiré l'accès, l'entreprise ne peut plus être ouverte par choix local périmé.
- Garder la dernière compagnie choisie **par utilisateur**. Les caches Expo de l'espace sont séparés par `userId:companyId` ; le chargement d'une autre entreprise remonte entièrement son écran (clé compagnie/rôle) pour effacer l'ancien état React.
- Sur le Web, vider les données chargées du dernier établissement avant de charger celles du nouveau; chacune des requêtes est filtrée et autorisée par le serveur. Les instantanés hors ligne et les journaux de punch sont indexés par `userId:companyId`, jamais seulement par l'utilisateur. **Un changement d'entreprise est refusé tant que des pointages locaux sont encore en attente de synchronisation.**
- Mode hors ligne : une seule compagnie précédemment vérifiée sur cet appareil, jamais un changement d'entreprise sans réseau. Une erreur de vérification Auth en ligne ne doit pas donner accès aux rôles du cache.
- Le compte Auth, les compagnies, la facturation et les droits Super Admin restent indépendants. Une connexion ne crée jamais automatiquement un rôle Boss dans une autre entreprise.

## Validation
- Fichier partagé : `web/live/company-workspaces.js`.
- Interfaces : `web/live/app.js`, `src/auth/AuthGate.tsx`.
- Tests : `tests/company-workspaces.test.mjs` ; `tests/ui.test.mjs` (sélection, deux rôles, tenant révoqué, punchs hors ligne).
- Aucune migration SQL nécessaire : la table `company_members` et les politiques RLS existantes conservent l'autorité.
- Pour recette complète : compte fictif membre de deux compagnies Essentiel distinctes, roles distincts, vérification des horaires/pointages/messagerie/paie/notifications et fermeture d'une appartenance pendant que l'autre reste accessible; appareils Android/iPhone et navigateurs.
- **Ne pas prétendre que le multi-tenant est certifié sans recette terrain**. Ne jamais autoriser le nouvel employeur à consulter la compagnie précédente.
- Complément du prompt original « Validation SQL archives » ; prompt maître consolidé encore séparé.
