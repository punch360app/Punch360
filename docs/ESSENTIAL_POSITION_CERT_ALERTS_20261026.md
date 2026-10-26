# Essentiel Pro — alerte de certification expirée après publication

Un salarié peut posséder une certification valide au moment d'affecter un quart à un poste exclusif puis la voir expirer, être rectifiée ou retirée ultérieurement. Le contrôle initial du quart ne suffit pas. Cette fonction ajoute un **rapport de conformité en lecture seule** sans modifier automatiquement les horaires.

- RPC `essential_position_certification_alerts(company,start,end)`, accessible uniquement au gestionnaire autorisé d'une compagnie **Essentiel Pro** et bornée à 90 jours.
- Parcourt les quarts non annulés avec poste exclusif actif + certificat requis; détermine la validité de la certification de chaque salarié sur **toutes les dates locales du quart**, y compris changement d'heure et quarts à cheval sur minuit.
- Retourne jusqu'à 200 alertes, avec indicateur de troncature pour éviter de masquer une surcharge.
- Boutons dans Organisation Web et Expo : « Vérifier les certifications des postes ». Le résultat indique poste, certificat, quart et membre correspondant sans salaire, courriel ni document RH.
- Ne change aucun quart, certification, paie ou affectation; l'admin doit mettre à jour le certificat ou corriger le planning lui-même. Les limites d'accès sont également appliquées par Supabase.
- Le contrôle de réservation exclusive reste actif indépendamment du rapport; Construction non modifié.

**Tests** : `supabase/tests/essential_position_cert_alerts.sql` (certificat valide → aucune alerte; réduction de sa date d'expiration → une alerte; salarié refusé; fenêtre excessive refusée; rollback) et `tests/exclusive-positions-ui.test.mjs` (bouton Web + réponse report). Expo TypeScript couvert par GitHub Actions.

**Limites de fin de projet** : pas encore de notification push automatique lors d'une révocation; pas de surveillance continue, ni de certification d'appareil iOS/Android. La recette authentifiée du module de planning reste requise. Cet ajout appartient au prompt original **« Validation SQL archives »**; ne pas entamer le prompt maître parallèle tant que le premier n'est pas clos.

**Livraison SQL :** migration `supabase/migrations/20261026012801_essential_position_cert_alerts.sql` appliquée dans Supabase officiel `mlabstdxxwjdpfaxiwmg`. Le scénario SQL rollback a été rejoué après installation et a réussi. Vérifier dernière CI et Pages après fusion.
