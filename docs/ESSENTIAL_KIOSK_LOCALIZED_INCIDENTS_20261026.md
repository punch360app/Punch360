# PUNCH Essentiel — messages de sécurité de la borne en dix langues (26 octobre 2026)

## Portée et décision

Ce lot prolonge le prompt **« Validation SQL archives »** après la PR #74 de langues de la borne. Il n'ajoute aucun privilège SQL, ni aucun nouveau mécanisme de pointage. L'interface reprend les dix langues (FR, EN, ES, PT, IT, DE, AR, ZH, HI, TL) pour **15 catégories de refus et d'incidents** de la borne.

## Développé

- Réponses codées de l'Edge Function `essential-kiosk` : appareil/identité refusé, trop de tentatives, NIP faible, session déjà ouverte/absente, action refusée. Les messages sont choisis par **code connu**, jamais en affichant une chaîne arbitraire du serveur.
- Edge `essential-kiosk-offline` : identité ou autorisation expirée/révoquée, horloge invalide, ordre et duplication de journal, lot déjà traité. Les observations provisoires **ne sont pas effacées**, même si le texte est traduit.
- Incidents locaux : horloge, NIP non concordant, journal local indisponible, contradiction de politique de pause, reprise idempotente de la même opération, réseau intermittent. Les erreurs inconnues deviennent un refus générique traduit, sans exposer un message interne de diagnostic.
- La règle déjà présente est conservée : retour automatique au **français** après la session; aucun choix de langue n'est attaché à un salarié. Les NIP et identifiants ne sont pas mémorisés comme préférence.
- `kiosk.html` utilise les actifs `essential-43`, et le Service Worker emploie un nouveau cache `punch-360-essential-v38` pour actualiser le vocabulaire et le code PWA.

## Validation

- `tests/kiosk-error-localization.test.mjs` : 15 clés non vides dans chacune des 10 langues; simulation des refus serveur DEVICE_DENIED et CHAIN_CONFLICT sans divulgation des champs privés; rendu traduit d'un incident d'horloge et refus générique des diagnostics inconnus; l'anglais conserve « résultat non confirmé » et « même action ».
- Régression `tests/kiosk-locale.test.mjs`, `tests/kiosk-ui.test.mjs` et `tests/kiosk-offline-ui.test.mjs` dans la CI GitHub.
- Aucun paiement, migration, SMS ni mutation de données client pour cette PR.

## Limites et interventions externes

Traductions à relire par humains natifs et avec des intervenants RH/juridiques; certaines phrases hors des incidents (état, politiques de pause, messages footer, écrans de gestion des observations par Boss/Admin) ne sont pas encore couvertes. Il faut encore tester l'affichage long, les textes RTL et la bascule réseau sur véritables tablettes Android et iPad, et valider la restitution et la synchronisation réelles.

**Statuts :** développé (code de cette branche); testé (CI à vérifier); déployé (non jusqu'à fusion + GitHub Pages); intervention externe requise (linguistique + appareils). Le prompt maître demeure séparé, et SMS/Twilio est l'ultime étape.
