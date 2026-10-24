# PUNCH 360° — Tester sur le Web

## Publication prévue
GitHub Pages officiel : `https://punch360app.github.io/Punch360/` **une fois la publication GitHub Actions activée et réussie**.

L'application statique est dans `web/live/`; le workflow `.github/workflows/deploy-web.yml` vérifie la syntaxe et publie ces fichiers.

### Activation GitHub Pages (une seule fois)
1. Connecte-toi dans Chrome avec **punch360app**.
2. Ouvre **https://github.com/punch360app/Punch360/settings/pages**
3. Sous **Build and deployment → Source**, choisis **GitHub Actions**.
4. Relance le workflow **PUNCH 360 Web** dans l'onglet **Actions**, si le déclenchement initial a déjà échoué.
5. Ouvre la page uniquement après un workflow **success** et un chargement HTTP confirmé.

## Modules reliés à Supabase
- Courriel/mot de passe et création de compagnie
- Numéros de jobs, adresses, photo par URL et épingles GPS facultatives
- PUNCH IN, PUNCH OUT et transfert transactionnel entre jobs
- Mes heures, archive personnelle et demandes de correction
- Commandes texte par chantier et historique
- Messages de groupe et groupe privé du chef (si équipes/affectations existantes)
- Profil, contacts d'urgence, certifications (métadonnées)
- Demandes de congé, affectations visibles, création de jobs Admin/Boss

## Manques à compléter pour satisfaire le cahier des charges officiel
- Facturation Stripe / abonnements, invitations SMS/courriel et ajout de places
- Approbations de corrections, fermeture de semaines, déductions dîner, rapports CSV
- Documents PDF avec stockage privé, confirmation de lecture, catalogue photo
- Google/Apple OAuth de bout en bout, notifications, météo en direct, traduction 10 langues
- Mode hors ligne et synchronisation, tests RLS multi-entreprise automatisés, test Android/iOS
- Super Admin PUNCH, révisions de documents, approbations congés et commandes
- Carte Web visuelle complète : les boutons GPS/Google/Waze fonctionnent, mais le dessin des épingles à l'écran est encore indicatif

**Ce site n'est pas l'application complète terminée.** Il s'agit d'une version alpha connectée et testable pour les modules listés. Les heures enregistrées dans Supabase sont de vrais événements de test, mais ne sont pas autorisées pour la paie.

## Sécurité
- Frontend public = uniquement la clé Supabase *publishable*, sans secret.
- Les accès réels sont contrôlés par les politiques RLS et les RPC serveur.
- Ne pas saisir les vrais contacts d'urgence ni les cartes CCQ avant validation du stockage et de la protection des données.
- Le dépôt Github est public : le code est public, les données protégées par Supabase RLS. Éviter les fichiers de configuration contenant des secrets.

## Contrôles GitHub
- `.github/workflows/deploy-web.yml` lance `node --check web/live/app.js` avant publication.
- Les scripts du navigateur importent le client officiel Supabase, épinglé en version.
