# Reprise du travail PUNCH

Dernière reprise : 24 octobre 2026. Work courant : lot `feat/essential-hr-payroll`. Base distante inspectée : `5457a27` (guide collaborateur ajouté par un autre travail). Ce guide et le README doivent être conservés lors de la fusion.

## Livré dans le lot courant

Code Web/Expo pour documents RH privés/versionnés, délégations séparées Documents/Certifications/Rémunération, confirmations, renouvellements de certifications; annonces et notes de quart; alertes internes horaires. Pauses explicitement payées/non payées avec journal mobile commun et borne en ligne. Rapports Pro estimatifs, règles/taux datés, indemnités saisies, banques auditables, CSV et snapshots.

Backend officiel : trois migrations appliquées `20261024232827`, `20261024232829`, `20261024232903`; Edge `essential-kiosk` version 4. Aucun fournisseur SMS/paiement activé par ce lot. Contrôles : TypeScript, 55 tests Node/DOM, 19 scripts SQL transactionnels, Deno, bundles Metro Android/iOS. Pas d’essai appareil physique ou de recette Storage/fournisseurs complète.

Détails, preuves et limites : `docs/ESSENTIAL_HR_PAYROLL_20261024.md`. Ne pas déclarer le produit commercialisable sur cette base.

## Coordination

Avant de reprendre : fetch de main, vérifier PR/branches actives et ce document. Aucun autre travail ne doit remplacer les migrations ou les modules de temps pendant leur fusion. Les secrets restent côté serveur et le projet Supabase demeure exclusivement `mlabstdxxwjdpfaxiwmg`.

Prochaines priorités restant à développer : corrections auditables de pauses, export complet/sauvegarde/restauration, hors ligne sécurisé de la borne, compléments Super Admin/promotions et langues; puis recettes fournisseurs/appareils. Les dix thèmes de borne et l’accès administratif temporaire évoqués dans le nouveau guide doivent être coordonnés avec l’autre Work, en conservant les références visuelles réelles et une session séparée de l’autorisation technique de borne. Les SMS sont reportés à la fin selon la priorité explicite du propriétaire.
