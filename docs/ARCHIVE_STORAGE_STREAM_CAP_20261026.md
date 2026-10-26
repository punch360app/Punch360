# Archives PDF — lecture Storage bornée à 25 Mo (26 octobre 2026)

Ce correctif clôt le défaut de mémoire documenté dans l'issue #81 du **prompt original « Validation SQL archives »**. Le prompt maître demeure séparé.

## Cause
Le gestionnaire Edge `company-archive-files/handler.mjs` utilisait `Response.arrayBuffer()` après contrôle de `Content-Length`, qui peut être absent ou mensonger. Un objet Storage de taille excessive pouvait alors remplir la mémoire de la fonction avant d'être rejeté.

## Correctif
- Les deux branches critiques, téléchargement et comparaison d'un PDF déjà présent pendant une prévisualisation/restauration, utilisent maintenant `readStorageBounded(response)`.
- Le lecteur `Response.body.getReader()` compte les **octets réels reçus**, borne les segments retenus à 25 × 1024 × 1024 octets, annule le flux au premier excès et libère le verrou du lecteur.
- Même lorsque l'en-tête annonce une taille excessive, la réponse est annulée sans lire les octets.
- Dépassement : `413 DOCUMENT_TOO_LARGE`. Aucun hash de preuve, aucune signature du téléchargement et aucun envoi de restauration n'est produit.
- Les autres invariants sont conservés : session et rôle vérifiés côté serveur, contexte et snapshot, PDF privé, hash SHA-256, signature, anti-écrasement `x-upsert: false`, isolation par entreprise. Aucune politique RLS ou migration SQL modifiée.

## Vérification
Fichier : `tests/archive-storage-stream-limit.test.mjs`, avec trois comportements malicieux simulés : 26 Mo sans longueur, longueur mensongère de 1 octet sur la prévisualisation, et longueur annoncée supérieure à 25 Mo. Un quatrième test vérifie qu'un flux de **25 Mo exactement** est accepté sans troncature. Le flux normal d'un PDF et la restauration fictive restent couverts par `tests/archive-binary-flow.test.mjs`.

**Limites :** tests réseau/Storage synthétiques, non recette avec de vrais comptes Boss et deux appareils. Le service Edge doit être déployé exclusivement sur `mlabstdxxwjdpfaxiwmg`, avec `verify_jwt` et configuration existantes préservées; contrôler la version et les réponses avant de déclarer l'incident clos. Ne pas utiliser les PDF de clients pour les essais.
