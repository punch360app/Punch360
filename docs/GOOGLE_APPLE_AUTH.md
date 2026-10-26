# Authentification Google et Apple — PUNCH 360°

## État
- Frontend GitHub Pages : boutons Google et Apple intégrés sur `web/live/app.js`.
- Flux : `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` en **PKCE** ; retour sur la même application PUNCH.
- Les utilisateurs authentifiés utilisent la table `company_members` pour leur rôle et leur compagnie : ne jamais donner le rôle Boss en se fondant sur le fournisseur, l'email ou les métadonnées éditables.
- **Activation des fournisseurs : à configurer dans les consoles propriétaires.** L'accès Supabase disponible pour ChatGPT ne permet pas de régler l'Auth Provider ni de créer les identifiants OAuth chez Google ou Apple. Aucun secret ne doit être placé dans ce dépôt public ni dans un chat.

## URL de PUNCH
Site URL / Redirect URLs Supabase :
```
https://punch360app.github.io/Punch360/
```
Dans le tableau de bord Supabase :
- [URL Configuration](https://supabase.com/dashboard/project/mlabstdxxwjdpfaxiwmg/auth/url-configuration)
- Site URL = `https://punch360app.github.io/Punch360/`
- Ajouter la **même** URL complète dans Redirect URLs.

## URL de rappel commune au fournisseur Google / Apple
C'est Supabase, **pas GitHub Pages**, qui reçoit le premier retour de Google/Apple :

```
https://mlabstdxxwjdpfaxiwmg.supabase.co/auth/v1/callback
```

## Google (à faire une fois)
1. Ouvrir [Google Auth Platform — Clients](https://console.cloud.google.com/auth/clients).
2. Créer un projet PUNCH 360 si nécessaire, puis configurer Branding / Audience / Data Access ; scopes standards `openid`, `userinfo.email` et `userinfo.profile`.
3. Créer un client OAuth **Web application**.
4. Authorized JavaScript origins : `https://punch360app.github.io` (sans le chemin `/Punch360/`).
5. Authorized redirect URIs : `https://mlabstdxxwjdpfaxiwmg.supabase.co/auth/v1/callback`.
6. Copier le Client ID + Client Secret **directement dans** [Supabase Authentication → Sign In / Providers → Google](https://supabase.com/dashboard/project/mlabstdxxwjdpfaxiwmg/auth/providers), puis activer Google et sauvegarder.
7. Tester avec un compte Google distinct sur le site. Si Audience = Testing, ajouter son email comme utilisateur test dans Google Auth Platform.

## Apple pour le site Web
**Prérequis :** compte Apple Developer approprié pour gérer Identifiers et Keys.
1. Ouvrir [Apple Developer — Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Créer/configurer l'**App ID** avec la capacité Sign in with Apple.
3. Créer un **Services ID** pour la version Web. Il doit être le **premier** des Client IDs dans Supabase si on ajoute plus tard un bundle iOS natif.
4. Dans les domaines / Website URLs du Services ID :
   - Domains : `mlabstdxxwjdpfaxiwmg.supabase.co`
   - Return URLs : `https://mlabstdxxwjdpfaxiwmg.supabase.co/auth/v1/callback`.
5. Générer la clé de signature privée Apple (`.p8`) et le secret client selon la procédure du tableau de bord, avec Team ID et Key ID.
6. Configurer **directement** [Supabase Authentication → Sign In / Providers → Apple](https://supabase.com/dashboard/project/mlabstdxxwjdpfaxiwmg/auth/providers) avec les valeurs de Services ID, secret, etc., et activer Apple.
7. Stocker le fichier `.p8` hors du dépôt; planifier la rotation du secret Apple au maximum chaque 6 mois. Apple ne transmet pas systématiquement le nom lors du login Web.

## Vérification
- Ouvrir `https://punch360app.github.io/Punch360/` dans Chrome ou Safari.
- Vérifier la présence des deux boutons en bas du formulaire.
- Lorsque le fournisseur est désactivé, le site affiche un avis et empêche un faux démarrage.
- Cliquer sur le fournisseur activé et confirmer le retour sur l'application, avec création de compagnie si aucun abonnement/membre n'existe.
- Refaire les tests sur Android, iPhone, et ordinateur.

## Notes de sécurité
- Une clé `sb_publishable_...` est publique et peut être embarquée dans le navigateur. Un **Client Secret Google**, le **client secret Apple**, la clé privée Apple `.p8`, les tokens PAT Supabase et la `service_role` ne doivent JAMAIS être intégrés au JavaScript public, ni commités.
- **OAuth sign-in ne dispense pas de payer l'abonnement.** Le blocage des invitations à la sélection et au paiement du forfait reste à développer, sans compromettre la continuité des punchs existants.
- La page affiche uniquement l'accès réel aux compagnies de l'utilisateur, jamais une création automatique de rôle Admin/Boss à partir du login social.

## P0-D — Retour natif à froid et récupération de mot de passe (26 octobre 2026)

Le composant Expo `src/auth/AuthGate.tsx` gérait auparavant le retour OAuth PKCE seulement avec `Linking.addEventListener('url')`, reçu quand l'application est déjà active. Si Android/iOS ouvrait PUNCH depuis un état complètement arrêté via `punchapp://auth/callback?code=…`, le code à usage unique pouvait ne jamais être échangé. Le même problème affectait le retour du courriel de récupération du mot de passe.

Le correctif lit maintenant **les deux sources** : `Linking.getInitialURL()` au démarrage à froid et l'événement `url` en activité. La validation n'accepte que la cible exacte `punchapp://auth/callback`; un ensemble mémoire empêche qu'un même code PKCE soit échangé deux fois lors d'une course entre les deux sources. Les résultats d'échange échoués déclenchent une nouvelle tentative de connexion, jamais un réemploi silencieux du code. Le lien de récupération conservant `type=recovery` ouvre le formulaire uniquement si Supabase fournit une session vérifiée. Les codes d'autorisation ne sont ni logués ni persistés par cette logique.

- **Développé :** utilitaire pur TypeScript + branche AuthGate + tests de liens hostiles, app froide, double événement, récupération et réseau.
- **Testé :** tests Node simulés et TypeScript/CI à confirmer sur la PR; aucun OAuth externe ni appareil réel vérifié.
- **Déployé :** non démontré pour Android/iOS; nécessite build et distribution natifs, non une simple publication GitHub Pages.
- **Intervention externe :** enregistrer `punchapp://auth/callback` dans les URL de redirection Supabase autorisées, configurer les fournisseurs Google/Apple et tester ouverture à froid, reprise, lien expiré et récupération sur appareils iOS/Android. Ne fournir aucun secret dans GitHub.

Références : https://reactnative.dev/docs/linking et https://supabase.com/docs/guides/auth/native-mobile-deep-linking. Les rôles continuent de provenir exclusivement du serveur `company_members`; ce correctif n'accorde aucun accès d'entreprise.

## P0-C — Empêcher le retour d'un ancien espace après déconnexion (26 octobre 2026)

Les requêtes natives `getSession()`, lecture des memberships `company_members` et sauvegarde AsyncStorage sont asynchrones. Avant ce durcissement, une réponse reçue tardivement après une déconnexion, une autre connexion ou une modification de compagnie pouvait rétablir dans l'interface le rôle/nom du mauvais espace. Même si RLS reste l'autorité pour les opérations serveur, cela constitue un risque de confidentialité sur le téléphone.

Le composant `AuthGate.tsx` utilise maintenant une **révision d'identité** : chaque chargement en démarre une nouvelle; chaque événement Auth invalide les précédents immédiatement. Les chemins réseau, hors ligne, membership et choix d'espace vérifient la révision avant d'appliquer les données; les anciennes erreurs ne remplacent pas l'état du nouvel utilisateur. Sur `SIGNED_OUT`, la vue et la session sont vidées immédiatement et aucun rechargement du cache hors ligne n'est déclenché par cet événement. La sélection manuelle d'une entreprise effectue les mêmes contrôles d'obsolescence.

- **Développé :** logique native de révision de session et gardes après `await`, sans changement des tables, rôles, invitations, JWT ni de la Construction.
- **Testé :** garde structurelle automatisée TypeScript/AST et tests logiciels CI à confirmer. La vraie concurrence de deux comptes et le hors-ligne sur appareil restent à recetter.
- **Déployé :** non prouvé sur build Android/iOS signé; la fusion GitHub ne démontre pas le déploiement natif.
- **Intervention externe :** tester déconnexion pendant chargement, changement rapide de compte, choix entre deux compagnies, coupure réseau et redémarrage du téléphone, en s'assurant qu'aucune donnée d'ancien employeur ne s'affiche.
