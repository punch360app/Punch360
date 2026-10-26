# PUNCH Essentiel — borne : messages de session et politiques de pauses localisés

**26 octobre 2026 — suite exclusive du prompt original « Validation SQL archives ».**

## Livré dans ce lot

Le sélecteur existant de 10 langues est maintenant utilisé pendant **tout l'écran de session** de la borne, plutôt que seulement dans les boutons :

- Salutation avec nom salarié affiché en texte HTML échappé.
- L'état **provisoire et conservé localement** lorsque la borne ne dispose pas de réseau, distinct du pointage confirmé par le serveur.
- Message d'horodatage serveur quand l'opération n'est pas encore enregistrée.
- Politique de pauses payées ou non payées déterminée par les droits réels du département.
- Nombre d'observations provisoires et rappel explicite d'approbation par le responsable.
- Libellé du choix de langue et notices de succès appairage / activation NIP / enregistrement et synchronisation.

Les 11 nouvelles clés sont présentes dans les dix dictionnaires (FR/EN/ES/PT/IT/DE/AR/ZH/HI/TL), intégrés sans créer un second système de traduction. Le contenu dynamique (nom, compteur) n'est **jamais** injecté sans échappement. Le compteur vient du journal déjà calculé; il ne crée ni nouvel état serveur ni nouveau pointage.

## Retour à l'accueil et confidentialité

Les réussites mettant fin à une opération appellent désormais `clearPerson('clé')` : effacement de la personne, du matricule, du NIP, de l'identité hors ligne et de la session provisoire, **retour au français**, puis texte de réussite traduit en français. Ce comportement est volontaire sur la borne partagée, y compris si la personne utilisait une autre langue. La préférence linguistique n'est toujours ni sauvegardée ni associée au salarié.

Le moteur serveur, l'idempotence et la réconciliation ne sont pas modifiés. Une observation hors ligne reste provisoire jusqu'à l'approbation; aucune session n'est réputée terminée grâce à une simple traduction.

## Preuves et tests

- `tests/kiosk-session-locale.test.mjs` contrôle les onze clés dans chaque langue, la substitution du compteur, la politique et le statut hors ligne en anglais et arabe, le RTL et le nettoyage/retour français.
- Les régressions `tests/kiosk-locale.test.mjs`, `tests/kiosk-error-localization.test.mjs`, `tests/kiosk-ui.test.mjs` et `tests/kiosk-offline-ui.test.mjs` restent exécutées par la CI Node.
- Le script PWA passe à `essential-44`, le cache à `punch-360-essential-v39` ; aucune nouvelle bibliothèque ni migration SQL.

**Statuts :** développé sur la branche; testé/CI et déploiement à indiquer après vérification de GitHub; validation sur vrais appareils et relecture par locuteurs natifs restent indispensables.

## Encore ouvert dans le prompt original

Traductions spécialisées RH, paie, Super Admin, courriels, autres textes incidents dans les écrans de supervision; QA manuelle 10 langues et RTL tablette. Essais d'archives PDF binaires de bout en bout, charge/concurrence, PRA, Stripe sandbox, OAuth, builds signés et tests réels Android/iPhone/iPad. SMS/Twilio en dernier, conformément à la décision du propriétaire. Le prompt maître consolidé demeure séparé.
