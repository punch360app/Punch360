import {createSubscriptionDirectoryController} from './subscription-directory.js';
import {createQualifiedCoverageController} from './qualified-coverage.js';
import {createLaborBudgetsController} from './labor-budgets.js';
import {createPlatformUsersController} from './platform-users.js';
import {createPlatformAdminsController} from './platform-admins.js';
import {createPlatformPriceProposalsController} from './platform-price-proposals.js';
import {createPlatformDirectoryController} from './platform-directory.js';
import {createInvitationEmailController} from './invitation-email.js';
import {createNotificationPreferencesController} from './notification-preferences.js';
import {createSupervisorApprovalsController} from './supervisor-approvals.js';
import {createBreakPoliciesController} from './break-policies.js';
import {createOfflineReviewController} from './kiosk-offline-review.js';
import {LOCALE_STRINGS} from './essential-locale.js';
import {createMissingDaysController} from './missing-days.js';
import {createArchivesController} from './archives.js';
import {createPlatformFinanceController} from './platform-finance.js';
import {createPromotionsController} from './promotions.js';
import {createPlatformAuditController} from './platform-audit.js';
import {createSupportController} from './support.js';
import {createPlatformTestsController} from './platform-tests.js';
import {createBreakCorrectionsController} from './break-corrections.js';
import {renderCommercialDetails} from './commercial.js';
import {createPayrollController} from './payroll.js';
import {createCommunicationsController} from './communications.js';
import {createHrController} from './hr.js';
import {createAppearanceController} from './appearance.js';
import {createBillingController} from './billing.js';
import {createPlanningController} from './planning.js';
/** Real Essentiel screens; all mutations go through checked server RPCs. */
export function createEssentialController({sb,redraw,notify,escape:e,document:doc=globalThis.document,onChoose=()=>{},getLocale=()=> 'fr'}) {
 const subscriptions=createSubscriptionDirectoryController({sb,redraw,escape:e});
 const qualifiedCoverage=createQualifiedCoverageController({sb,redraw,escape:e});
 const laborBudgets=createLaborBudgetsController({sb,redraw,escape:e});
 const platformUsers=createPlatformUsersController({sb,redraw,escape:e});
 const platformAdmins=createPlatformAdminsController({sb,redraw,escape:e,notify});
 const platformPriceProposals=createPlatformPriceProposalsController({sb,redraw,escape:e});
 const directory=createPlatformDirectoryController({sb,redraw,escape:e,onPriceCompany:company=>{if(platformPriceProposals.choose(company.id,company.name))s.tab='specialPrices';redraw();},onArchives:company=>{s.snapshot={...(s.snapshot||{}),companies_list:[company,...(s.snapshot?.companies_list||[]).filter(c=>c.id!==company.id)]};archives.reset(company.id,true);s.tab='archives';redraw()}});
 const invitationEmail=createInvitationEmailController({sb,redraw,escape:e});
 const notificationPreferences=createNotificationPreferencesController({sb,redraw,escape:e});
 const supervision=createSupervisorApprovalsController({sb,redraw,escape:e});
 const breakPolicies=createBreakPoliciesController({sb,redraw,escape:e});
 const offlineReview=createOfflineReviewController({sb,redraw,escape:e,getLocale});
 const t=key=>LOCALE_STRINGS[getLocale()]?.[key]??LOCALE_STRINGS.fr[key]??key;
 const kioskDateLocale=()=>({fr:'fr-CA',en:'en-CA',es:'es-ES',pt:'pt-BR',it:'it-IT',de:'de-DE',ar:'ar',zh:'zh-CN',hi:'hi-IN',tl:'fil-PH'})[getLocale()]||'fr-CA';
 const missingDays=createMissingDaysController({sb,redraw,escape:e});
 const archives=createArchivesController({sb,redraw,escape:e,document:doc,companies:()=>s.snapshot?.companies_list||[]});
 const finance=createPlatformFinanceController({sb,redraw,escape:e,companies:()=>s.snapshot?.companies_list||[]});
 const promotions=createPromotionsController({sb,redraw,escape:e});
 const audit=createPlatformAuditController({sb,redraw,escape:e});
 const support=createSupportController({sb,redraw,escape:e,document:doc});
 const breakCorrections=createBreakCorrectionsController({sb,redraw,escape:e,document:doc});
 const payroll=createPayrollController({sb,redraw,escape:e,document:doc});
 const communications=createCommunicationsController({sb,redraw,escape:e,document:doc});
 const hr=createHrController({sb,redraw,escape:e,document:doc});
 const appearance=createAppearanceController({sb,redraw,escape:e,document:doc});
 const billing=createBillingController({sb,redraw,escape:e,document:doc});
 let identityRevision=0;
 const planning=createPlanningController({sb,redraw,notify,escape:e,document:doc});
 const s={plans:[],workers:[],dashboard:null,platform:false,platformOpen:true,tab:'home',selected:'essential_plus',cadence:'monthly',seats:5,error:'',loading:false,saving:false,snapshot:null,factor:null,qr:null,mfaSecret:null,mfaMode:'unknown',mfaNotice:'',mfaRequired:true,company:null,worker:null,effectiveBillingStatus:null};
 const platformTests=createPlatformTestsController({sb,state:s,redraw,escape:e,document:doc});
 const money=c=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(c/100);
 const btn=(text,action,extra='')=>`<button type="button" class="ess-btn" data-action="ess:${action}" ${extra}>${text}</button>`;
 const field=(label,id,value='',type='text',extra='')=>`<label class="ess-field">${label}<input id="${id}" type="${type}" value="${e(value)}" ${extra}></label>`;
 const check=(label,id,value)=>`<label class="ess-check"><input type="checkbox" id="${id}" ${value?'checked':''}>${label}</label>`;
 const kioskUrl='https://punch360app.github.io/Punch360/kiosk.html';
 const get=id=>doc.getElementById(id), val=id=>get(id)?.value.trim()??'';
 async function rpc(name,p){const r=await sb.rpc(name,p);if(r.error)throw r.error;return r.data;}
 async function plans(){const r=await sb.from('essential_plans').select('*').order('sort_order');if(r.error)throw r.error;s.plans=r.data||[];}
 async function load(user,account){const previous={user:s.platformUser,factor:s.factor,mode:s.mfaMode,qr:s.qr,key:s.mfaSecret};subscriptions.reset();qualifiedCoverage.reset();laborBudgets.reset();platformUsers.reset();platformAdmins.reset();platformPriceProposals.reset();directory.reset();invitationEmail.reset();notificationPreferences.reset();supervision.reset();breakPolicies.reset();offlineReview.reset();missingDays.reset();archives.reset(account?.company_id||null);finance.reset();promotions.reset();s.platformUser=user?.id||null;audit.reset();support.reset();platformTests.reset();const revision=++identityRevision;const current=()=>revision===identityRevision;s.company=account?.company_id||null;s.role=account?.role;s.devices=[];s.error='';s.worker=null;s.workers=[];s.dashboard=null;s.platform=false;s.effectiveBillingStatus=null;s.tab='home';s.factor=null;s.qr=null;s.mfaSecret=null;s.mfaMode='unknown';s.mfaNotice='';
  try{await plans();if(!current())return;if(user){const platform=await rpc('platform_access');if(!current())return;s.platform=platform===true;
   if(s.platform){const r=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(!current())return;s.mfaRequired=r.data?.currentLevel!=='aal2';if(s.mfaRequired){
    const listed=await sb.auth.mfa.listFactors();if(listed.error)throw listed.error;if(!current())return;
    const all=listed.data?.all||[],verified=all.find(f=>f.factor_type==='totp'&&f.status==='verified')||
      (listed.data?.totp||[]).find(f=>f.status==='verified');
    const pending=all.find(f=>f.factor_type==='totp'&&f.status==='unverified'&&f.friendly_name==='Console PUNCH');
    const found=verified||pending;
    if(found){
     s.factor=found.id;
     const same=!verified&&previous.user===user.id&&previous.factor===found.id&&previous.mode==='enroll'&&previous.qr&&previous.key;
     s.mfaMode=verified?'verify':same?'enroll':'pending';
     if(same){s.qr=previous.qr;s.mfaSecret=previous.key;}
     s.mfaNotice=verified?'Authentificateur déjà actif. Entrez son code.':
      'Configuration en cours. Revenez de votre application Authenticator et entrez le code sans créer de nouveau QR.';
    }
   }if(!s.mfaRequired){const snapshot=await rpc('platform_snapshot');if(!current())return;s.snapshot=snapshot;const accounts=await rpc('platform_test_accounts');if(!current())return;s.testAccounts=accounts;}}
   if(account?.companies?.product_edition==='essential'){
    if(['boss','admin'].includes(account.role)){
     // Server-computed status includes Super Admin holds, unlike companies.billing_status.
     try{const rights=await rpc('essential_entitlements',{p_company:account.company_id});if(!current())return;s.effectiveBillingStatus=rights.billing_status;}
     catch(err){if(!current())return;s.effectiveBillingStatus='restricted';s.error=err.message;}
    }
    // These two areas remain available when management is suspended.
    if(account.role==='boss'){await billing.load(account.company_id);if(!current())return;}
    await support.load(account.company_id);if(!current())return;
    await appearance.load(user.id);if(!current())return;
    const r=await sb.from('company_workers').select('*').eq('company_id',account.company_id).order('employee_number');if(!current())return;if(r.error)throw r.error;s.workers=r.data||[];s.worker=s.workers.find(x=>x.auth_user_id===user.id)||null;
    if(['admin','boss'].includes(account.role)){await invitationEmail.load(account.company_id);if(!current())return;const dashboard=await rpc('essential_company_dashboard',{p_company:account.company_id});if(!current())return;s.dashboard=dashboard;const devices=await rpc('list_kiosk_devices',{p_company:account.company_id});if(!current())return;s.devices=devices;if(current())await offlineReview.load(account.company_id);}await notificationPreferences.load(account.company_id);if(!current())return;await planning.load(account,user.id,s.worker?.id,s.workers);if(current())await supervision.load(account.company_id,['boss','admin'].includes(account.role)||planning.state.scopes.some(g=>g.active&&(g.can_approve_time||g.can_approve_leave)));if(current())await breakPolicies.load(account,planning.state.departments);if(current())await breakCorrections.load(account,user.id,s.workers);if(current())await missingDays.load(account,user.id,s.workers);if(current())await hr.load(account,user.id,s.workers,planning.state.departments);if(current())await payroll.load(account,user.id,planning.state.roster);if(current()&&['boss','admin'].includes(account.role)){await laborBudgets.load(account,planning.state.departments);if(current())await qualifiedCoverage.load(account,planning.state.departments,planning.state.locations);}if(current())await communications.load(account,user.id,planning.state.departments,planning.state.entitlement.features||[]);
   }else planning.reset();
  }}catch(err){if(current())s.error=err.message;}
 }

 function renderPricing(){const visible=s.plans.filter(p=>p.active&&p.public_visible);return `<section class="ess-pricing"><div class="ess-pricing-head"><h2>Choisissez votre forfait</h2><div class="ess-switch" role="group" aria-label="Période de paiement">${btn('Mensuel','monthly',`aria-pressed="${s.cadence==='monthly'}"`)}${btn(s.plans.length&&s.plans.every(p=>p.annual_discount===s.plans[0].annual_discount)?'Annuel −'+s.plans[0].annual_discount+' %':'Annuel','yearly',`aria-pressed="${s.cadence==='yearly'}"`)}</div></div>${field('Nombre de membres humains','ess-seats',s.seats,'number','min="1" max="100000"')}<div class="ess-price-grid">${visible.map(p=>{
 const monthly=p.base_cents+(p.included_seats_unlimited===true?0:Math.max(0,s.seats-p.included_seats))*p.extra_seat_cents,annual=Math.round(monthly*12*(100-p.annual_discount)/100),yearly=s.cadence==='yearly';
 return `<article class="ess-price ${p.recommended?'recommended':''}">${p.recommended?'<span class="ess-badge">Recommandé</span>':''}<h3>${e(p.title)}</h3><div class="ess-price-amount">${money(yearly?annual:monthly)}<small> / ${yearly?'an':'mois'}</small></div><p>${p.included_seats_unlimited===true?'Membres inclus : illimité · aucun supplément par membre':p.included_seats+' membres inclus · +'+money(p.extra_seat_cents)+' / membre / mois'}</p><hr><p>${p.kiosk_limit===null?'Bornes illimitées':p.kiosk_limit+' borne(s)'} · ${p.establishment_limit===null?'Plusieurs établissements':p.establishment_limit+' établissement(s)'}</p><ul><li>Pointage et heures</li><li>Compte personnel facultatif</li><li>Invitations SMS et courriel</li><li>20 designs prévus au catalogue</li></ul><p>${yearly?'Équivalent '+money(annual/12)+'/mois · économie '+money(monthly*12-annual):'Annuel : '+money(annual)+' en un versement'}</p>${btn('Choisir ce forfait','choose',`data-id="${e(p.id)}"`)}</article>`;
 }).join('')}</div>${!visible.length?'<p role="status">'+e(s.error||'Chargement des tarifs…')+'</p>':''}<p class="ess-fine">Dollars canadiens, avant taxes. Les sièges additionnels profitent du même rabais annuel. Aucun paiement confirmé à cette étape.</p>${s.checkout?`<div class="ess-notice" role="status">Forfait choisi : ${e(s.checkout)}. Le paiement Stripe n’est pas encore activé. Aucun abonnement facturé.</div>`:''}</section>${renderCommercialDetails(s.plans,e,money)}`;}
 const nav=[['home','Accueil'],['plans','Forfaits et tarifs'],['companies','Entreprises'],['users','Utilisateurs'],['specialPrices','Tarifs particuliers'],['billing','Abonnements Stripe'],['tests','Comptes test'],['archives','Archives et récupération'],['finance','Rapports financiers'],['promotions','Codes promotionnels'],['support','Support clients'],['audit','Sécurité et audit']];

 // Overview uses existing server-authorized platform_snapshot; no new broad reads.
 // Missing/invalid figures are not guessed and never displayed as zero.
 function renderPlatformHome(){
  const snapshot=s.snapshot||{};
  const count=v=>Number.isSafeInteger(v)&&v>=0?new Intl.NumberFormat('fr-CA').format(v):'—';
  const metrics=[
   ['Entreprises clientes',snapshot.companies,'companies','Voir les entreprises'],
   ['Utilisateurs inscrits',snapshot.users,'users','Voir les utilisateurs'],
   ['Membres actifs',snapshot.active_members,'companies','Voir les membres'],
   ['Entreprises de test',snapshot.test_companies,'tests','Ouvrir les tests']
  ];
  const shortcuts=[
   ['companies','Entreprises','Consulter les sociétés et leurs dossiers'],
   ['users','Utilisateurs','Trouver et vérifier un compte'],
   ['billing','Abonnements Stripe','Contrats, factures et abonnements'],
   ['tests','Comptes test','Tester les parcours sans clients réels'],
   ['plans','Forfaits et tarifs','Consulter les tarifs configurés'],
   ['support','Support clients','Suivre les demandes de soutien']
  ];
  const rawAudit=Array.isArray(snapshot.audit)?snapshot.audit:[];
  const activity=rawAudit.slice(0,4);
  const labels={
   platform_admin_added:'Accès administrateur accordé',
   platform_admin_removed:'Accès administrateur retiré',
   platform_admin_added_via_sql:'Accès administrateur ajouté dans Supabase',
   plan_updated:'Forfait modifié',
   test_company_created:'Entreprise de test créée',
   test_user_created:'Compte de test créé',
   test_user_status:'Statut de compte de test modifié'
  };
  const events=activity.map(item=>{
   const date=new Date(item.created_at);
   const when=Number.isFinite(date.getTime())?date.toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'Date indisponible';
   return '<li><span>'+e(labels[item.action]||'Activité administrative')+'</span><time>'+e(when)+'</time></li>';
  }).join('');
  return '<div class="ess-platform-home">'+
   '<section class="ess-home-intro"><div><span class="ess-home-eyebrow">PUNCH 360° · Espace de gestion</span>'+
   '<h3>Votre plateforme, en un coup d’œil</h3>'+
   '<p>Consultez les indicateurs réels et accédez rapidement aux principales fonctions de PUNCH.</p></div>'+
   btn('Actualiser les données','refresh')+'</section>'+
   '<section aria-label="Indicateurs de la plateforme"><h3 class="ess-home-heading">Vue d’ensemble</h3>'+
   '<div class="ess-home-metrics">'+metrics.map(([label,value,id,more])=>
    '<button type="button" class="ess-home-stat" data-action="ess:tab" data-id="'+id+'">'+
    '<small>'+e(label)+'</small><strong>'+e(count(value))+'</strong><span>'+e(more)+' <span aria-hidden="true">›</span></span></button>'
   ).join('')+'</div></section>'+
   '<div class="ess-home-columns"><section aria-label="Accès rapides"><h3 class="ess-home-heading">Accès rapides</h3>'+
   '<div class="ess-home-links">'+shortcuts.map(([id,label,description])=>
    '<button type="button" class="ess-home-link" data-action="ess:tab" data-id="'+id+'"><span>'+
    '<strong>'+e(label)+'</strong><small>'+e(description)+'</small></span><span class="ess-home-arrow" aria-hidden="true">›</span></button>'
   ).join('')+'</div></section>'+
   '<section aria-label="Répartition et activité"><h3 class="ess-home-heading">Aperçu de l’activité</h3>'+
   '<div class="ess-panel ess-home-summary"><h4>Répartition des clients</h4>'+
   '<div><span>Essentiel</span><strong>'+e(count(snapshot.essential))+'</strong></div>'+
   '<div><span>Construction</span><strong>'+e(count(snapshot.construction))+'</strong></div>'+
   '<p>Entreprises réelles, sans environnements de test.</p></div>'+
   '<div class="ess-panel ess-home-summary"><h4>Activité administrative récente</h4>'+
   (events?'<ul class="ess-home-events">'+events+'</ul>':
    '<p>Aucune activité disponible pour le moment.</p>')+
   '</div></section></div>'+
   '<p class="ess-home-footnote">Données fournies par la plateforme après vérification de votre accès. Un tiret signifie qu’une donnée n’est pas disponible.</p>'+
   '</div>';
 }
 function renderPlatform(){return `<div class="ess-platform"><aside><h1>PUNCH</h1><small>SUPER ADMIN</small><nav aria-label="Navigation Super Admin">${nav.map(([id,title])=>btn(title,'tab',`data-id="${id}" aria-pressed="${s.tab===id}"`)).join('')}</nav>${btn('Actualiser','refresh')}${btn('Se déconnecter','logout')}</aside><main id="main"><header><h2>${e(nav.find(x=>x[0]===s.tab)?.[1]||'Accueil')}</h2><span class="ess-badge">Espace sécurisé</span></header>${s.error?`<div class="ess-notice" role="alert">${e(s.error)}</div>`:''}${s.mfaRequired?renderMfa():s.tab==='home'?renderPlatformHome():s.tab==='plans'?renderPlanEditor():s.tab==='companies'?renderCompanies():s.tab==='users'?platformUsers.render():s.tab==='specialPrices'?platformPriceProposals.render():s.tab==='tests'?renderTests():s.tab==='billing'?renderPlatformBilling():s.tab==='archives'?archives.render():s.tab==='support'?support.render():s.tab==='promotions'?promotions.render():s.tab==='finance'?finance.render():renderAudit()}</main></div>`;}
 function renderPlatformBilling(){return subscriptions.render(s.plans)}
 function renderMfa(){
  const existing=s.mfaMode==='verify',enrolling=s.mfaMode==='enroll',pending=s.mfaMode==='pending';
  const description=existing?
    'Un authentificateur est déjà activé sur ce compte. Ouvrez celui qui affiche le code PUNCH et saisissez son code à six chiffres.':
    pending?'Configuration déjà commencée. Entrez simplement le code affiché dans Authenticator : ne recréez pas votre QR.':
    enrolling?'Ajoutez maintenant PUNCH dans Google Authenticator, Microsoft Authenticator ou une application compatible.':
    'Pour accéder au Super Admin, configurez votre authentificateur ou utilisez celui déjà activé sur ce compte.';
  const actionLabel=enrolling||pending?'Reprendre la configuration':existing?'Utiliser mon authentificateur':'Configurer ou utiliser mon authentificateur';
  return '<section class="ess-panel ess-platform-mfa"><h3>Sécuriser la console</h3>'+
   '<p>'+e(description)+'</p>'+
   (s.mfaNotice?'<p class="ess-notice" role="status">'+e(s.mfaNotice)+'</p>':'')+
   (s.qr?'<p><strong>1.</strong> Scannez le QR avec votre application Authenticator. Si vous êtes sur le même téléphone, utilisez la clé ci-dessous.</p>'+
     '<img class="ess-qr" src="'+e(s.qr)+'" alt="Code QR pour ajouter PUNCH dans l’application Authenticator">':'')+
   (enrolling&&s.mfaSecret?'<label class="ess-field"><strong>Clé de configuration manuelle</strong>'+
     '<input id="ess-mfa-secret" value="'+e(s.mfaSecret)+'" type="text" readonly aria-label="Clé secrète à recopier dans votre authentificateur" autocomplete="off" spellcheck="false">'+
     '</label><p class="ess-fine">Dans Authenticator : ajouter un compte → saisir une clé de configuration. Choisissez le type basé sur le temps. Ne partagez jamais cette clé.</p>':'')+
   btn(actionLabel,'enroll',s.saving?'disabled':'')+
   (existing&&!enrolling?'<p class="ess-fine">Si vous n’avez plus accès à cet authentificateur déjà validé, contactez le support pour une récupération sécurisée. PUNCH ne le désactive pas automatiquement.</p>':'')+
   ((enrolling||pending||existing||s.factor)?'<div class="ess-mfa-verify"><p><strong>2.</strong> Entrez le code à six chiffres affiché par votre application.</p>'+
    field('Code à six chiffres','ess-mfa-code','','text','inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"')+
    btn('Vérifier et ouvrir le Super Admin','verify',s.saving?'disabled':'')+'</div>':'')+
   '</section>';
 }
 function renderPlanEditor(){const p=s.plans.find(x=>x.id===s.selected);return `<div class="ess-price-grid">${s.plans.map(p=>`<button class="ess-price" data-action="ess:select" data-id="${e(p.id)}" aria-pressed="${s.selected===p.id}"><h3>${e(p.title)}</h3><strong class="ess-price-amount">${money(p.base_cents)}</strong><p>${p.included_seats_unlimited===true?'Membres inclus : illimité · supplément 0 $':p.included_seats+' membres inclus · +'+money(p.extra_seat_cents)}</p><small>${p.kiosk_limit===null?'Bornes illimitées':p.kiosk_limit+' borne(s)'} · version ${p.version}</small></button>`).join('')}</div>${p?`<section class="ess-panel"><h3>Paramètres du forfait sélectionné</h3><div class="ess-form-grid">${field('Nom du forfait','ess-title',p.title)}${field('Prix mensuel ($ CA)','ess-base',(p.base_cents/100).toFixed(2),'number','min="0" step="0.01"')}${field('Membres inclus en mode numérique','ess-included',p.included_seats,'number','min="1" max="100000"')}${field('Membre additionnel ($ CA)','ess-extra',(p.extra_seat_cents/100).toFixed(2),'number','min="0" step="0.01"')}${field('Réduction annuelle (%)','ess-discount',p.annual_discount,'number','min="0" max="100"')}${field('Bornes (vide = illimité)','ess-kiosk',p.kiosk_limit??'','number','min="1"')}${field('Établissements (vide = illimité)','ess-sites',p.establishment_limit??'','number','min="1"')}${field('Sursis (jours)','ess-grace',p.grace_days,'number','min="0" max="365"')}${field('Ordre de présentation','ess-sort',p.sort_order,'number')}${field('Description','ess-description',p.description)}</div><div class="ess-checks">${check('Actif','ess-active',p.active)}${check('Visible publiquement','ess-visible',p.public_visible)}${check('Recommandé','ess-recommended',p.recommended)}${check('Membres inclus illimités (aucun supplément)','ess-included-unlimited',p.included_seats_unlimited===true)}</div><p class="ess-fine">En mode illimité, le nombre numérique reste mémorisé mais aucun membre supplémentaire n’est facturé. Nouvelle version du catalogue uniquement : aucun ancien contrat n’est réécrit.</p><h3>Modules commerciaux</h3><div class="ess-checks">${['advanced_schedules','shift_swaps','availability','departments','supervisors','announcements','messages','minimum_coverage','hr_documents','certifications','advanced_reports','time_banks','labor_costs','payroll_integrations','multiple_establishments'].map(f=>check(({advanced_schedules:'Horaires avancés',shift_swaps:'Échanges de quarts',availability:'Disponibilités',departments:'Départements',supervisors:'Superviseurs',announcements:'Annonces',messages:'Messagerie',minimum_coverage:'Couverture minimale',hr_documents:'Documents RH',certifications:'Certifications',advanced_reports:'Rapports avancés',time_banks:'Banques d’heures',labor_costs:'Coûts',payroll_integrations:'Intégrations paie',multiple_establishments:'Multiétablissement'})[f],'ess-feature-'+f,p.features.includes(f))).join('')}</div><p class="ess-fine">Les fonctions de sécurité et de conservation restent obligatoires. Le catalogue décrit les droits commerciaux; leur activation ne remplace pas leur développement.</p>${field('Motif de modification','ess-reason','','text','minlength="3" maxlength="1000"')}<p>Cette nouvelle version s’applique au catalogue public. Les contrats existants sont conservés.</p>${btn(s.saving?'Enregistrement…':'Enregistrer une nouvelle version','save-plan',s.saving?'disabled':'')}</section>`:'<p>Chargement…</p>'}`;}
 function renderCompanies(){return `<div class="ess-metrics"><div class="ess-panel"><small>Entreprises réelles</small><strong>${s.snapshot?.companies??'—'}</strong></div><div class="ess-panel"><small>Membres actifs</small><strong>${s.snapshot?.active_members??'—'}</strong></div></div>${directory.render()}`;}
 function renderTests(){return platformTests.render();}
 function renderAudit(){return audit.render();}
 function renderWorkers(){return `<h2>Employés</h2>${invitationEmail.render(s.workers)}${s.enrollment?`<section class="ess-panel"><b>Code d’enrôlement du NIP</b><p>À remettre en personne au salarié vérifié. Il saisit lui-même son NIP sur la borne. Valide 15 minutes.</p><textarea class="field" readonly aria-label="Code d’enrôlement">${e(s.enrollment)}</textarea></section>`:''}${s.invitationLink?`<section class="ess-panel"><b>Invitation sécurisée</b><p>${e(s.invitationStatus)}</p><textarea class="field" readonly aria-label="Lien d’activation à partager">${e(s.invitationLink)}</textarea><p>Usage unique · validité définie par votre entreprise. Le destinataire doit confirmer le courriel ou téléphone invité.</p></section>`:''}${s.error?`<p role="alert">${e(s.error)}</p>`:''}<div class="ess-worker-layout"><section class="ess-panel"><h3>Nouvel employé</h3><p>Un dossier stable, même sans téléphone ni courriel.</p><div class="ess-form-grid">${field('Prénom','ess-first')}${field('Nom','ess-last')}${field('Matricule','ess-number')}${field('Téléphone international (facultatif)','ess-phone','','tel','placeholder="+14185550134"')}${field('Courriel (facultatif)','ess-email','','email')}</div>${check('Consentement à recevoir une invitation SMS','ess-consent',false)}${btn(s.saving?'Création…':'Créer l’employé','create-worker',s.saving?'disabled':'')}<p class="ess-fine">L’activation personnelle et l’enrôlement NIP seront reliés au même dossier. Une invitation SMS est demandée automatiquement si le consentement et le fournisseur sont configurés.</p></section><section class="ess-panel"><h3>Dossiers salariés · ${s.workers.length}</h3>${s.workers.map(w=>`<article class="ess-person"><span class="ess-avatar">${e(w.first_name[0])}</span><div><b>${e(w.first_name+' '+w.last_name)}</b><small>${e(w.employee_number)} · ${w.auth_user_id?'Compte personnel lié':'Sans compte personnel'}</small><small>${w.can_mobile_punch?'Mobile autorisé':'Pointage sur tablette'} · ${e(w.status)}</small></div>${s.role==='boss'?`<label class="ess-field">Mode<select id="ess-mode-${e(w.id)}"><option value="mobile" ${w.can_mobile_punch&&!w.can_kiosk_punch?'selected':''}>Téléphone</option><option value="kiosk" ${!w.can_mobile_punch&&w.can_kiosk_punch?'selected':''}>Tablette</option><option value="mixed" ${w.can_mobile_punch&&w.can_kiosk_punch?'selected':''}>Mixte</option></select></label>${btn('Appliquer','channels',`data-id="${e(w.id)}"`)}`:''}${w.can_kiosk_punch?btn('Enrôler le NIP','pin-enroll',`data-id="${e(w.id)}"`):''}${!w.auth_user_id&&(w.email||w.phone)?btn('Inviter','invite-worker',`data-id="${e(w.id)}"`):''}</article>`).join('')||'<p>Aucun dossier.</p>'}</section></div>`;}
 function renderDashboard(account){const d=s.dashboard||{},boss=account.role==='boss';const metrics=boss?[['Employés',s.workers.filter(x=>x.status==='active').length],['Heures / semaine',d.week_gross_ms==null?'—':(d.week_gross_ms/3600000).toFixed(1)+' h'],['Coûts estimés','Non configurés'],['Congés à approuver',d.pending_leaves??'—']]:[['Présents',d.present??'—'],['En pause',d.paused??'—'],['Corrections',d.pending_corrections??'—'],['Sorties oubliées',d.open_before_today??'—']];return `<div class="ess-dashboard"><h1>${boss?'Direction':'Administration'}</h1><p>${e(account.companies.name)} · ${e(new Date().toLocaleDateString('fr-CA'))}</p><div class="ess-metrics">${metrics.map(([name,value])=>`<div class="ess-panel"><small>${name}</small><strong>${value??'À configurer'}</strong></div>`).join('')}</div><h3>Présences et dossiers</h3><section class="ess-panel">${s.workers.slice(0,8).map(w=>`<article class="ess-person"><span class="ess-avatar">${e(w.first_name[0])}</span><div><b>${e(w.first_name+' '+w.last_name)}</b><small>${e(w.employee_number)}</small></div><span class="ess-badge">${planning.state.roster.find(p=>p.id===w.id)?.working?(planning.state.roster.find(p=>p.id===w.id)?.paused?'En pause':'Au travail'):'Non pointé'}</span></article>`).join('')||'<p>Aucun dossier.</p>'}</section><div class="ess-checks">${boss?'<button class="ess-btn" data-action="navigate" data-id="punch">Accéder à mon punch</button>':''}<button class="ess-btn" data-action="subpage" data-id="members">Gérer les employés</button><button class="ess-btn" data-action="subpage" data-id="approvals">Ouvrir les approbations</button></div></div>`;}
 function renderKiosks(){return `<h2>${e(t('kiosksManageTitle'))}</h2><div class="ess-panel"><h3>${e(t('kiosksPairTablet'))}</h3><label class="ess-field">${e(t('kiosksLocation'))}<select id="ess-device-location">${planning.state.locations.map(l=>`<option value="${e(l.id)}">${e(l.name)}</option>`).join('')}</select></label>${field(e(t('kiosksDeviceName')),'ess-device-name')}<p>${e(t('kiosksPairInstruction'))} <a href="./kiosk.html" target="_blank" rel="noopener">${e(t('kiosksPageLink'))}</a></p>${btn(e(t('kiosksGenerateCode')),'pair-code')}${s.pairCode?`<textarea class="field" readonly aria-label="${e(t('kiosksPairCode'))}">${e(s.pairCode)}</textarea>`:''}</div><div class="ess-panel">${(s.devices||[]).map(d=>`<article class="ess-person"><div><b>${e(d.name)}</b><small>${d.revoked_at?e(t('kiosksRevoked')):d.paired_at?e(t('kiosksPaired')):e(t('kiosksWaiting'))} · ${e(t('kiosksLastSeen'))} ${d.last_seen_at?`<bdi dir="ltr">${e(new Date(d.last_seen_at).toLocaleString(kioskDateLocale()))}</bdi>`:e(t('kiosksNever'))}</small></div><a class="ess-btn" href="${kioskUrl}" target="_blank" rel="noopener">${e(t('kiosksOpen'))}</a>${btn(e(t('kiosksCopy')),'copy-kiosk-link')}${!d.revoked_at?`<label class="ess-field">${e(t('kiosksIdle'))}<select id="ess-idle-${e(d.id)}">${[5,10,15,30,60].map(n=>`<option value="${n}" ${n===(d.idle_seconds||10)?'selected':''}>${n} ${e(t('kiosksSeconds'))}</option>`).join('')}</select></label>${btn(e(t('save')),'kiosk-idle',`data-id="${e(d.id)}"`)}`:''}${!d.revoked_at?btn(e(t('kiosksRevoke')),'revoke-device',`data-id="${e(d.id)}"`):''}</article>`).join('')||`<p>${e(t('kiosksNone'))}</p>`}</div><p class="ess-fine">${e(t('kiosksSafety'))}</p>${offlineReview.render()}`;}
 async function inviteWorker(id){
  const r=await sb.functions.invoke('essential-invite',{body:{workerId:id}});if(r.error)throw r.error;if(r.data.error)throw Error(r.data.error);
  s.invitationLink=r.data.activationUrl;s.invitationStatus=({sent:'SMS accepté par le fournisseur · livraison en attente',delivered:'SMS livré',not_configured:'SMS non configuré. Vous pouvez partager le lien sécurisé.',not_authorized:'SMS non autorisé pour ce dossier. Vous pouvez partager le lien.',failed:'Échec d’envoi SMS. Le lien reste disponible.',unknown:'Résultat d’envoi inconnu. Aucun renvoi automatique.'})[r.data.smsStatus]||'Invitation créée';notify(s.invitationStatus);
 }
 async function handle(el){if(el?.dataset?.action?.startsWith('platform-admin:'))return platformAdmins.handle(el);if(await qualifiedCoverage.handle(el))return true;const action=el.dataset.action?.slice(4);if(!el.dataset.action?.startsWith('ess:'))return false;if(action.startsWith('plan-'))return planning.handle(el);
 if(action.startsWith('test-')||action==='simulate-plan')return platformTests.handle(el);
 s.error='';try{
 if(action==='monthly'||action==='yearly')s.cadence=action;
 else if(action==='choose'){s.checkout=s.plans.find(p=>p.id===el.dataset.id)?.title;notify('Forfait choisi. Paiement Stripe encore à configurer.');onChoose(s.plans.find(p=>p.id===el.dataset.id));}
 else if(action==='select')s.selected=el.dataset.id;
 else if(action==='tab'){platformTests.hideCredentials();s.tab=el.dataset.id;if(s.tab==='companies')await directory.load();if(s.tab==='archives')archives.reset(null,true);if(s.tab==='support')await support.load(null,true);if(s.tab==='audit')await audit.load();if(s.tab==='promotions')await promotions.load(s.platformUser);if(s.tab==='finance')await finance.load();}
 else if(action==='logout'){subscriptions.reset();platformUsers.reset();platformAdmins.reset();platformPriceProposals.reset();directory.reset();archives.reset();finance.reset();promotions.reset();support.reset();audit.reset();platformTests.reset();await sb.auth.signOut();s.platform=false;s.snapshot=null;s.testAccounts=[];s.testCredentials=null;s.workers=[];s.worker=null;}
 else if(action==='refresh'){await plans();if(s.platform&&!s.mfaRequired)s.snapshot=await rpc('platform_snapshot');}
 else if(action==='billing-refresh'){await subscriptions.search(null,true);}
 else if(action==='save-plan'){
  if(s.saving)return true;const p=s.plans.find(x=>x.id===s.selected),integer=(id,min=0)=>{const n=Number(val(id));if(!val(id)||!Number.isSafeInteger(n)||n<min)throw Error('Valeur entière requise');return n;};
  const cents=id=>{if(!/^\d+(\.\d{1,2})?$/.test(val(id)))throw Error('Montant invalide');return Math.round(Number(val(id))*100);};
  const optional=id=>val(id)===''?null:integer(id,1),featureBoxes=[...doc.querySelectorAll('[id^="ess-feature-"]')];
  const controlled=featureBoxes.map(x=>x.id.slice(12)),features=p.features.filter(f=>!controlled.includes(f)).concat(featureBoxes.filter(x=>x.checked).map(x=>x.id.slice(12)));
  const values={title:val('ess-title'),description:val('ess-description'),base_cents:cents('ess-base'),extra_seat_cents:cents('ess-extra'),included_seats:integer('ess-included',1),included_seats_unlimited:get('ess-included-unlimited').checked,annual_discount:integer('ess-discount'),kiosk_limit:optional('ess-kiosk'),establishment_limit:optional('ess-sites'),grace_days:integer('ess-grace'),sort_order:integer('ess-sort'),active:get('ess-active').checked,public_visible:get('ess-visible').checked,recommended:get('ess-recommended').checked,features};
  const reason=val('ess-reason');if(reason.length<3)throw Error('Un motif est requis.');s.saving=true;
  await rpc('platform_save_essential_plan',{p_id:p.id,p_expected_version:p.version,p_values:values,p_reason:reason});await plans();s.snapshot=await rpc('platform_snapshot');notify('Nouvelle version enregistrée. Contrats existants conservés.');
 }else if(action==='create-worker'){
  if(s.saving)return true;const first=val('ess-first'),number=val('ess-number');if(!first||!number)throw Error('Prénom et matricule requis.');
  const params={p_company:s.company,p_first:first,p_last:val('ess-last'),p_number:number,p_phone:val('ess-phone')||null,p_email:val('ess-email')||null,p_sms_consent:get('ess-consent').checked};s.saving=true;
  const worker=await rpc('create_essential_worker',params);s.workers.push(worker);notify('Dossier salarié créé.');if(params.p_phone&&params.p_sms_consent)await inviteWorker(worker.id);
 }else if(action==='pair-code'){const r=await rpc('create_essential_kiosk_pairing',{p_company:s.company,p_location:val('ess-device-location'),p_name:val('ess-device-name')});s.pairCode=r.pairing_code;s.devices=await rpc('list_kiosk_devices',{p_company:s.company});}
 else if(action==='copy-kiosk-link'){await navigator.clipboard.writeText(kioskUrl);notify('Lien public copié. Aucun code d’appairage dans ce lien.');}
 else if(action==='kiosk-idle'){await rpc('set_kiosk_idle',{p_device:el.dataset.id,p_seconds:Number(val('ess-idle-'+el.dataset.id))});s.devices=await rpc('list_kiosk_devices',{p_company:s.company});}
 else if(action==='revoke-device'){await rpc('revoke_kiosk',{p_device:el.dataset.id,p_reason:'Révocation depuis la console de gestion'});s.devices=await rpc('list_kiosk_devices',{p_company:s.company});}
 else if(action==='pin-enroll'){s.enrollment=await rpc('create_pin_enrollment',{p_worker:el.dataset.id});}
 else if(action==='channels'){const mode=val('ess-mode-'+el.dataset.id);await rpc('set_essential_worker_channels',{p_worker:el.dataset.id,p_mobile:mode!=='kiosk',p_kiosk:mode!=='mobile',p_personal:true,p_reason:'Mode de pointage modifié par le Boss'});const w=s.workers.find(x=>x.id===el.dataset.id);if(w){w.can_mobile_punch=mode!=='kiosk';w.can_kiosk_punch=mode!=='mobile';}}
 else if(action==='invite-worker'){await inviteWorker(el.dataset.id);}
 else if(action==='enroll'){
  // listFactors().totp contains only verified factors; .all includes abandoned
  // unverified enrollments. Never discard a verified factor without AAL2 recovery.
  const f=await sb.auth.mfa.listFactors();if(f.error)throw f.error;
  const factors=Array.isArray(f.data?.all)?f.data.all:Array.isArray(f.data?.totp)?f.data.totp:[];
  const existing=factors.find(x=>x.factor_type==='totp'&&x.status==='verified')||
   (f.data?.totp||[]).find(x=>x.status==='verified');
  if(existing){
   s.factor=existing.id;s.qr=null;s.mfaSecret=null;s.mfaMode='verify';
   s.mfaNotice='Authentificateur déjà actif. Entrez le code généré par votre application.';
  }else if(factors.some(x=>x.status==='unverified'&&x.friendly_name==='Console PUNCH')){
   const active=factors.find(x=>x.status==='unverified'&&x.friendly_name==='Console PUNCH');
   if(s.factor!==active.id){s.qr=null;s.mfaSecret=null;}
   s.factor=active.id;s.mfaMode=s.qr?'enroll':'pending';
   s.mfaNotice='Reprenez avec le code déjà présent dans Authenticator.';
  }else{
   const abandoned=factors.filter(x=>x.factor_type==='totp'&&x.status==='unverified'&&
    x.friendly_name==='Console PUNCH');
   // Only remove factors created by the current user's unfinished PUNCH setup.
   // Removing a verified factor here would bypass legitimate account recovery.
   for(const factor of abandoned){
    const removed=await sb.auth.mfa.unenroll({factorId:factor.id});
    if(removed.error)throw removed.error;
   }
   s.factor=null;s.qr=null;s.mfaSecret=null;s.mfaMode='unknown';
   const created=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Console PUNCH'});
   if(created.error)throw created.error;
   if(!created.data?.id||!created.data?.totp?.qr_code||!created.data?.totp?.secret)
    throw Error('Configuration incomplète. Réessayez pour générer un nouveau QR.');
   s.factor=created.data.id;s.qr=created.data.totp.qr_code;
   s.mfaSecret=created.data.totp.secret;s.mfaMode='enroll';
   s.mfaNotice='Nouveau QR créé. Ajoutez-le dans votre application Authenticator, puis entrez son code.';
  }
 }else if(action==='verify'){
  const code=val('ess-mfa-code');
  if(!/^\d{6}$/.test(code))throw Error('Code de six chiffres requis.');
  if(!s.factor){
   const f=await sb.auth.mfa.listFactors();if(f.error)throw f.error;
   const existing=(f.data?.totp||[]).find(x=>x.status==='verified');
   if(existing){s.factor=existing.id;s.mfaMode='verify';}
   else throw Error('Cliquez sur « Configurer ou utiliser mon authentificateur » pour obtenir votre QR.');
  }
  const r=await sb.auth.mfa.challengeAndVerify({factorId:s.factor,code});if(r.error)throw r.error;
  const level=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(level.error||level.data?.currentLevel!=='aal2')
   throw Error('Vérification terminée, mais session à deux facteurs non confirmée. Reconnectez-vous.');
  // The server enforces AAL2, active sessions and platform ownership independently.
  const snapshot=await rpc('platform_snapshot');
  const accounts=await rpc('platform_test_accounts');
  s.snapshot=snapshot;s.testAccounts=accounts;s.qr=null;s.mfaSecret=null;
  s.factor=null;s.mfaNotice='';s.mfaMode='unknown';s.mfaRequired=false;
 }
 }catch(err){s.error=err.message;notify(err.message);}finally{s.saving=false;redraw();}return true;
 }
 function input(el){billing.input(el);subscriptions.input(el);qualifiedCoverage.input(el);laborBudgets.input(el);platformUsers.input(el);platformAdmins.input(el);platformPriceProposals.input(el);directory.input(el);invitationEmail.input(el);notificationPreferences.input(el);supervision.input(el);breakPolicies.input(el);offlineReview.input(el);missingDays.input(el);archives.input(el);finance.input(el);promotions.input(el);audit.input(el);support.input(el);platformTests.input(el);breakCorrections.input(el);planning.input(el);payroll.input(el);if(el.id==='ess-seats'){const n=Number(el.value);if(Number.isSafeInteger(n)&&n>=1&&n<=100000){s.seats=n;redraw();}}if(el.id==='ess-company-search')for(const row of doc.querySelectorAll('[data-company-name]'))row.hidden=!row.dataset.companyName.includes(el.value.toLocaleLowerCase());}
 function reset(){subscriptions.reset();qualifiedCoverage.reset();laborBudgets.reset();platformUsers.reset();platformAdmins.reset();platformPriceProposals.reset();directory.reset();invitationEmail.reset();notificationPreferences.reset();supervision.reset();breakPolicies.reset();offlineReview.reset();missingDays.reset();archives.reset();identityRevision++;s.platformUser=null;finance.reset();promotions.reset();audit.reset();support.reset();platformTests.reset();breakCorrections.reset();payroll.reset();communications.reset();hr.reset();appearance.reset();billing.reset();s.billingOverview=null;planning.reset();s.platform=false;s.effectiveBillingStatus=null;s.snapshot=null;s.testAccounts=[];s.testCredentials=null;s.workers=[];s.worker=null;s.invitationLink=null;s.pairCode=null;s.enrollment=null;s.devices=[];s.qr=null;s.factor=null;s.mfaSecret=null;s.mfaMode='unknown';s.mfaNotice='';s.mfaRequired=true;s.tab='home';}
 return {state:s,subscriptions,qualifiedCoverage,laborBudgets,platformUsers,platformAdmins,platformPriceProposals,directory,invitationEmail,notificationPreferences,supervision,breakPolicies,offlineReview,missingDays,archives,finance,promotions,audit,support,platformTests,breakCorrections,planning,billing,appearance,hr,communications,payroll,reset,load,renderPricing,renderPlatform,renderWorkers,renderKiosks,renderDashboard,handle,input};
}
