/** Public comparison reads the same server catalog as the price cards. */
export function renderCommercialDetails(plans,escape,money){
 const visible=plans.filter(p=>p.active&&p.public_visible);
 const rows=[
  ['Prix de base mensuel',p=>money(p.base_cents)],
  ['Membres inclus',p=>String(p.included_seats)],
  ['Membre supplémentaire / mois',p=>money(p.extra_seat_cents)],
  ['Réduction annuelle',p=>p.annual_discount+' %'],
  ['Bornes comprises',p=>p.kiosk_limit===null?'Illimitées':String(p.kiosk_limit)],
  ['Établissements',p=>p.establishment_limit===null?'Plusieurs':String(p.establishment_limit)],
  ...[['Horaires avancés','advanced_schedules'],['Départements','departments'],['Superviseurs','supervisors'],['Échanges de quarts','shift_swaps'],['Annonces et lectures','announcements'],['Messagerie','messages'],['Couverture minimale','minimum_coverage'],['Rapports avancés','advanced_reports'],['Documents RH','hr_documents'],['Certifications','certifications'],['Banques d’heures','time_banks'],['Coûts de main-d’œuvre','labor_costs']].map(([title,key])=>[title,p=>(p.features||[]).includes(key)?'Inclus':'—'])
 ];
 const questions=[
  ['Faut-il un téléphone pour pointer?','Non. Un salarié peut utiliser la tablette commune avec son matricule et son NIP personnel, sans courriel ni compte mobile.'],
  ['Le compte personnel est-il obligatoire?','Non. Il est facultatif. Si votre employeur vous y donne accès, il permet de consulter vos horaires et vos heures, même lorsque le pointage est réservé à la tablette.'],
  ['Un salarié sur téléphone et tablette compte-t-il deux fois?','Non. Une même personne occupe une seule place dans son entreprise. Une borne commune ne consomme aucune place humaine. Les employés, superviseurs, administrateurs et Boss actifs sont comptés.'],
  ['Comment fonctionne le paiement annuel?','Les douze mois sont payés à l’avance. Le rabais affiché pour votre forfait s’applique à la base et aux membres supplémentaires. Le total est présenté avant confirmation du paiement, en dollars canadiens avant taxes.'],
  ['Puis-je changer de forfait?','Oui. Une prévisualisation du coût et de la date d’effet précède la confirmation. Un changement du tarif public ne remplace pas automatiquement les conditions de votre contrat.'],
  ['Que se passe-t-il en cas de renouvellement impayé?','Une période de sursis précède les restrictions de gestion. Les salariés existants continuent de pointer et les bornes enregistrées restent utilisables. Les heures ne sont pas supprimées et les accès nécessaires aux registres et à la facturation sont maintenus.'],
  ['Les estimations de paie sont-elles certifiées?','Les rapports sont des outils de préparation. Les taux, primes, conventions et règles applicables doivent être validés pour votre entreprise avant la paie.'],
  ['Le pointage fonctionne-t-il sans Internet?','Sur le téléphone, les événements conservés localement restent signalés comme provisoires jusqu’à validation du serveur. La borne commune nécessite actuellement une connexion Internet.']
 ];
 return `${visible.length?`<section class="ess-commercial" aria-labelledby="ess-comparison-title"><h2 id="ess-comparison-title">Comparez les forfaits</h2><p>Les fonctions incluses et les limites suivent le catalogue courant. Vos conditions contractuelles restent consultables dans Abonnement.</p><div class="ess-comparison-scroll" role="region" tabindex="0" aria-label="Comparatif des forfaits, défilement horizontal"><table class="ess-comparison"><caption>Forfaits PUNCH Essentiel · dollars canadiens avant taxes</caption><thead><tr><th scope="col">Fonctions et limites</th>${visible.map(p=>`<th scope="col">${escape(p.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(([title,value])=>`<tr><th scope="row">${escape(title)}</th>${visible.map(p=>`<td>${escape(value(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`:''}<section class="ess-commercial ess-faq" aria-labelledby="ess-faq-title"><h2 id="ess-faq-title">Questions fréquentes</h2>${questions.map(([q,a])=>`<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('')}</section>`;
}
