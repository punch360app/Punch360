import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
export function BillingPanel({account}:{account:WorkspaceAccount}){
 const [summary,setSummary]=useState<any>(null),[plans,setPlans]=useState<any[]>([]),[plan,setPlan]=useState('essential'),[cadence,setCadence]=useState<'monthly'|'yearly'>('monthly'),[seats,setSeats]=useState('5'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[configured,setConfigured]=useState(false),[order,setOrder]=useState<string|null>(null),[preview,setPreview]=useState<any>(null),[invoices,setInvoices]=useState<any[]>([]);const epoch=useRef(0);
 const money=(n:number)=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(n/100);
 async function rpc(name:string,args:any){const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function call(action:string,extra:any={}){const r=await supabase.functions.invoke('essential-billing',{body:{action,companyId:account.companyId,...extra}});if(r.error)throw r.error;if(r.data.error)throw Error(r.data.error);return r.data;}
 async function load(){
  const n=++epoch.current;setError('');setConfigured(false);setSummary(null);setPlans([]);setInvoices([]);
  try{
   // Keep the server-confirmed access state visible when Stripe is unavailable.
   const summary=await rpc('essential_billing_summary',{p_company:account.companyId});
   if(n!==epoch.current)return;
   setSummary(summary);setPlan(summary.contract?.plan_id||'essential');setCadence(summary.contract?.cadence||'monthly');setSeats(String(summary.seats));
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
 useEffect(()=>{load();return()=>{epoch.current++;}},[account.companyId]);
 async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function open(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com','invoice.stripe.com','pay.stripe.com'].includes(u.hostname))throw Error('Lien de paiement invalide');await Linking.openURL(url);}
 const button=(text:string,fn:()=>Promise<void>,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={()=>run(fn)} style={{padding:15,borderRadius:10,backgroundColor:disabled?'#c9d3c3':'#4D7051',marginVertical:4}}><Text style={{color:'white',fontWeight:'600'}}>{text}</Text></Pressable>;
 return <ScrollView contentContainerStyle={{padding:20,gap:12,backgroundColor:'#FAFBF8'}}><Text style={{fontSize:24,fontWeight:'700',color:'#2F4935'}}>Abonnement et factures</Text>{error?<Text accessibilityRole="alert" style={{color:'#a74132'}}>{error}</Text>:null}{summary?<><Text>{summary.status} · {summary.active_humans} personnes actives · {summary.seats} places</Text>{!configured?<Text>Stripe attend sa configuration serveur.</Text>:null}{summary.test_company?<Text>Compagnie test : paiements réels interdits.</Text>:null}{summary.paid_through?<Text>Payé jusqu’au {new Date(summary.paid_through).toLocaleDateString('fr-CA')}</Text>:null}<Text>Forfait</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{plans.map(p=><Pressable key={p.id} onPress={()=>{setPlan(p.id);setPreview(null);}} style={{padding:12,borderWidth:1,borderColor:plan===p.id?'#4D7051':'#E1E8DB',borderRadius:8}}><Text>{p.title}</Text></Pressable>)}</View><View style={{flexDirection:'row',gap:10}}>{(['monthly','yearly'] as const).map(c=><Pressable key={c} onPress={()=>{setCadence(c);setPreview(null);}} style={{padding:12,backgroundColor:cadence===c?'#dce9d6':'white'}}><Text>{c==='monthly'?'Mensuel':'Annuel'}</Text></Pressable>)}</View><Text>Places humaines</Text><TextInput accessibilityLabel="Nombre de places" keyboardType="number-pad" value={seats} onChangeText={v=>{setSeats(v);setPreview(null);}} style={{padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/>{button('Prévisualiser',async()=>{const count=Number(seats);if(!Number.isSafeInteger(count)||count<1)throw Error('Places invalides');const id=await rpc('essential_billing_order',{p_company:account.companyId,p_plan:plan,p_cadence:cadence,p_seats:count});setOrder(id);if(summary.has_subscription){const p=await call('preview',{orderId:id});setPreview({amount:p.preview.amount_due,effective:p.preview.effective_at});}else{const q=await rpc('essential_quote',{p_plan:plan,p_seats:count,p_cadence:cadence});setPreview({amount:q.due_cents});}},!configured||summary.test_company)}{preview?<View style={{padding:16,backgroundColor:'white',borderRadius:10}}><Text>{money(preview.amount)} · {summary.has_subscription?'prévisualisation Stripe':'avant taxes'}</Text>{preview.effective?<Text>Date d’effet : {new Date(preview.effective*1000).toLocaleString('fr-CA')}</Text>:null}{button(summary.has_subscription?'Confirmer le changement':'Continuer vers Stripe',async()=>{const r=await call(summary.has_subscription?'confirm':'checkout',{orderId:order});if(r.url)await open(r.url);else{setPreview(null);await load();}})}</View>:null}{summary.has_subscription?<>{button('Portail de paiement',async()=>{await open((await call('portal')).url);})}{button(summary.canceled?'Reprendre le renouvellement':'Résilier à l’échéance',async()=>{Alert.alert('Renouvellement',summary.canceled?'Reprendre le renouvellement automatique ?':'Résilier à la fin de la période payée ?',[{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>run(async()=>{await call(summary.canceled?'resume':'cancel',{requestId:Date.now().toString()});await load();})}]);})}</>:null}<Text>Factures</Text>{invoices.map(i=><View key={i.id}><Text>{i.number||i.id} · {i.status} · {money(i.total)}</Text>{i.url?button('Ouvrir la facture',async()=>{await open(i.url);}):null}</View>)}<Text>Les places changent après confirmation serveur du paiement. Une borne ne consomme pas de place humaine.</Text>{button('Actualiser',load)}</>:<Text>Chargement…</Text>}</ScrollView>;
}
