> Historique du premier lot. Les blocages d’accès cités ci-dessous sont résolus. État actuel : [ESSENTIAL_PROGRESS_20261024.md](ESSENTIAL_PROGRESS_20261024.md).

# Essentiel — audit et premier lot du 24 octobre 2026

## Références officielles

Les sept fichiers reçus sont préservés dans `docs/design/essential-2026-10-24/` : six maquettes de structure et une planche des thèmes 11–20. La planche des thèmes 1–10 n'est pas présente dans les pièces jointes de ce lot. Ne pas inventer ces références ni déclarer les vingt thèmes livrés.

Palette : fond #FAFBF8, sauge #779574, texte #2F4935, contour #E1E8DB. Les quatre espaces Employé/Admin/Boss/Super Admin restent distincts. Les chiffres des maquettes sont fictifs.

## Audit du dépôt consulté

Commit source : cc518d5. Documentation consultée : SPEC_COMPLETE, IMPLEMENTATION_STATUS, REQUIREMENTS_AUDIT, BILLING et ESSENTIAL_MIXED_PUNCH_SPEC. Inspection des interfaces Web, du catalogue TypeScript, des tests et du schéma d'invitations existant. Cet audit initial n'est pas une revue exhaustive de toutes les migrations.

| Domaine | Présent dans le dépôt | À réaliser/vérifier |
|---|---|---|
| Punch et pauses | moteur partagé, journal mobile, UI Web/Expo | régression SQL réelle et essais appareils |
| Gestion | corrections, approbations, horaires, congés, CSV, fermeture | horaires rotatifs, départements et rôles délégués |
| Identité | membres attachés à Auth; invitations email vérifié | salarié stable sans Auth, liaison sûre au dossier |
| Borne | spécification | appairage, NIP, contrôle d'accès, moteur mixte et hors ligne |
| Commercial | calcul de devis, politique de sursis | catalogue serveur versionné, Super Admin, contrats, Stripe |
| Thèmes | interface sauge existante | catalogue réel 20 thèmes et synchronisation |
| SMS | adaptateur serveur testé dans ce lot | outbox durable, endpoint autorisé, quotas, callbacks persistés, déploiement |

Aucun SQL appliqué ni état de production vérifié dans ce lot : le connecteur Supabase a renvoyé `Unknown tool`. GitHub est lisible par clone public, mais le connecteur GitHub a renvoyé `Unknown tool` et le push Git requiert des identifiants absents.

## Code ajouté

- Trois graines de forfaits Essentiel : 19/39/69 CAD, 5 personnes, +3/4/5 CAD, bornes 1/3/illimitées et établissements 1/1/illimités. Construction conservé.
- Calculs en cents : valeurs invalides/NaN/dépassements refusés; tests des bases annuelles 193,80/397,80/703,80 et des sièges 30,60/40,80/51,00.
- Adaptateur Twilio serveur : consentement, configuration, HTTPS, E.164, interdiction d'envoi réel en environnement test ou compagnie test, erreurs sans données du fournisseur, résultat ambigu distinct pour éviter les doublons.
- Validation HMAC des callbacks; pas de régression des statuts terminaux. Une acceptation par Twilio n'est jamais traitée comme livraison ni activation.

Le catalogue ajouté décrit les droits commerciaux souhaités, **pas des fonctionnalités déjà livrées**. Il n'est pas utilisé comme source publique définitive et n'accorde aucun droit serveur.

## Twilio — configuration à prévoir côté serveur

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_STATUS_CALLBACK_URL`, activation explicite SMS et environnement production. Aucun secret dans Expo/Web, aucun secret dans Git.

Documentation fournisseur consultée : https://www.twilio.com/docs/usage/security

Avant branchement de l'adaptateur :
1. Créer une invitation liée au salarié stable et vérifier compagnie, rôle, forfait et consentement côté serveur.
2. Insérer un envoi dans une outbox privée avec clé d'idempotence et limites d'envoi par compagnie/destinataire.
3. Réserver atomiquement un envoi avant appel fournisseur; ne pas rejouer automatiquement les résultats inconnus.
4. Exposer un callback vérifié avec URL publique configurée, vérification AccountSid et correspondance du MessageSid; conserver les événements et transitions atomiques.
5. Contrôler les accès opérationnels et les journaux par RLS. Aucun accès aux secrets d'invitation depuis le navigateur.
6. Tester livraison et activation avec le compte Twilio configuré. Aucun vrai SMS envoyé pendant ces tests locaux.

L'adaptateur seul ne constitue pas une invitation automatique fonctionnelle. Aucun endpoint public d'envoi arbitraire n'est ajouté.

## Vérification exécutée

`npm ci`, `npm run check`, `npm test` : 18 tests passés, dont 9 nouveaux tests facturation/Twilio. Les appels Twilio sont simulés par injection de transport; aucun compte fournisseur utilisé. Pas de build/exécution Android/iOS/iPad, pas de test Stripe ou SQL réel. Aucun déploiement.

## Prochaine dépendance structurante

Migrer les identités et le registre existants vers un salarié stable sans perdre les heures avant de relier borne et activation personnelle. Préparer les migrations sur une base de test puis exécuter les scénarios RLS/concurrence; ne pas modifier la production à l'aveugle. Ensuite catalogue serveur versionné/Super Admin, outbox d'invitations, interfaces conformes, Stripe et tests appareils.
