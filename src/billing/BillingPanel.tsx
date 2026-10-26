import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {billingGuardedResult,createNativeBillingOperationGuard} from './nativeBillingOperationGuard';
type Checked=<T>(operation:()=>Promise<T>)=>Promise<T>;
export function BillingPanel({account}:{account:WorkspaceAccount}){
 const [summary,setSummary]=useState<any>(null),[offer,setOffer]=useState<any>(null),[plans,setPlans]=useState<any[]>([]),[plan,setPlan]=useState('essential'),[cadence,setCadence]=useState<'monthly'|'yearly'>('monthly'),[seats,setSeats]=useState('5'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[configured,setConfigured]=useState(false),[order,setOrder]=useState<string|null>(null),[preview,setPreview]=useState<any>(null),[invoices,setInvoices]=useState<any[]>([]);const epoch=useRef(0);
 const renewalAttempt=useRef<{company:string;action:'cancel'|'resume';id:string}|null>(null);
 const operationGuard=useRef(createNativeBillingOperationGuard());
 const busyRef=useRef(false);
 const scopeKey=account.companyId+':'+account.userId;
 const money=(n:number)=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(n/100);
 async function rpc(name:string,args:any){const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function call(action:string,extra:any={}){const r=await supabase.functions.invoke('essential-billing',{body:{action,companyId:account.companyId,...extra}});if(r.error)throw r.error;if(r.data.error)throw Error(r.data.error);return r.data;}
 async function load(){
  const n=++epoch.current;setError('');setConfigured(false);setSummary(null);setOffer(null);setPlans([]);setInvoices([]);
  try{
   // Keep the server-confirmed access state visible when Stripe is unavailable.
   const summary=await rpc('essential_billing_summary',{p_company:account.companyId});
   if(n!==epoch.current)return;
   setSummary(summary);try{const latest=await rpc('essential_company_price_offer',{p_company:account.companyId});if(n!==epoch.current)return;setOffer(latest);}catch{if(n!==epoch.current)return;setOffer(null);}setPlan(summary.contract?.plan_id||'essential');setCadence(summary.contract?.cadence||'monthly');setSeats(String(summary.seats));
   const p=await supabase.from('essential_plans').select('*').order('sort_order');
   if(n!==epoch.current)return;
   if(p.error)throw p.error;
   setPlans(p.data||[]);
   try{
    const c=await call('status');
    if(n!==epoch.current)return;
    setConfigured(c.configured===true);
    if(c.configured){
     try{const i=await call('invoices');if(n===epoch.current)setInvoices(i.invoices||[]);}
     catch(e:any){if(n===epoch.current)setError('Factures indisponibles : '+e.message);}
    }
   }catch(e:any){if(n===epoch.current)setError('Service Stripe indisponible : '+e.message);}
  }catch(e:any){if(n===epoch.current)setError(e.message);}
 }
 useEffect(()=>{
  operationGuard.current.activate(scopeKey);
  busyRef.current=false;
  renewalAttempt.current=null;
  void load();
  return()=>{
   operationGuard.current.invalidate();
   epoch.current++;busyRef.current=false;
   renewalAttempt.current=null;
  };
 },[scopeKey]);
 async function run(fn:(checked:Checked)=>Promise<void>){
  if(busyRef.current)return;
  const current=operationGuard.current.begin(scopeKey);
  if(!current())return; // e.g. Alert callback fired after sign-out
  busyRef.current=true;setBusy(true);setError('');
  const checked:Checked=operation=>billingGuardedResult(current,operation);
  try{await fn(checked);}
  catch(e:any){if(current())setError(e.message||'BILLING_REQUEST_FAILED');}
  finally{if(current()){busyRef.current=false;setBusy(false);}}
 }
 async function open(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com','invoice.stripe.com','pay.stripe.com'].includes(u.hostname))throw Error('Lien de paiement invalide');await Linking.openURL(url);}
 const button=(text:string,fn:(checked:Checked)=>Promise<void>,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={()=>run(fn)} style={{padding:15,borderRadius:10,backgroundColor:disabled?'#c9d3c3':'#4D7051',marginVertical:4}}><Text style={{color:'white',fontWeight:'600'}}>{text}</Text></Pressable>;
 return <ScrollView contentContainerStyle={{padding:20,gap:12,backgroundColor:'#FAFBF8'}}><Text style={{fontSize:24,fontWeight:'700',color:'#2F4935'}}>Abonnement et factures</Text>{error?<Text accessibilityRole="alert" style={{color:'#a74132'}}>{error}</Text>:null}{summary?<><Text>{summary.status} · {summary.active_humans} personnes actives · {summary.seats} places</Text>{!configured?<Text>Stripe attend sa configuration serveur.</Text>:null}{summary.test_company?<Text>Compagnie test : paiements réels interdits.</Text>:null}{summary.paid_through?<Text>Payé jusqu’au {new Date(summary.paid_through).toLocaleDateString('fr-CA')}</Text>:null}{offer?<View style={{padding:16,backgroundColor:'white',borderRadius:12,gap:6}}>
 <Text style={{fontWeight:'700',color:'#2F4935'}}>Offre négociée PUNCH</Text>
 <Text>{offer.title||offer.plan_id} · {offer.seats} places · {money(offer.due_cents)} {offer.cadence==='yearly'?'par an':'par mois'}, avant taxes.</Text>
 <Text>Offre valide à partir du {offer.effective_on}. Aucun changement de contrat sans votre acceptation et le paiement confirmé par Stripe.</Text>
 {button('Accepter l’offre et prévisualiser',async checked=>{
  if(!offer.available||!configured||summary.test_company)throw Error('Offre non disponible.');
  const id=await checked(()=>rpc('essential_company_price_order',{p_company:account.companyId,p_approval_version:offer.approval_version}));
  setOrder(id);
  if(summary.has_subscription){const p=await checked(()=>call('preview',{orderId:id}));setPreview({amount:p.preview.amount_due,effective:p.preview.effective_at});}
  else setPreview({amount:offer.due_cents});
 },!configured||summary.test_company||!offer.available)}
 </View>:null}<Text>Forfait</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{plans.map(p=><Pressable key={p.id} onPress={()=>{setPlan(p.id);setPreview(null);}} style={{padding:12,borderWidth:1,borderColor:plan===p.id?'#4D7051':'#E1E8DB',borderRadius:8}}><Text>{p.title}</Text></Pressable>)}</View><View style={{flexDirection:'row',gap:10}}>{(['monthly','yearly'] as const).map(c=><Pressable key={c} onPress={()=>{setCadence(c);setPreview(null);}} style={{padding:12,backgroundColor:cadence===c?'#dce9d6':'white'}}><Text>{c==='monthly'?'Mensuel':'Annuel'}</Text></Pressable>)}</View><Text>Places humaines</Text><TextInput accessibilityLabel="Nombre de places" keyboardType="number-pad" value={seats} onChangeText={v=>{setSeats(v);setPreview(null);}} style={{padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/>{button('Prévisualiser',async checked=>{const count=Number(seats);if(!Number.isSafeInteger(count)||count<1)throw Error('Places invalides');const id=await checked(()=>rpc('essential_billing_order',{p_company:account.companyId,p_plan:plan,p_cadence:cadence,p_seats:count}));setOrder(id);if(summary.has_subscription){const p=await checked(()=>call('preview',{orderId:id}));setPreview({amount:p.preview.amount_due,effective:p.preview.effective_at});}else{const q=await checked(()=>rpc('essential_quote',{p_plan:plan,p_seats:count,p_cadence:cadence}));setPreview({amount:q.due_cents});}},!configured||summary.test_company)}{preview?<View style={{padding:16,backgroundColor:'white',borderRadius:10}}><Text>{money(preview.amount)} · {summary.has_subscription?'prévisualisation Stripe':'avant taxes'}</Text>{preview.effective?<Text>Date d’effet : {new Date(preview.effective*1000).toLocaleString('fr-CA')}</Text>:null}{button(summary.has_subscription?'Confirmer le changement':'Continuer vers Stripe',async checked=>{const r=await checked(()=>call(summary.has_subscription?'confirm':'checkout',{orderId:order}));if(r.url)await checked(()=>open(r.url));else{setPreview(null);await checked(()=>load());}})}</View>:null}{summary.has_subscription?<>{button('Portail de paiement',async checked=>{const portal=await checked(()=>call('portal'));await checked(()=>open(portal.url));})}{button(summary.canceled?'Reprendre le renouvellement':'Résilier à l’échéance',async()=>{Alert.alert('Renouvellement',summary.canceled?'Reprendre le renouvellement automatique ?':'Résilier à la fin de la période payée ?',[{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>run(async checked=>{const action=summary.canceled?'resume':'cancel'; const prior=renewalAttempt.current; const id=prior?.company===account.companyId&&prior.action===action?prior.id:Crypto.randomUUID(); renewalAttempt.current={company:account.companyId,action,id}; await checked(()=>call(action,{requestId:id})); renewalAttempt.current=null; await checked(()=>load());})}]);})}</>:null}<Text>Factures</Text>{invoices.map(i=><View key={i.id}><Text>{i.number||i.id} · {i.status} · {money(i.total)}</Text>{i.url?button('Ouvrir la facture',async checked=>{await checked(()=>open(i.url));}):null}</View>)}<Text>Les places changent après confirmation serveur du paiement. Une borne ne consomme pas de place humaine.</Text>{button('Actualiser',load)}</>:<Text>Chargement…</Text>}</ScrollView>;
}
