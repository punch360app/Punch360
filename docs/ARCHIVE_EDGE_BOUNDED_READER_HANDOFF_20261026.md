# Transmission technique — lecture des PDF Storage avec limite réelle

**26 octobre 2026 — issue #81, suite du prompt « Validation SQL archives ».**

## État

Le module `supabase/functions/company-archive-files/limited-reader.mjs` est développé et couvert par les tests automatisés `tests/archive-limited-reader.test.mjs`. **Il n'est pas importé par `handler.mjs` et la fonction Edge déployée ne bénéficie pas encore de cette protection.** Ce lot est volontairement gardé comme PR de préparation à la revue, sans déclaration de correction en production.

Une précédente tentative de modification directe de `handler.mjs` via l'intégration GitHub a été refusée par un contrôle de sécurité. Il ne faut ni contourner ce contrôle, ni affirmer que l'issue #81 est corrigée.

## Contrat du composant

`readBoundedStorageResponse(response)` accepte un objet `Response` et renvoie les octets sous forme de `Uint8Array`. Il :
- refuse tout `Content-Length` déclaré supérieur à 25 Mio avant le transfert;
- **compte les octets reçus réellement**, même en l'absence d'en-tête ou lorsque l'en-tête ment;
- interrompt le flux, libère son verrou et lève une erreur contrôlée `DOCUMENT_TOO_LARGE` dès le dépassement;
- alloue un tampon agrandi progressivement, **jamais au-delà de 25 Mio** pour les octets de charge utile;
- neutralise les erreurs brutes de lecture en `DOCUMENT_READ_FAILED`;
- garde les octets identiques pour les calculs SHA-256 existants.

## Intégration restante à faire sous revue autorisée

Dans le code original `company-archive-files/handler.mjs` :

1. Importer le lecteur testé.
2. Remplacer **les deux** lectures Storage de type `new Uint8Array(await response.arrayBuffer())` (téléchargement et vérification d'un objet existant) par le lecteur borné.
3. Mapper uniquement `StorageReadError.code === 'DOCUMENT_TOO_LARGE'` en réponse HTTP **413** `DOCUMENT_TOO_LARGE`; mapper les autres erreurs sans exposer de détails.
4. Garder intégralement les revalidations de contexte, signatures, hashes, version du document, droit Boss/Super Admin et `x-upsert: false`.
5. Ajouter une vérification intégrée qui prouve qu'aucune signature ou écriture Storage n'est effectuée lorsque le flux dépasse la taille réelle autorisée, sans `Content-Length` ou avec un chiffre mensonger.
6. Après CI et revue, déployer **uniquement** la fonction officielle du projet `mlabstdxxwjdpfaxiwmg` puis réaliser une recette avec un PDF synthétique. Ne pas toucher aux documents clients.

## Tests préparatoires

Le test Node `archive-limited-reader.test.mjs` couvre l'acceptation à 25 Mio pile, le refus de 26 Mio sans en-tête, le refus d'un corps supérieur malgré un en-tête trop petit, le refus précoce d'un en-tête trop grand, une réponse binaire exacte, des limites invalides et une erreur réseau masquée.

**Statuts** : composant développé; tests CI à suivre; **intégration au handler : non**; **déploiement Edge : non**; **issue #81 : ouverte**. Le prompt maître est séparé; SMS/Twilio reste dernier.
