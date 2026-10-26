# Récupération de mot de passe dans Expo — PUNCH 360°

## Objectif
Permettre à un Boss, Admin, chef ou employé ayant perdu son mot de passe **courriel** de récupérer lui-même son compte dans Android ou iOS. L'administrateur PUNCH ne lit, ne reçoit et ne peut jamais retrouver le mot de passe existant; Supabase Auth conserve la vérification d'identité.

## Parcours
1. Sur la connexion Expo, cliquer « Mot de passe oublié ? », saisir son courriel et demander le lien.
2. `supabase.auth.resetPasswordForEmail` demande à **Supabase** l'envoi d'un lien pour `punchapp://auth/callback?type=recovery`. L'interface utilise un message générique, même pour un compte inexistant.
3. Après ouverture du lien, le callback PKCE `exchangeCodeForSession` doit réussir, ou l'événement Auth `PASSWORD_RECOVERY` doit confirmer la récupération. **Un simple paramètre URL ne donne pas de permission.**
4. Afficher un formulaire protégé (nouveau mot de passe + confirmation) uniquement après récupération authentifiée et présence d'une session.
5. `supabase.auth.updateUser({password})` met à jour l'identité du **titulaire**; jamais une API Admin ou un changement arbitraire d'UUID.
6. Vider les champs, supprimer le cache local de compte, fermer les sessions Supabase par `signOut({scope:'global'})` et demander une nouvelle connexion.
7. Les jetons d'accès émis avant la fermeture peuvent rester valides jusqu'à leur échéance; ne pas promettre une révocation immédiate des JWT. Les opérations sensibles doivent revérifier la session serveur (déjà utilisé pour Super Admin).

## Pré-requis / recette terrain
- Le schéma `punchapp` est déclaré dans `app.json`.
- Ajouter **exactement** `punchapp://auth/callback` et `punchapp://auth/callback?type=recovery` aux URL de retour autorisées Supabase, selon les règles du fournisseur.
- Configurer une livraison de courriel de production avant de tester sur Android/iPhone signés (Expo Go n'est pas une preuve suffisante du deep link de l'application publiée).
- Tester lien valide, déjà consommé, expiré, compte inexistant, mot de passe non conforme, Google/Apple sans mot de passe local et panne réseau.
- Les comptes Google et Apple doivent aussi pouvoir se reconnecter avec leur fournisseur. Cette récupération ne change pas leur mot de passe Google/Apple.

## Différence avec la succession d'entreprise
Ce parcours sert à **récupérer son propre compte Auth**. Il ne transfère pas la propriété d'une compagnie et n'autorise pas un Super Admin à agir à la place d'un Boss. Une procédure séparée avec consentement des administrateurs légitimes est nécessaire pour une succession de Boss, afin de ne pas créer de faille de prise de contrôle d'entreprise.

Cette livraison appartient au prompt original **« Validation SQL archives »**. Le prompt maître consolidé reste indépendant.
