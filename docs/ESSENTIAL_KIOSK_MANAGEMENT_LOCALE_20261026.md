# PUNCH Essentiel — page de gestion des bornes en 10 langues

**26 octobre 2026 — troisième lot de cette reprise du prompt original « Validation SQL archives ».**

## Périmètre livré

La page « Bornes de pointage » accessible au Boss/Admin dans `web/live/essential.js` reprend la langue du compte Essentiel et la même table `LOCALE_STRINGS`. Vingt nouvelles clés couvrent appairage, libellés de nom/site, création du code 10 minutes, statuts de la tablette, dernière connexion, lien d'ouverture/copie, inactivité, révocation et rappel de sécurité hors ligne.

Le rendu n'altère pas les identifiants de bornes ni les adresses de PWA, et échappe toutes les données venant des salariés/tablettes. Les horodatages restent lisibles avec `<bdi dir="ltr">` en arabe RTL. Le lien public de la borne reste fixe et sans code secret; le code d'appairage n'est affiché que dans le champ existant. Le mode et la durée d'inactivité restent des actions côté serveur existantes.

## Tests ajoutés

`tests/essential-kiosk-management-locale.test.mjs` : inventaire des 20 clés dans 10 langues, affichage dynamique anglais/arabe, numéros/dates en LTR, échappement du nom de borne, absence du code d'appairage dans toute URL et présence des actions appairer, copier, inactivité et révoquer dans toutes les langues.

CI GitHub Node/DOM/TypeScript, puis déploiement GitHub Pages, à relever après exécution. PWA : `app.js?v=essential-46`, cache `punch-360-essential-v41`.

## Sécurité et limites

Aucune migration, modification des contrats, suppression de clients ou mise à jour des NIP. Les traductions humaines et l'accessibilité sur petits écrans/tablettes iPad/Android/RTL doivent être validées physiquement avant de déclarer une livraison internationale. Les modules RH/paie/Super Admin spécialisés restent partiellement traduits.

La recette complète du prompt original reste ouverte : archives PDF authentifiées avec Storage et mot de passe, concurrence/charge et restauration d'infrastructure, fournisseurs Stripe sandbox/OAuth/SMTP, notifications réelles, builds signés et QA terrain. SMS/Twilio en dernier. Le prompt maître demeure distinct.
