# PUNCH 360 — Contrat serveur futur pour carte QR employé sur tablette commune

**Statut : contrat et garde-fous de développement, NON ACTIVÉ.** La PR #274 permet à la caméra intégrée de la tablette de lire localement un QR présenté par **l'employé** sur son téléphone/Apple Wallet/Google Wallet. Aucun code scanné ne devient un pointage aujourd'hui. Cette note ne remplace ni un audit indépendant ni les essais du véritable serveur.

## Frontières de confiance et parcours exigé

1. L'employé ouvre **sa** carte QR sur le téléphone. La tablette ordinaire **scanne la carte** avec sa caméra, sans NFC, lecteur matériel, QR affiché par la tablette, transfert à un autre appareil ou copie d'URL contenant un secret.
2. Le préfixe protocolaire proposé est `P360C1.` suivi de **64 chiffres hexadécimaux aléatoires** (32 octets CSPRNG côté serveur). Le contenu n'inclut **ni matricule, ni UUID de salarié, ni entreprise, ni autorisation, ni NIP**. Version à confirmer avant émission Wallet; ne créer aucune carte réelle sur cette seule base.
3. Le serveur doit lier la carte **à un seul travailleur stable, une seule entreprise et un téléphone enrôlé**. La carte est révocable immédiatement et renouvelée lors d'un changement d'appareil. Enregistrer uniquement un hash serveur de sa partie secrète; ne jamais l'écrire dans des logs, URL, notifications, traces, cache HTTP, IndexedDB ou dans le registre des heures.
4. **Une carte QR seule ne prouve pas la présence de son détenteur.** Une capture d'écran reste possible, notamment sur Apple Wallet. Pour V1, **exiger le NIP indépendant** après la lecture QR, avec les limites de tentatives existantes; ne pas inventer de contrôle anticapture iOS. Les protections Google Wallet éventuelles sont conditionnées au support de la plateforme.
5. La borne transmet uniquement au futur endpoint serveur autorisé, **après activation explicite de la capacité et vérification de sécurité**, un corps JSON POST sous TLS. Aucun mécanisme ne doit rediriger une copie de carte vers un domaine choisi par le QR. Le scanner actuel ne transmet **rien**, y compris au endpoint existant.
6. Le serveur ne se fie jamais à `companyId`, `workerId`, `role` ou `verified` fournis par la tablette. Il retrouve la compagnie et l'établissement depuis la borne appairée, le salarié depuis le **hash du jeton**, les droits et le statut depuis la base autoritaire, et vérifie le NIP séparément.
7. Une validation QR expirée, révoquée, liée à une autre compagnie, à un autre téléphone ou à un employé non autorisé retourne un **refus neutre**, jamais « utilisateur trouvé » ni le nom d'un autre salarié.

## Format candidat, pas encore branché à une API

- `qr_identify`: `{action, deviceId, token, cardCode, pin}`. Retour métier envisagé : uniquement état minimal du salarié autorisé, sans historique ni données privées.
- `qr_execute`: mêmes champs, plus `eventId` UUID et `eventAction` dans `in|out|break_start|break_start_paid|break_end`. Les événements conservent **l'idempotence** du registre de pointage existant.
- `supabase/functions/essential-kiosk/qr-contract.js` valide la forme de cette enveloppe et les conditions requises sur **preuves de confiance déjà obtenues**. Cette vérification **n'authentifie ni la carte, ni la borne, ni le NIP** et **n'autorise aucune écriture**. Le module est indépendant de la fonction déployée et peut être révisé avant intégration.
- L'Edge Function actuelle `essential-kiosk/index.ts` refuse toujours `qr_identify` et `qr_execute` puisqu'elle n'accepte que matricule + NIP. Ce refus constitue une barrière volontaire jusqu'à la disponibilité d'un registre QR et d'une transaction complète.

## Transaction SQL à concevoir et faire auditer avant tout raccordement

Le schéma actuel inclut `private.kiosk_devices`, `private.worker_pin_secrets`, `private.kiosk_events`, `public.company_workers`, `public.punch_sessions` et les segments. Il **n'existe pas de registre de cartes QR** dans la portée vérifiée. Ne pas contourner la fonction existante `kiosk_execute` en substituant un matricule extrait d'un QR.

La nouvelle opération de base, idéalement dans un schéma `private` non exposé, devra effectuer **dans une seule transaction** :

1. Vérifier l'appairage de la borne, son jeton, son établissement, son verrou temporaire, la politique de pointage active et l'entreprise Essentiel autorisée. Refuser borne révoquée, inconnue, hors limite ou autre entreprise.
2. Vérifier le hash du jeton opaque de carte, son rattachement **à la compagnie de la borne** et au `worker_id`, son statut/expiration et son **téléphone enrôlé et non révoqué**. Une révocation doit être visible pour toute action suivante; renouveler le secret à chaque réenrôlement.
3. Vérifier un **NIP distinct** avec dérivation lente, état de blocage, compteurs résistants aux tentatives répétées et journal d'échec minimal. Les erreurs ne doivent pas permettre l'énumération des salariés ou cartes.
4. Verrouiller les lignes sensibles et réutiliser la logique de verrouillage par travailleur/entreprise et l'unicité d'une session ouverte, de manière compatible avec le pointage mobile et la borne NIP. Vérifier les politiques de pauses et périodes fermées.
5. Pour `qr_execute`, vérifier **et consigner le même `eventId`** au sein de la transaction. Réessai identique retourne le résultat conservé; réemploi de l'ID avec travailleur, appareil ou action différent retourne un conflit. Ne jamais créer une deuxième session sur des appels concurrents.
6. Écrire l'événement et l'audit *sans* stocker QR, NIP, jeton d'appareil ou hash de secret dans les réponses/extractions usuelles. Renvoyer un accusé à l'heure **serveur**, uniquement après commit.
7. Restreindre `EXECUTE` aux rôles internes nécessaires; éviter de publier une `SECURITY DEFINER` sans restrictions dans le schéma `public`. Activer RLS et retirer les grants API aux nouvelles tables privées. Vérifier de façon reproductible qu'une session mobile ne peut pas appeler la procédure privilégiée.

L'architecture et l'implantation doivent être approuvées avec les experts Sécurité, Supabase et MOON/BOSS. **Pas de migration SQL ou RPC de pointage QR créé par cette étape**, pas de déploiement automatique, et aucune lecture/écriture sur des données clients.

## Recette obligatoire avant activation

| Scénario | Résultat attendu |
| --- | --- |
| Carte valide + NIP valide, borne et compagnie correspondantes | État minimal ou unique événement validé serveur |
| QR seul ou NIP vide/erroné | Aucune identification et aucune heure |
| Capture ou carte copiée sans NIP | Refus |
| Ancien QR après changement de téléphone | Refus et ancien secret révoqué |
| QR d'entreprise B sur borne entreprise A | Refus sans nom, existence ni donnée de B |
| Borne révoquée / mode borne désactivé | Refus même avec carte et NIP corrects |
| Salarié désactivé / téléphone désenrôlé | Refus |
| Deux pointages `IN` simultanés, téléphone et tablette | Une seule session |
| Double soumission du même `eventId` | Une seule écriture, même reçu |
| Réutilisation d'`eventId` avec autre action ou appareil | Refus |
| Réseau coupé / réponse ambiguë | Ne pas affirmer « enregistré » sans reçu serveur; ne pas émettre de pointage QR provisoire à partir d'une capture |
| Caméra fermée / onglet caché / scan bloqué | Pistes vidéo arrêtées; aucun secret conservé |

**Blocages actuels :** ni émission Apple/Google Wallet ni modèle de téléphone enrôlé ni hash QR révocable ni RPC atomique QR, ni recettes réelles Android/iPad/iPhone. Les tests de forme et les tests synthétiques de caméra ne remplacent pas ces livrables.
