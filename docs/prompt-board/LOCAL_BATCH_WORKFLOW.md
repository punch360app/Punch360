# PUNCH 360° — Exécution par lots de code locaux et livrables (27 octobre 2026)

**Décision propriétaire : cette méthode est la routine par défaut de ChatGPT Work.** Elle optimise le transport et la construction du code, jamais les exigences de sécurité ou les critères de mise en production. Le prompt maître conserve son ordre de priorité, toutes ses exigences et sa matrice de validation.

## Préparer une seule fois

1. Dans un environnement Work **disposant réellement d'un terminal Git et d'un espace de travail**, vérifier l'accès au dépôt, puis `git clone https://github.com/punch360app/Punch360.git` si aucune copie n'existe; sinon `git fetch --prune origin`. Ne pas prétendre avoir cloné si DNS, permissions ou outil l'interdisent. Ne jamais insérer de secret Git, Stripe ou Supabase dans le dépôt.
2. Lire `docs/prompt-board/WORK_START.md`, le maître et la passation courante, puis inspecter **une seule fois** les branches/PR actives et les conflits pertinents. Repartir du dernier `origin/main` pour un lot neuf; reprendre d'abord un lot existant compatible. Préserver les modifications locales non enregistrées, ne pas les écraser ni forcer une branche distante.
3. Créer une branche par **parcours métier cohérent**, pas par écran, bouton, test ou fichier. Choisir les IDs du maître, les dépendances, un résultat utilisateur testable et une condition de sortie avant de coder; puis coder sans nouvelle phase d'audit global.

## Fabriquer un vrai lot de développement

1. Modifier directement et ensemble les fichiers nécessaires : interface Web/Expo, RPC/SQL/Edge, RLS et contrôles serveur, erreurs, traductions, tests, documentation strictement utile. Réutiliser les modules existants; ne pas dupliquer des fonctions déjà livrées. Ne pas créer une PR documentaire séparée pour des détails appartenant au même parcours.
2. Appliquer les changements dans la copie de travail, tester **localement** de manière incrémentale : ciblés d'abord, puis validations affectées par les dépendances. Corriger sur place autant de fois que nécessaire. Faire une passe de revue du diff, de la sécurité et des effets secondaires avant d'envoyer à GitHub.
3. Garder les commits locaux lisibles; préférer **un push groupé** lorsque le parcours est cohérent, plutôt qu'un push/une PR à chaque micro-correction. Ne pas grossir artificiellement un lot avec des fonctionnalités sans rapport : un lot n'est jamais « gros » au détriment de la possibilité de le vérifier, corriger ou rétablir.
4. Si une API externe est nécessaire (Supabase, Stripe, appareil, Auth, SMTP), isoler ses effets et valider les autorisations. **Supabase autorisé exclusivement : `mlabstdxxwjdpfaxiwmg`**. Migrations additives, dépendances et ordre d'activation vérifiés; pas d'écriture destructive ni modification de prix, contrat ou paiement réel sans validation explicite.

## Publication et sécurité inchangées

1. Pousser **une branche et une PR par parcours**, prête à relire; lister seulement les IDs réellement touchés au format `PUNCH-PROGRESS: ...`.
2. Valider obligatoirement la **CI sur le SHA final de la PR**, pas seulement des tests avant le dernier correctif. Analyser et réparer les échecs, puis relancer les vérifications affectées. Aucun contournement de workflow, RLS, protection de compagnie, heures/paie, idempotence, contrats, permissions ou contrôle financier.
3. Fusionner uniquement si les autorisations et vérifications sont satisfaites, et vérifier les déploiements réellement concernés : Web GitHub Pages, migrations appliquées, Edge active; distinguer source Expo, build installée et recette sur appareil. Ne pas déclarer livré ce qui n'a qu'un commit, une CI ou une maquette.
4. Actualiser brièvement le suivi/preuves et la passation à la livraison significative; passer au prochain parcours sans exiger « continue » pendant la durée de session disponible. Ne jamais annoncer une exécution en arrière-plan.

## Repli si l'environnement local est indisponible

**Dire immédiatement le blocage exact.** Ne pas multiplier les écritures GitHub fichier par fichier pour simuler du développement local. Lorsqu'il est impossible de cloner ou d'exécuter le projet mais que l'API GitHub fonctionne, grouper toutes les modifications achevées du parcours en **un seul arbre/commit Git via l'API** puis une PR, effectuer toutes les validations disponibles, et signaler honnêtement l'absence de tests locaux. Une CI réussie ne remplace pas une recette appareil/fournisseur ou un test SQL réellement exécuté. Privilégier ensuite un environnement Work avec terminal/clone effectif pour les lots suivants.
