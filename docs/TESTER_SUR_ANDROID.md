# Tester PUNCH 360° sur ton Samsung (sans ordinateur)

> **Version de développement**, réservée aux essais. Les heures enregistrées sur Supabase peuvent être réelles, mais ce produit n'est **pas validé pour la paie**. Utiliser des comptes et des données fictifs pendant les tests.

## Sur ton téléphone

1. Installe **Expo Go** pour **SDK 57** depuis [expo.dev/go](https://expo.dev/go?platform=android&sdkVersion=57). Si la version Play Store convient à SDK 57, tu peux l'utiliser. Sinon, télécharge la version Android compatible depuis Expo.
2. Dans **Chrome** (plutôt que l'app GitHub), ouvre [punch360app/Punch360](https://github.com/punch360app/Punch360) connecté à ton compte `punch360app`.
3. Sur GitHub : **Code → Codespaces → Create codespace on main**. Si le bouton est absent sur mobile, active **Site pour ordinateur** dans le menu Chrome.
4. Dans Codespaces, attends la fin de l'installation automatique (« postCreateCommand »). Pour ouvrir le terminal : menu **☰ → Terminal → New Terminal** (ou **View → Terminal**).
5. Colle cette commande dans le terminal :

```bash
npx expo start --tunnel --go
```

6. Une fois la ligne **exp://...** affichée dans le terminal, copie cette URL. **Sur le même Samsung**, ouvre ce lien via Android pour lancer Expo Go. Si le lien n'est pas cliquable, utilise Expo Go pour ouvrir le lien du projet ou affiche le QR sur un autre écran pour le scanner.
7. L'application s'ouvre sur la connexion PUNCH. Pour le premier essai, utilise **courriel / mot de passe** (Google/Apple ne sont pas encore configurés dans Supabase).
8. Crée une compagnie de test, ouvre **Plus → Gérer les chantiers** et crée une job fictive. Teste **Accueil → Job en cours → Toutes les jobs** et les onglets. **Ne pointe pas de vraies heures** avant la validation de la paie.

## Si tu vois un problème
- « SDK incompatible » : installe Expo Go **SDK 57** spécifiquement.
- « Tunnel » absent : dans le terminal exécute `npm install --global @expo/ngrok`, puis relance la commande.
- « Waiting for exp... » : attends l'URL exp:// et vérifie que Codespaces est actif.
- Une erreur rouge dans l'application : copie le message ou fais une capture pour corriger le code.
- Map ou GPS qui ne s'affiche pas : accepter la localisation **uniquement pendant l'utilisation** et vérifier les permissions Android.

## Ce qui n'est pas prêt
Google/Apple OAuth, Stripe, envoi réel des invitations, photos de carte CCQ, PDF et catalogue de matériel complet, rapports de paie, fonctionnement hors-ligne, traductions, et application APK autonome. Un test Expo Go/TypeScript ne garantit pas le bon fonctionnement de tous les modules.

## Résultat attendu
Tu peux voir l'interface mobile, te connecter par courriel, créer une compagnie de test et un chantier, puis essayer le flux de l'application. Tant que Codespaces et le serveur Expo restent actifs, le téléphone peut charger la version de développement.
