import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEssentialController} from '../web/live/essential.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plan={id:'essential_plus',title:'Essentiel Plus',base_cents:3900,included_seats:5,extra_seat_cents:400,annual_discount:15,kiosk_limit:3,establishment_limit:1,features:['punch','hours','csv','offline','personal_account','themes','advanced_schedules'],active:true,public_visible:true,sort_order:2,version:1,grace_days:30,description:'',recommended:true};
function setup(rpc=async()=>({data:true})){const w=new Window();let calls=[];const sb={rpc:async(name,args)=>{calls.push({name,args});return rpc(name,args);}};const ui=createEssentialController({sb,redraw(){},notify(){},escape,document:w.document});ui.state.plans=[{...plan}];return {w,ui,calls};}
test('live pricing uses the configured discount on base and additional people',async()=>{const {w,ui}=setup();ui.state.seats=6;ui.state.cadence='yearly';w.document.body.innerHTML=ui.renderPricing();assert.match(w.document.body.textContent,/438,60/);assert.match(w.document.body.textContent,/77,40/);ui.state.plans[0].annual_discount=20;w.document.body.innerHTML=ui.renderPricing();assert.match(w.document.body.textContent,/Annuel −20 %/);assert.match(w.document.body.textContent,/412,80/);assert.equal(w.document.querySelectorAll('[aria-selected=true]').length,0);await w.happyDOM.close();});
test('platform renders the MFA gate before privileged editors',async()=>{const {w,ui}=setup();ui.state.platform=true;w.document.body.innerHTML=ui.renderPlatform();assert.ok(w.document.querySelector('[data-action="ess:enroll"]'));assert.equal(w.document.getElementById('ess-mfa-code'),null);assert.equal(w.document.getElementById('ess-base'),null);ui.state.mfaRequired=false;ui.state.tab='plans';w.document.body.innerHTML=ui.renderPlatform();assert.equal(w.document.getElementById('ess-base').value,'39.00');assert.equal(w.document.getElementById('ess-mfa-code'),null);await w.happyDOM.close();});
test('worker creation calls the checked RPC, permits no email and never creates an Auth identity',async()=>{const worker={id:'worker',first_name:'Alex',last_name:'',employee_number:'AB-0248',auth_user_id:null};const {w,ui,calls}=setup(async()=>({data:worker}));ui.state.company='tenant';w.document.body.innerHTML=ui.renderWorkers();w.document.getElementById('ess-first').value='Alex';w.document.getElementById('ess-number').value='AB-0248';await ui.handle({dataset:{action:'ess:create-worker'}});assert.equal(calls.length,1);assert.equal(calls[0].name,'create_essential_worker');assert.equal(calls[0].args.p_email,null);assert.equal(calls[0].args.p_phone,null);assert.equal(calls[0].args.p_company,'tenant');assert.equal(ui.state.workers[0].id,'worker');await w.happyDOM.close();});
test('price edits send expected version and a reason, and surface server denial',async()=>{const {w,ui,calls}=setup(async()=>({error:{message:'MFA required'}}));ui.state.mfaRequired=false;ui.state.tab='plans';w.document.body.innerHTML=ui.renderPlatform();w.document.getElementById('ess-base').value='45.50';w.document.getElementById('ess-reason').value='Nouveaux clients seulement';await ui.handle({dataset:{action:'ess:save-plan'}});assert.equal(calls[0].name,'platform_save_essential_plan');assert.equal(calls[0].args.p_expected_version,1);assert.equal(calls[0].args.p_values.base_cents,4550);assert.match(ui.state.error,/MFA required/);assert.equal(ui.state.plans[0].base_cents,3900);await w.happyDOM.close();});
test('personnel names are escaped and private platform state is cleared at signout',async()=>{const {w,ui}=setup();ui.state.workers=[{id:'x',first_name:'<script>alert(1)</script>',last_name:'',employee_number:'AB',status:'active',auth_user_id:null}];w.document.body.innerHTML=ui.renderWorkers();assert.equal(w.document.querySelector('script'),null);ui.state.platform=true;ui.state.snapshot={companies_list:[{name:'private'}]};ui.reset();assert.equal(ui.state.platform,false);assert.equal(ui.state.snapshot,null);assert.equal(ui.state.workers.length,0);await w.happyDOM.close();});
test('choosing a public plan calls signup navigation without claiming payment',async()=>{const w=new Window();let chosen;const ui=createEssentialController({sb:{},redraw(){},notify(){},escape,document:w.document,onChoose:p=>{chosen=p}});ui.state.plans=[plan];await ui.handle({dataset:{action:'ess:choose',id:'essential_plus'}});assert.equal(chosen.id,'essential_plus');assert.equal(ui.state.checkout,'Essentiel Plus');assert.equal(ui.state.paymentConfirmed,undefined);await w.happyDOM.close();});
test('late personnel responses cannot repopulate private state after signout',async()=>{const w=new Window();let release;const pending=new Promise(resolve=>{release=resolve});const sb={rpc:async()=>({data:false}),from(table){const q={select(){return q},eq(){return q},order(){return table==='company_workers'?pending:Promise.resolve({data:[plan]})}};return q;}};const ui=createEssentialController({sb,redraw(){},notify(){},escape,document:w.document});const loading=ui.load({id:'old-user'},{company_id:'tenant',role:'employee',companies:{product_edition:'essential'}});await new Promise(r=>setTimeout(r,0));ui.reset();release({data:[{id:'private-worker',auth_user_id:'old-user',first_name:'Private'}]});await loading;assert.equal(ui.state.worker,null);assert.deepEqual(ui.state.workers,[]);assert.equal(ui.state.platform,false);await w.happyDOM.close();});
test('kiosk navigation uses a static public URL without pairing secrets',async()=>{const {w,ui}=setup();ui.state.devices=[{id:'device',name:'Reception',paired_at:null,revoked_at:null}];ui.state.pairCode='secret-code';w.document.body.innerHTML=ui.renderKiosks();const links=[...w.document.querySelectorAll('a')].filter(a=>a.textContent==='Ouvrir la pointeuse');assert.equal(links.length,1);assert.equal(links[0].getAttribute('href'),'https://punch360app.github.io/Punch360/kiosk.html');assert.equal(new URL(links[0].href).search,'');assert.equal(new URL(links[0].href).hash,'');assert.ok(w.document.querySelector('[data-action="ess:copy-kiosk-link"]'));await w.happyDOM.close();});

test('Admin status uses computed entitlements instead of stale billing_status',async()=>{
 const w=new Window(),calls=[];
 const sb={
  rpc:async(name,args)=>{calls.push(name);return {data:name==='platform_access'?false:name==='essential_entitlements'?{billing_status:'restricted'}:{}};},
  from:()=>({select:()=>({order:async()=>({data:[plan],error:null}),eq:()=>({order:async()=>({data:null,error:{message:'Management request denied'}})})})})
 };
 const ui=createEssentialController({sb,redraw(){},notify(){},escape,document:w.document});
 await ui.load({id:'user'},{company_id:'tenant',role:'admin',companies:{product_edition:'essential',billing_status:'active'}});
 assert.ok(calls.includes('essential_entitlements'));
 assert.equal(ui.state.effectiveBillingStatus,'restricted');
 ui.reset();
 assert.equal(ui.state.effectiveBillingStatus,null);
 await w.happyDOM.close();
});
test('failed entitlement check cannot silently reopen management',async()=>{
 const w=new Window();
 const sb={
  rpc:async name=>name==='essential_entitlements'?{error:{message:'Not authorized'}}:{data:false},
  from:()=>({select:()=>({order:async()=>({data:[plan],error:null})})})
 };
 const ui=createEssentialController({sb,redraw(){},notify(){},escape,document:w.document});
 await ui.load({id:'user'},{company_id:'tenant',role:'admin',companies:{product_edition:'essential',billing_status:'active'}});
 assert.equal(ui.state.effectiveBillingStatus,'restricted');
 await w.happyDOM.close();
});

test('SACATALOG-016 unlimited catalog switch is MFA gated and uses a versioned server update',async()=>{
 const {w,ui,calls}=setup(async()=>({error:{message:'MFA required'}}));
 ui.state.plans[0].included_seats_unlimited=true;
 ui.state.seats=200;
 w.document.body.innerHTML=ui.renderPricing();
 assert.match(w.document.body.textContent,/Membres inclus : illimité/);
 assert.match(w.document.body.textContent,/39,00/);
 ui.state.platform=true;
 w.document.body.innerHTML=ui.renderPlatform();
 assert.equal(w.document.getElementById('ess-included-unlimited'),null,'MFA gate blocks editor');
 ui.state.mfaRequired=false;
 ui.state.tab='plans';
 w.document.body.innerHTML=ui.renderPlatform();
 const unlimited=w.document.getElementById('ess-included-unlimited');
 assert.ok(unlimited);
 assert.equal(unlimited.checked,true);
 unlimited.checked=false;
 w.document.getElementById('ess-reason').value='Modifier le forfait pour la prochaine version';
 await ui.handle({dataset:{action:'ess:save-plan'}});
 const call=calls.find(c=>c.name==='platform_save_essential_plan');
 assert.ok(call);
 assert.equal(call.args.p_expected_version,1);
 assert.equal(call.args.p_values.included_seats_unlimited,false);
 assert.equal(call.args.p_values.included_seats,5);
 assert.equal(ui.state.plans[0].included_seats_unlimited,true,'failed server call cannot mutate catalog');
 await w.happyDOM.close();
});


test('Super Admin opens on a real overview instead of plan editor',async()=>{
 const {w,ui}=setup();
 assert.equal(ui.state.tab,'home');
 ui.state.platform=true;ui.state.mfaRequired=false;
 ui.state.snapshot={companies:12,users:78,active_members:45,test_companies:3,essential:8,construction:4,
  audit:[{action:'test_company_created',created_at:'2026-10-28T11:00:00Z'}]};
 w.document.body.innerHTML=ui.renderPlatform();
 assert.equal(w.document.querySelector('main h2')?.textContent,'Accueil');
 assert.equal(w.document.querySelectorAll('.ess-home-stat').length,4);
 assert.match(w.document.querySelector('.ess-platform-home')?.textContent||'',/78/);
 assert.match(w.document.querySelector('.ess-platform-home')?.textContent||'',/45/);
 assert.match(w.document.querySelector('.ess-platform-home')?.textContent||'',/8/);
 assert.equal(w.document.querySelector('[data-action="ess:tab"][data-id="admins"]'),null);
 assert.equal(w.document.getElementById('ess-base'),null);
 assert.equal(w.document.querySelectorAll('.ess-home-link').length,6);
 await w.happyDOM.close();
});
test('Home shortcuts open existing sections, and never offer the former admin tab',async()=>{
 const {w,ui}=setup();ui.state.mfaRequired=false;
 w.document.body.innerHTML=ui.renderPlatform();
 const target=w.document.querySelector('.ess-home-link[data-id="plans"]');
 assert.ok(target);
 await ui.handle({dataset:{action:target.dataset.action,id:target.dataset.id}});
 assert.equal(ui.state.tab,'plans');
 assert.ok(ui.renderPlatform().includes('Paramètres du forfait sélectionné'));
 const menu=w.document.createElement('div');menu.innerHTML=ui.renderPlatform();
 assert.equal(menu.querySelector('nav [data-id="admins"]'),null);
 ui.reset();assert.equal(ui.state.tab,'home');
 await w.happyDOM.close();
});
test('Home is MFA-gated, no guessed numbers and no untrusted audit injection',async()=>{
 const {w,ui}=setup();
 ui.state.platform=true;
 ui.state.snapshot={audit:[{action:'<img src=x onerror=alert(1)>',created_at:'invalid'}]};
 w.document.body.innerHTML=ui.renderPlatform();
 assert.ok(w.document.querySelector('[data-action="ess:enroll"]'));
 assert.equal(w.document.getElementById('ess-mfa-code'),null);
 assert.equal(w.document.querySelector('.ess-platform-home'),null);
 ui.state.mfaRequired=false;
 w.document.body.innerHTML=ui.renderPlatform();
 assert.match(w.document.body.textContent,/donnée n’est pas disponible/);
 assert.equal(w.document.querySelector('img'),null);
 assert.match(w.document.body.textContent,/Activité administrative/);
 assert.match(w.document.body.textContent,/Date indisponible/);
 await w.happyDOM.close();
});
test('Super Admin mobile stylesheet collapses the sidebar on tablet and desktop-view phones',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../web/live/essential.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:1050px\)\s*\{[\s\S]*?\.ess-platform\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.ess-platform nav\{flex-direction:row;overflow-x:auto/);
});


function setupMfa({factors=[],verificationError=null,level='aal2',confirmRestart=()=>true}={}){
 const w=new Window(),calls=[];
 let liveLevel=level;
 const sb={
  from:()=>({select:()=>({order:async()=>({data:[plan],error:null})})}),
  rpc:async(name)=>({data:name==='platform_access'?true:name==='platform_snapshot'?{companies:1}:
   name==='platform_test_accounts'?[]:true}),
  auth:{mfa:{
   listFactors:async()=>{calls.push('list');return {data:{all:[...factors],
     totp:factors.filter(x=>x.status==='verified'&&x.factor_type==='totp')}};},
   unenroll:async({factorId})=>{
    calls.push('unenroll:'+factorId);
    const target=factors.find(f=>f.id===factorId);
    if(!target||target.status!=='unverified')return{error:{message:'Interdiction de retirer un facteur validé'}};
    factors=factors.filter(f=>f.id!==factorId);return{data:{}};
   },
   enroll:async({factorType,friendlyName})=>{
    calls.push('enroll:'+friendlyName);
    if(factors.some(x=>x.friendly_name===friendlyName))return{error:{message:'duplicate friendly name'}};
    assert.equal(factorType,'totp');
    factors.push({id:'new',factor_type:'totp',status:'unverified',friendly_name:friendlyName});
    return{data:{id:'new',totp:{qr_code:'data:image/svg+xml;base64,QVI=',secret:'ABCDE12345'}}};
   },
   challengeAndVerify:async({factorId,code})=>{
    calls.push('verify:'+factorId);
    assert.equal(code,'123456');
    if(verificationError)return{error:{message:verificationError}};
    liveLevel='aal2';return{data:{}};
   },
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:liveLevel}})
  }}
 };
 const ui=createEssentialController({sb,redraw(){},notify(){},escape,document:w.document,confirmRestart});
 ui.state.platform=true;ui.state.mfaRequired=true;
 return{w,ui,calls};
}
test('unfinished TOTP Console PUNCH is re-enrolled, new QR and manual key displayed',async()=>{
 const old={id:'unfinished',factor_type:'totp',status:'unverified',friendly_name:'Console PUNCH'};
 const {w,ui,calls}=setupMfa({factors:[old]});
 await ui.handle({dataset:{action:'ess:restart-mfa'}});
 assert.deepEqual(calls,['list','unenroll:unfinished','enroll:Console PUNCH']);
 assert.equal(ui.state.factor,'new');
 assert.equal(ui.state.mfaMode,'enroll');
 w.document.body.innerHTML=ui.renderPlatform();
 assert.equal(w.document.getElementById('ess-mfa-secret')?.value,'ABCDE12345');
 assert.equal(w.document.querySelector('.ess-qr')?.getAttribute('src'),'data:image/svg+xml;base64,QVI=');
 assert.ok(w.document.getElementById('ess-mfa-code'));
 w.document.getElementById('ess-mfa-code').value='123456';
 await ui.handle({dataset:{action:'ess:verify'}});
 assert.equal(ui.state.mfaRequired,false);
 assert.equal(ui.state.mfaSecret,null);
 assert.equal(ui.state.snapshot.companies,1);
 await w.happyDOM.close();
});
test('verified factor is reused; no unenroll or new enrolment',async()=>{
 const v={id:'verified',status:'verified',factor_type:'totp',friendly_name:'Console PUNCH'};
 const {w,ui,calls}=setupMfa({factors:[v]});
 await ui.handle({dataset:{action:'ess:enroll'}});
 assert.deepEqual(calls,['list']);
 assert.equal(ui.state.factor,'verified');
 assert.equal(ui.state.mfaMode,'verify');
 assert.doesNotMatch(ui.renderPlatform(),/ess-mfa-secret/);
 assert.match(ui.renderPlatform(),/déjà activé/);
 await w.happyDOM.close();
});
test('unfinished unrelated factor is not removed or overwritten',async()=>{
 const v={id:'other',status:'unverified',factor_type:'totp',friendly_name:'Personal factor'};
 const {w,ui,calls}=setupMfa({factors:[v]});
 await ui.handle({dataset:{action:'ess:enroll'}});
 assert.deepEqual(calls,['list','enroll:Console PUNCH']);
 await w.happyDOM.close();
});
test('wrong code never unlocks; root MFA remains mandatory on failures',async()=>{
 const v={id:'verified',status:'verified',factor_type:'totp',friendly_name:'Console PUNCH'};
 const {w,ui,calls}=setupMfa({factors:[v],verificationError:'Code invalide'});
 await ui.handle({dataset:{action:'ess:enroll'}});
 w.document.body.innerHTML=ui.renderPlatform();
 w.document.getElementById('ess-mfa-code').value='123456';
 await ui.handle({dataset:{action:'ess:verify'}});
 assert.ok(calls.includes('verify:verified'));
 assert.equal(ui.state.mfaRequired,true);
 assert.equal(ui.state.snapshot,null);
 assert.match(ui.state.error,/Code invalide/);
 await w.happyDOM.close();
});
test('logout clears QR and the secret, no leakage into next account session',async()=>{
 const {w,ui}=setupMfa({factors:[]});
 await ui.handle({dataset:{action:'ess:enroll'}});
 assert.equal(ui.state.mfaSecret,'ABCDE12345');
 ui.reset();
 assert.equal(ui.state.mfaSecret,null);
 assert.equal(ui.state.qr,null);
 assert.equal(ui.state.factor,null);
 assert.equal(ui.state.mfaMode,'unknown');
 await w.happyDOM.close();
});
test('MFA setup does not display verification code entry before QR is prepared',async()=>{
 const {w,ui}=setupMfa({factors:[]});
 w.document.body.innerHTML=ui.renderPlatform();
 assert.equal(w.document.getElementById('ess-mfa-code'),null);
 assert.ok(w.document.querySelector('[data-action="ess:enroll"]'));
 await w.happyDOM.close();
});
