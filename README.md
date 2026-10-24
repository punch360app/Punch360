# PUNCH 360°

Application mobile de suivi des heures et de gestion de chantiers pour la construction.

**État : prototype Expo / React Native, non prêt à être utilisé pour les heures officielles.**

Ce dépôt est le dépôt officiel PUNCH 360°.

## Prototype actuel
- Accueil : maquette interactive, grand bouton de pointage (simulation locale), job en cours et prochaine job, résumé des heures illustratif.
- **Accueil → Job en cours → Toutes les jobs** : recherche, filtres « Toutes / Mes jobs / À proximité », carte GPS, fiche de chantier et Waze.
- **Changer de job** : transfert simulé entre jobs sans interrompre le compteur de la journée.
- Fiche job : accès aux plans et commandes à développer, punchs locaux et archive personnelle simulée.
- Navigation retenue : **Accueil · Mes heures · Commande · Message · Plus**.

## Démarrage local
```sh
npm install
npx expo start
```

## Backend PUNCH
Supabase dédié : `mlabstdxxwjdpfaxiwmg` (`https://mlabstdxxwjdpfaxiwmg.supabase.co`). Les migrations sont **préparées mais non exécutées**, en attendant la finalisation du moteur de punch sécurisé. Les clés privées et secrets ne doivent jamais être publiés.

Voir `docs/SPEC_COMPLETE.md`, `docs/JOBS.md`, `docs/BILLING.md`.
