import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {allowedLaborDepartment,createLaborBudgetScope,laborBudgetAmountCents,laborBudgetMonday,matchesLaborReport,scopedLaborBudget,thisLaborBudgetMonday,validLaborBudgetReason} from './laborBudgetScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createLaborBudgetScope>['current']>;
const MAX_DEPARTMENTS=250,MAX_BUDGETS=250;
const noAccess='Permission Rémunération et module Coûts requis.';
const readError='Impossible de charger les budgets de cet espace. Vérifie les autorisations ou réessaie.';
const writeError='Action impossible ou autorisation refusée. Actualise les données avant de réessayer.';
export function LaborBudgetsPanel({account}:{account:WorkspaceAccount}){
 const [weekInput,setWeekInput]=useState(thisLaborBudgetMonday);
 const [loadedWeek,setLoadedWeek]=useState(thisLaborBudgetMonday);
 const [department,setDepartment]=useState('');
 const [amount,setAmount]=useState(''),[reason,setReason]=useState('');
 const [departments,setDepartments]=useState<Row[]>([]),[budgets,setBudgets]=useState<Row[]>([]);
 const [report,setReport]=useState<Row|null>(null),[allowed,setAllowed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const scope=useRef(createLaborBudgetScope(account,loadedWeek,department));
 const latest=useRef({account,loadedWeek,department});
 latest.current={account,loadedWeek,department};
 const alive=useRef(false),requestNumber=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account,loadedWeek,department);
 const current=(token:Token)=>{
  const x=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(x.account,x.loadedWeek,x.department);
 };
 const disabled=!identityMatches||loading||busy||!loaded||!allowed;
 const currentBudget=()=>budgets.find(b=>scopedLaborBudget(b,account,loadedWeek,department));
 const money=(value:unknown)=>{
  if(value==null||typeof value!=='number'||!Number.isFinite(value))return 'À compléter';
  return new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(value/100);
 };
 const button=(title:string,fn:()=>void,extraDisabled=false)=><Pressable accessibilityRole="button"
  accessibilityLabel={title} accessibilityState={{disabled:disabled||extraDisabled}}
  disabled={disabled||extraDisabled} onPress={fn}
  style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:'#E1E8DB',borderRadius:8,opacity:disabled||extraDisabled?0.5:1}}>
  <Text style={{color:'#2F4935'}}>{title}</Text>
 </Pressable>;
 const field=(title:string,value:string,change:(v:string)=>void)=><View style={{gap:4}}>
  <Text style={{color:'#2F4935'}}>{title}</Text>
  <TextInput accessibilityLabel={title} editable={!disabled}
   value={value} onChangeText={change} maxLength={1000}
   style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,color:'#2F4935'}}/>
 </View>;
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte ou sélection modifiés');
  const r=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte ou sélection modifiés');
  if(r.error)throw Error('Autorisation refusée');
  return r.data;
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const request=++requestNumber.current;
  setLoading(true);setLoaded(false);setAllowed(false);setNotice('');
  setBudgets([]);setDepartments([]);setReport(null);
  try{
   laborBudgetMonday(loadedWeek);
   const [access,ent]=await Promise.all([
    rpc('essential_hr_access',{p_company:account.companyId},token),
    rpc('essential_entitlements',{p_company:account.companyId},token)
   ]);
   if(!current(token)||request!==requestNumber.current)return false;
   const can=access?.compensation===true&&Array.isArray(ent?.features)&&ent.features.includes('labor_costs');
   if(!can){
    setError(noAccess);setAllowed(false);setLoaded(true);return false;
   }
   const [d,b]=await Promise.all([
    supabase.from('essential_departments').select('id,company_id,name,active')
     .eq('company_id',account.companyId).order('name').limit(MAX_DEPARTMENTS+1),
    supabase.from('essential_labor_budgets').select('id,company_id,department_id,week_start,amount_cents,version')
     .eq('company_id',account.companyId).eq('week_start',loadedWeek).limit(MAX_BUDGETS+1)
   ]);
   if(!current(token)||request!==requestNumber.current)return false;
   if(d.error||b.error||!Array.isArray(d.data)||!Array.isArray(b.data)||
    d.data.length>MAX_DEPARTMENTS||b.data.length>MAX_BUDGETS||
    d.data.some(x=>x.company_id!==account.companyId)||
    b.data.some(x=>x.company_id!==account.companyId||x.week_start!==loadedWeek)){
    throw Error('Données incomplètes');
   }
   if(!allowedLaborDepartment(department,d.data)){
    setAllowed(false);setError('Département indisponible. Choisis un autre périmètre.');setLoaded(false);return false;
   }
   setDepartments(d.data);setBudgets(b.data);setAllowed(true);setLoaded(true);setError('');return true;
  }catch{
   if(current(token)&&request===requestNumber.current){
    setDepartments([]);setBudgets([]);setReport(null);setAllowed(false);setLoaded(false);setError(readError);
   }
   return false;
  }finally{if(current(token)&&request===requestNumber.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account,loadedWeek,department);
  alive.current=true;requestNumber.current++;actionLock.current=false;
  setDepartments([]);setBudgets([]);setReport(null);setAllowed(false);
  setBusy(false);setLoading(true);setLoaded(false);setError('');setNotice('');
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();requestNumber.current++};
 },[account.companyId,account.userId,account.role,account.edition,loadedWeek,department]);
 // Account switching clears the unsubmitted draft and the selected scope. A mere week/dept change
 // keeps amount/reason so the user can compare without losing work.
 useEffect(()=>{
  setWeekInput(thisLaborBudgetMonday());setLoadedWeek(thisLaborBudgetMonday());
  setDepartment('');setAmount('');setReason('');
 },[account.companyId,account.userId,account.role,account.edition]);

 async function run(fn:(token:Token)=>Promise<void>,refresh=false){
  const token=scope.current.current();
  if(disabled||actionLock.current||!current(token))return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await fn(token);
   if(!current(token))return;
   if(refresh){
    const ok=await load(token);
    if(current(token)&&ok)setNotice('Budget actualisé.');
   }else setNotice('Action enregistrée.');
  }catch{
   if(current(token))setError(writeError);
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function displayWeek(){
  let nextWeek:string;
  try{nextWeek=laborBudgetMonday(weekInput)}
  catch(e){setError(e instanceof Error?e.message:'Lundi invalide.');return;}
  if(nextWeek===loadedWeek){
   setReport(null);setError('');void load();
  }else{
   setError('');setReport(null);setLoadedWeek(nextWeek);
  }
 }
 function save(){
  let cents:number;
  try{
   laborBudgetMonday(weekInput);
   if(weekInput!==loadedWeek)throw Error('Affiche d’abord la semaine choisie.');
   if(!allowedLaborDepartment(department,departments))throw Error('Département non autorisé.');
   cents=laborBudgetAmountCents(amount);
   if(!validLaborBudgetReason(reason))throw Error('Motif requis (3 à 1000 caractères).');
  }catch(e){setError(e instanceof Error?e.message:'Budget invalide.');return;}
  const version=currentBudget()?.version||0;
  const selectedWeek=loadedWeek,selectedDepartment=department,selectedReason=reason.trim();
  void run(async token=>{
   await rpc('save_essential_labor_budget',{
    p_company:account.companyId,p_department:selectedDepartment||null,p_week:selectedWeek,
    p_amount:cents,p_expected_version:version,p_reason:selectedReason
   },token);
   if(current(token))setReport(null);
  },true);
 }
 function evaluate(){
  const budget=currentBudget();
  if(!budget||!scopedLaborBudget(budget,account,loadedWeek,department)){
   setError('Enregistre et actualise le budget de cette semaine.');return;
  }
  void run(async token=>{
   const response=await rpc('evaluate_essential_labor_budget',{p_budget:budget.id},token);
   if(!current(token))return;
   if(!matchesLaborReport(response?.payload,budget,loadedWeek,department))
    throw Error('Rapport différent du budget demandé');
   setReport(response.payload);
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte ou de période en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,gap:14}}>
  <Text style={{fontSize:24,color:'#2F4935'}}>Budgets de main-d’œuvre</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des autorisations et budgets…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:'#E1E8DB',borderRadius:8}}>
   <Text style={{color:'#2F4935'}}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {loaded&&allowed?<>
   <Text>Comparaison avec les coûts bruts estimatifs des heures pointées. Aucune heure officielle modifiée.</Text>
   {field('Lundi AAAA-MM-JJ',weekInput,v=>{setWeekInput(v);setReport(null)})}
   <Text>Semaine affichée : {loadedWeek}</Text>
   {button('Afficher cette semaine',displayWeek)}
   <Text>Périmètre</Text>
   {[{id:'',name:'Entreprise entière'},...departments.filter(d=>d.active)].map(d=>
    <Pressable key={d.id} accessibilityRole="radio"
     accessibilityState={{selected:department===d.id,disabled}}
     disabled={disabled} onPress={()=>{setDepartment(d.id);setReport(null)}}
     style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:8,backgroundColor:department===d.id?'#E1E8DB':'#FFFFFF'}}>
     <Text style={{color:'#2F4935'}}>{department===d.id?'● ':'○ '}{d.name}</Text>
    </Pressable>)}
   <Text>{currentBudget()?'Budget : '+money(currentBudget()!.amount_cents)+' · v'+currentBudget()!.version:'Aucun budget enregistré pour ce périmètre.'}</Text>
   {field('Nouveau budget $ CA',amount,setAmount)}
   {field('Motif',reason,setReason)}
   {button('Enregistrer le budget',save)}
   {button('Conserver une comparaison',evaluate,!currentBudget())}
   {report&&matchesLaborReport(report,currentBudget(),loadedWeek,department)?<View style={{gap:10,padding:14,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}>
    <Text>Semaine du {String(report.week)} · budget v{String(report.budget_version)}</Text>
    <Text>Budget : {money(report.budget_cents)}</Text>
    <Text>Coût estimé : {money(report.estimated_cents)}</Text>
    <Text>Écart (coût − budget) : {money(report.variance_cents)}</Text>
    {report.incomplete?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>
     Comparaison incomplète : {String(report.missing_rates)} taux manquant(s),
     {String(report.open_punches)} session(s) ouverte(s). Somme partielle connue : {money(report.known_estimate_cents)}.
    </Text>:null}
    <Text>Planifiées brutes : {(Number(report.planned_gross_seconds||0)/3600).toFixed(2)} h · {String(report.vacant_shifts)} quart(s) vacant(s).</Text>
    <Text>{String(report.notice||'')}</Text>
    <Text>Fuseau {String(report.timezone||'inconnu')} · règles v{String(report.payroll_rule_version||'inconnue')}</Text>
   </View>:null}
  </>:!loading?<Text>{noAccess}</Text>:null}
 </ScrollView>;
}
