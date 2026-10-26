# PUNCH 360° — prévalidation des archives côté navigateur (26 octobre 2026)

**Prompt d'origine : « Validation SQL archives ».** Suite à la PR #80 (parcours PDF binaire synthétique, confidentialité au bouton Fermer). Ce lot ne démarre pas le prompt maître.

## Développement

- `web/live/archive-preflight.js` assemble les blocs de l'export sans concaténation répétée ni écriture en cache, avec un **maximum de 4 096 blocs** et **20 Mio de contenu UTF-8** (même limite que `archive-codec.js`). Le nombre de blocs est validé avant le premier appel SQL. Un bloc nul/vide ou une limite atteinte interrompt les téléchargements supplémentaires; une validation exacte UTF-8 finale tient compte des caractères multioctets coupés entre deux blocs.
- `web/live/archives.js` appelle ce précontrôle entre `company_export_create` et `JSON.parse`, vérifie que les métadonnées de document annoncent une taille entière positive ou nulle au plus égale à 25 Mio **avant** les appels à l'Edge Function; toute erreur entraîne le nettoyage habituel des contextes temporaires.
- Les erreurs de `company-archive-files` s'affichent sous forme d'une phrase générique contrôlée, sans recopier de texte/trace SQL ou Storage inattendu. La restauration, la vérification de signature, les droits et les documents officiels restent entièrement gérés par les composants existants.
- `index.html` et `sw.js` renouvellent les ressources Web et incluent explicitement `archive-preflight.js` dans le cache applicatif (aucune archive n'y est stockée).

## Preuves de tests

`tests/archive-preflight.test.mjs` couvre :
1. Entête invalide (zéro, négatif, fractionnaire, non numérique, > 4 096) refusé sans appel RPC de bloc.
2. Bloc absent et volume cumulé trop gros refusés sans appeler les blocs suivants.
3. Exactitude du nombre d'octets UTF-8 lorsqu'une paire de substitution Unicode est scindée.
4. Refus, nettoyage de l'export temporaire, absence de téléchargement et effacement du mot de passe quand l'entête est invalide.
5. Refus des tailles PDF non entières, incohérentes ou > 25 Mio avant l'appel Edge.
6. Refus de la fonction PDF avec un texte d'erreur serveur fictif sensible : seul un message neutre est montré, et l'export temporaire est supprimé.

La suite Node/DOM et TypeScript de la branche doit être verte avant fusion.

## Limites et dépendances restantes

Les nouveaux plafonds sont **côté navigateur** : ils ne corrigent **pas** la lecture non bornée de réponses Storage via `arrayBuffer()` dans `company-archive-files/handler.mjs` (issue #81). Le gestionnaire Edge doit appliquer une limite effective aux octets reçus sans confiance à `Content-Length`, puis être redéployé après revue.

Le projet Supabase officiel `mlabstdxxwjdpfaxiwmg` a été inspecté **en lecture seule** le 26 octobre 2026 : fonction Edge `company-archive-files` active et travail cron `punch-expired-company-exports` actif. Les avis de sécurité signalent plusieurs `SECURITY DEFINER` publics et des tables RLS sans politiques; cela exige un audit des décisions d'autorisation, pas la suppression aveugle de permissions nécessaires.

**Pas encore effectué** : authentification Boss/Super Admin avec un vrai compte de test, upload/restauration d'un PDF fictif sur le vrai Storage, essais concurrents et sans `Content-Length`, plan de reprise d'infrastructure (PITR + Storage), QA appareils et fournisseurs Stripe/OAuth. Aucun PDF ou compte réel touché par ce lot; aucune migration SQL ni déploiement Edge. SMS/Twilio demeure le dernier bloc.
