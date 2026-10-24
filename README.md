# PUNCH 360°

Application mobile de suivi des heures et de gestion de chantiers pour la construction.

**État : prototype Expo / React Native, non prêt à être utilisé pour les heures officielles.**

Ce dépôt est le dépôt officiel PUNCH 360°.

## Développement actif — noyau PUNCH connecté

La base **Supabase PUNCH** a maintenant ses tables réelles, règles RLS, fonctions de pointage serveur, équipes et conversations. L’application Expo utilise l’authentification Supabase et les données de compagnie : **les heures enregistrées par RPC sont des événements serveur**, mais le produit n’a pas encore passé de tests terrain ni de tests de paie. Ne pas utiliser pour la paie officielle.

Fonctions intégrées à différentes étapes de maturité : compte courriel / création de compagnie, Accueil/Punch IN/OUT/transfert job, Mes heures, commandes simples, conversation par groupe, profil, urgence, certifications (métadonnées), congés, chef et équipes. Google/Apple sont **préparés** mais nécessitent configuration OAuth. Stripe, invitations payantes, PDF sécurisés et plusieurs fonctions de supervision restent à construire.

Consulte **[l’état précis par fonctionnalité](docs/IMPLEMENTATION_STATUS.md)** avant de tester. La base est hébergée actuellement dans la région AWS US East; évaluer les exigences québécoises de protection des données avant de traiter des informations personnelles réelles.

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
