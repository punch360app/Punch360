# PUNCH 360° — Navigation des jobs (décision validée)

## Parcours
- **Accueil → Job en cours → Toutes les jobs** : recherche, filtres Toutes / Mes jobs / À proximité, carte interactive, épingles, photos, numéro, adresse.
- Toucher une job ouvre sa fiche, **sans démarrer de punch**.
- La fiche donne accès à Waze / Google Maps, documents, commandes et punchs associés à cette job.
- Depuis la fiche, le menu ⋮ de chaque segment de punch permet **Archiver** puis **Restaurer**. L'archive ne supprime jamais le registre officiel.
- Le bouton **Changer de job** en dessous du grand bouton Punch ouvre la liste en mode transfert. Le transfert réel sera transactionnel côté serveur (fin du segment A et début du segment B au même instant, sans interrompre le chronomètre global).
- Sans punch actif, la dernière job choisie est proposée par défaut. Le GPS peut suggérer une job proche, jamais confirmer automatiquement.
- Si aucune prochaine job n'est affectée, la carte Job en cours utilise l'espace libéré.
- Barre mobile : **Accueil · Mes heures · Commande · Message · Plus**. L'historique complet des journées appartient à **Mes heures**.

## État technique

Les anciennes notes de simulation de cette page sont remplacées par `IMPLEMENTATION_STATUS.md` et `REQUIREMENTS_AUDIT.md`. Les migrations sont appliquées sur Supabase PUNCH; le moteur de punch est connecté au serveur, avec journal hors ligne. Consulter ces deux documents pour les validations et les limites réelles.
