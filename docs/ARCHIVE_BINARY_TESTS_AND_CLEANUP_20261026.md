# PUNCH 360° — recette d'archives binaires fictives et fermeture confidentielle

26 octobre 2026 — suite du prompt original **« Validation SQL archives »**. Le prompt maître demeure distinct.

## Couvert par ce lot

1. **Parcours binaire intégré et synthétique** : le même test connecte le contrôleur `archives.js`, le codec chiffré, le gestionnaire Edge `company-archive-files/handler.mjs`, des RPC simulées et un Storage **en mémoire**. Il produit deux blocs de données, télécharge le PDF en octets, chiffre l'archive `.punch`, la déchiffre en mémoire, détecte le PDF supprimé du Storage fictif, réalise la prévisualisation sans écriture, récupère le binaire par un POST sans écrasement, puis valide le plan et la restauration simulée des lignes. Il confirme le nettoyage des contextes temporaires et l'absence de mot de passe conservé. Test : `tests/archive-binary-flow.test.mjs`.
2. **Mot de passe invalide** : le codec refuse le déchiffrement, aucun appel d'import serveur et aucun envoi Storage ne sont déclenchés.
3. **Bouton Fermer sécurisé** : même si le nettoyage à distance échoue, les données déchiffrées, pièces jointes, plans et résumés sont effacés de la mémoire UI. Seuls les identifiants opaques de copies temporaires sont conservés pour pouvoir réessayer. Si la découverte des copies échoue, le contrôleur ne prétend plus avoir fini son nettoyage. Test : `tests/archive-cleanup-failure.test.mjs`.
4. **Erreurs SQL masquées** : l'interface d'archives n'affiche plus au Boss les détails internes bruts des erreurs `sb.rpc`.

## Limites explicites : ne pas assimiler à une certification d'archives

Le test intégré utilise un faux compte Auth, de faux résultats RPC et un Storage synthétique. Il **ne constitue pas** une recette réelle du projet Supabase officiel, de ses politiques d'accès ni du réseau de production; aucune donnée client n'est modifiée. Les tests SQL transactionnels et les contrôles d'ACL précédents demeurent des preuves distinctes.

**Point technique restant à corriger dans Edge** : les branches de téléchargement et de comparaison d'un PDF existant lisent actuellement une réponse Storage via `arrayBuffer()` après vérification de l'en-tête `Content-Length`. L'en-tête peut être absent ou incorrect; un flux plus volumineux que 25 Mo pourrait être chargé en mémoire. Prévoir une lecture en flux avec limite réelle de 25 Mo par réponse et une régression qui simule un en-tête absent ou mensonger. Une tentative de modification directe de ce gestionnaire par l'outil GitHub a été bloquée par des contrôles de sécurité; **aucune correction de ce point n'est revendiquée comme appliquée** dans le présent lot.

Autres validations manquantes : PDF fictif authentifié via navigateur/Storage/Edge réels, test d'une session Boss et Super Admin, restauration dans un environnement isolé autorisé, collision réelle de PDF, mesure de charge et de concurrence, sauvegarde PostgreSQL/PITR et stockage externe, Stripe sandbox, Google/Apple/SMTP, QA Android/iPhone/iPad. SMS/Twilio à la fin.

## Livrables

`tests/archive-binary-flow.test.mjs`, `tests/archive-cleanup-failure.test.mjs`, ajustements ciblés de `web/live/archives.js`, cette documentation et le checkpoint dans `docs/PUNCH_WORK_CONTINUATION.md`.

- **Développé** : oui, tests et protections de fermeture UI.
- **Testé** : suite CI Node/DOM/TypeScript sur la branche, à relever après résultat final.
- **Déployé** : à vérifier après PR + CI et publication Pages. Aucun changement Edge ou migration SQL dans ce lot.
- **Intervention externe** : requise pour les essais réels et la gestion opérationnelle de sauvegardes/PITR.
