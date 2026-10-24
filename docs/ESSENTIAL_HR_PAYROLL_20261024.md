# Essentiel — RH, communications, pauses et préparation de paie

## Parcours Web et Expo

- **Documents et formations** : PDF privés de 20 Mo maximum, brouillon d’envoi, publication, révision conservant son destinataire, retrait motivé sans effacer le registre, lien de téléchargement valable 60 secondes, confirmation personnelle de chaque version. Documents entreprise, département ou salarié stable, y compris un salarié sans compte personnel au moment de la publication. Un document de catégorie « personnel » exige un salarié précis.
- **Délégations RH** : le Boss accorde séparément Documents, Certifications et Rémunération à un Admin actif. Le rôle Admin n’ouvre pas automatiquement les dossiers privés ou salaires; un superviseur ne reçoit pas ces permissions. La consultation historique est conservée après restriction commerciale pour les rôles toujours autorisés.
- **Certifications/formations** : titre, délivrance, expiration, renouvellement versionné. Le backend accepte un PDF privé du même salarié. L’employé ne voit que ses certifications; le responsable explicitement autorisé voit les dossiers de l’entreprise. Indicateurs expiré/sous 30 jours et notifications internes dédupliquées.
- **Communications** : annonces Plus/Pro à l’entreprise ou à un département, indicateur important, confirmation de lecture, retrait conservant l’historique; notes de quart Pro immuables, visibles à l’auteur et aux responsables opérationnels autorisés. Annonces limitées à 50 par jour pour une entreprise.
- **Alertes internes** : tâche PostgreSQL chaque heure à la minute 10. Expirations selon la date locale de l’établissement; sorties à vérifier après 16 heures. Aucune sortie automatique, aucun SMS, courriel ou paiement déclenché par ce travail.
- **Pauses** : choix explicite payée ou non payée/repas sur téléphone et borne en ligne. Le journal mobile conserve le type payé avant l’envoi et après redémarrage. Le même registre et les mêmes verrous de session s’appliquent; le rejeu idempotent ne crée pas de seconde pause. Seules les pauses non payées sont déduites des heures nettes et des exports. Les anciennes pauses restent non payées comme elles avaient été saisies; aucun reclassement automatique des archives.

## Estimations de paie Pro

Boss ou Admin explicitement autorisé : taux datés avec motif, règles hebdomadaires versionnées, fuseau, seuil et multiplicateur supplémentaires, jusqu’à douze primes horaires cumulables traversant minuit. Les primes configurées ne sont pas majorées avec le taux supplémentaire. Les heures réelles écoulées sont utilisées aux changements saisonniers; une borne de prime ambiguë/inexistante est refusée.

Les crédits de fériés/vacances/autres distinguent les heures à considérer pour le seuil supplémentaire et le montant d’indemnité fourni par le responsable. Ce montant n’est pas inventé par l’application. Les taux peuvent changer en cours de semaine; l’estimation applique le taux de chaque date locale. Sans taux, la somme du salarié reste manquante et n’est pas remplacée par zéro.

Le rapport conserve son snapshot, la version des règles et les références des taux. Il indique semaine ouverte/fermée et punch ouvert, puis propose un CSV Web/Expo. Les formules de tableur issues de noms/matricules sont neutralisées. Les périodes ouvertes sont provisoires; aucun montant n’est un bulletin de paie, une retenue fiscale ou une certification juridique. Le rapport utilise les segments terminés et le registre officiel actuel; les primes et taux n’altèrent jamais les heures originales.

**Banques** : mouvements signés en minutes, temps ou vacances, raison et justificatif obligatoires. Rejeu protégé par une demande persistée avant envoi; le cache de demande ne contient que son identifiant et son empreinte, pas le montant ou justificatif. Une tentative modifiée après un résultat réseau incertain est bloquée pour éviter de transformer un réessai en nouveau mouvement. Solde calculé par le serveur sur tout le registre sous RLS, même lorsque l’historique affiché est limité. Débit au-delà du solde et ajustement de sa propre banque refusés. Aucun remplacement automatique d’heures supplémentaires par une banque.

Repères consultés : [CNESST — heures supplémentaires](https://www.cnesst.gouv.qc.ca/fr/conditions-travail/salaire-paye/salaire/heures-supplementaires) et [CNESST — temps travaillé et pauses](https://www.cnesst.gouv.qc.ca/fr/conditions-travail/horaire-travail/presence-au-travail-pauses-repos-hebdomadaire). Les catégories de travailleurs, conventions, indemnités et exceptions applicables doivent être vérifiées par un responsable compétent. La note de validation est une trace de configuration du client, pas un certificat délivré par PUNCH.

## Sécurité et validation

Trois migrations appliquées exclusivement à `mlabstdxxwjdpfaxiwmg`. Tables publiques sous RLS, fichiers dans le bucket privé `essential-hr`; aucun écrasement/suppression de fichier publié accordé au client. Le service de borne ne reçoit que la nouvelle action limitée de pause payée et garde ses contrôles PIN/appareil. Les tables privées de déduplication restent fermées aux clients.

55 tests Node/DOM et TypeScript; dix-neuf scripts SQL transactionnels sur le projet officiel. Cas testés : délégation/révocation RH, fichier personnel sans destinataire refusé, brouillon sans fichier refusé, lecture de sa propre version, autre entreprise/département, renouvellement périmé, notifications sans doublons, salaire caché à l’Admin non délégué, total paid/unpaid + crédit + supplémentaires, prime sur nuit de changement d’heure, solde/idempotence de banque, contrôle de session borne/téléphone, réponses tardives après déconnexion et CSV sans formule injectée. Les fixtures sont annulées; aucun salarié réel modifié par les tests.

Les bundles Metro Android/iOS sont produits. Aucun APK/IPA signé ou essai sur appareil physique n’est déclaré. Téléversement Storage et partage natif préparés avec les SDK existants; la recette complète de fichiers sur appareils reste à effectuer. Les contrôles PDF vérifient taille, type et signature de fichier côté client; ce n’est pas un service d’analyse antivirus.

## Limites encore ouvertes

Corrections de pauses soumises à approbation, règles de pauses par département/catégorie et politiques de durée; fériés/indemnités légales calculés automatiquement, bulletins/retenues, intégrations spécifiques de paie, coûts historiques ventilés par poste/établissement réel et budgets; signature électronique externe. Les rapports contiennent l’affectation courante du salarié et ne prétendent pas reconstituer une ancienne affectation RH. Une nouvelle estimation peut refléter un nouveau taux ou crédit; un ancien snapshot est conservé.

Les listes RH affichent les 1 000 révisions récentes; les communications les 500 publications/notes récentes. Les soldes de banque et calculs serveur ne sont pas tronqués par ces listes. Les rapports de paie sont limités explicitement à 1 000 dossiers salariés. Les lectures de documents sont consultables jusqu’à 1 000 confirmations dans les écrans Web/Expo; un suivi paginé à plus grande échelle reste à compléter.

Les autres points du prompt restent ouverts : hors ligne sécurisé de la borne, export complet/sauvegardes/restauration, langues, compléments Super Admin et recettes fournisseurs/appareils. Les SMS restent reportés à la fin suivant la demande de l’utilisateur. Ce document ne déclare pas le prompt intégral terminé.
