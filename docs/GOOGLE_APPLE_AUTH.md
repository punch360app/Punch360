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
