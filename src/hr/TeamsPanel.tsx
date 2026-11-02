import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {LeadTeamHours,parseLeadTeamHours} from './teamHoursOverview';
type Team={id:string;name:string;lead_user_id:string};
type Person={user_id:string;role:string};
const colors={panel:'#122632',line:'#36505A',text:'#FFFFFF',muted:'#9BB0BD',gold:'#FFBF40'};
export function TeamsPanel({account}:{account:WorkspaceAccount}){
 const [teams,setTeams]=useState<Team[]>([]);
 const [people,setPeople]=useState<Person[]>([]);
 const [name,setName]=useState('');
 const [lead,setLead]=useState('');
 const [selectedTeam,setSelectedTeam]=useState('');
 const [worker,setWorker]=useState('');
 const [jobId,setJobId]=useState('');
 const [jobs,setJobs]=useState<{id:string;number:string;name:string}[]>([]);
 const [teamStats,setTeamStats]=useState<LeadTeamHours|null>(null);
 const [loadedScope,setLoadedScope]=useState('');
 const [loadError,setLoadError]=useState('');
 const scope=account.companyId+':'+account.userId+':'+account.role;
 const scopeRef=useRef(scope);
 scopeRef.current=scope;
 const readRevision=useRef(0);
 const submitInFlight=useRef(false);
 const manager=['admin','boss'].includes(account.role);
 async function load(){
  const requestedScope=scope;
  if(scopeRef.current!==requestedScope)return;
  const revision=++readRevision.current;
  try{
   // A lead only needs their assigned teams and the server-authorized
   // overview. A missing employee list must not block this screen.
   const [t,m,j,overview]=await Promise.all([
    supabase.from('teams').select('id,name,lead_user_id').eq('company_id',account.companyId),
    manager?supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active'):Promise.resolve(null),
    manager?supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId).eq('active',true):Promise.resolve(null),
    account.role==='lead'?supabase.rpc('lead_team_overview',{p_company:account.companyId}):Promise.resolve(null)
   ]);
   if(scopeRef.current!==requestedScope||readRevision.current!==revision)return;
   if(t.error||!Array.isArray(t.data)||manager&&
      (m?.error||!Array.isArray(m?.data)||j?.error||!Array.isArray(j?.data)))
    throw Error('Liste des équipes non confirmée. Réessayez.');
   let stats:LeadTeamHours|null=null;
   if(account.role==='lead'){
    if(overview?.error)throw Error('Heures de l’équipe indisponibles. Réessayez.');
    stats=parseLeadTeamHours(overview?.data);
   }
   setTeams(t.data as Team[]);
   setPeople(manager?(m?.data||[]) as Person[]:[]);
   setJobs(manager?(j?.data||[]) as {id:string;number:string;name:string}[]:[]);
   setTeamStats(stats);
   setLoadError('');
   setLoadedScope(requestedScope);
  }catch(error){
   if(scopeRef.current===requestedScope&&readRevision.current===revision){
    setLoadError(error instanceof Error?error.message:'Chargement des équipes impossible.');
    setLoadedScope('');
   }
  }
 }
 useEffect(()=>{
  ++readRevision.current;
  setLoadedScope('');setLoadError('');
  setTeams([]);setPeople([]);setJobs([]);setTeamStats(null);
  setName('');setLead('');setSelectedTeam('');setWorker('');setJobId('');
  void load();
  return()=>{++readRevision.current};
 },[scope]);
 const text=(s:string,dim=false)=><Text style={{color:dim?colors.muted:colors.text,fontSize:13}}>{s}</Text>;
 const box=(children:React.ReactNode)=><View style={{padding:12,backgroundColor:colors.panel,borderRadius:12,borderWidth:1,borderColor:colors.line,gap:9,marginBottom:9}}>{children}</View>;
 const select=(s:string,active:boolean,onPress:()=>void)=><Pressable key={s} onPress={onPress} style={{padding:11,borderRadius:9,backgroundColor:active?'#5B491C':'#1A3340'}}>{text((active?'● ':'○ ')+s)}</Pressable>;
 const submit=async(fn:()=>PromiseLike<any>)=>{
  if(submitInFlight.current||loadedScope!==scope||scopeRef.current!==scope)return;
  submitInFlight.current=true;
  const requestedScope=scope;
  try{
   const r=await fn();
   if(r.error)throw r.error;
   if(scopeRef.current!==requestedScope)return;
   await load();
   if(scopeRef.current===requestedScope)
    Alert.alert('Enregistré','Modification confirmée par le serveur.');
  }catch(e:any){
   if(scopeRef.current===requestedScope)Alert.alert('Erreur',e?.message||'Enregistrement non confirmé.');
  }finally{submitInFlight.current=false;}
 };
 if(loadedScope!==scope)return <View style={{padding:14,gap:12}}>
  {text(loadError||'Chargement des équipes de ce compte…',true)}
  {loadError?<Pressable accessibilityRole="button" onPress={()=>{void load()}}
   style={{padding:12,borderRadius:9,backgroundColor:colors.panel}}>
   {text('Réessayer le chargement')}
  </Pressable>:null}
 </View>;
 return <ScrollView contentContainerStyle={{paddingBottom:25}}>
  {account.role==='lead'&&teamStats?box(<>
   <Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Heures de mon équipe</Text>
   {text((teamStats.todayMs/3600000).toFixed(2)+' h aujourd’hui · '+teamStats.workers+' employés supervisés')}
   {text((teamStats.weekMs/3600000).toFixed(2)+' h cette semaine · '+teamStats.present+' présents')}
   {text('Heures brutes des chantiers supervisés (calculées par le serveur).',true)}
  </>):null}
  {box(<><Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Mes équipes</Text>{teams.length?teams.map(t=><View key={t.id}>{text(t.name+' · Chef : '+t.lead_user_id.slice(0,8))}</View>):text('Aucune équipe attribuée.',true)}</>)}
  {manager?<>
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Créer une équipe</Text><TextInput value={name} onChangeText={setName} placeholder="Nom de l’équipe" placeholderTextColor={colors.muted} style={{color:colors.text,borderBottomColor:colors.line,borderBottomWidth:1,padding:8}}/>{text('Choisir un chef d’équipe :',true)}{people.filter(p=>p.role==='lead').map(p=>select(p.user_id.slice(0,8),p.user_id===lead,()=>setLead(p.user_id)))}<Pressable onPress={()=>{if(!name.trim()||!lead)return Alert.alert('Nom et chef nécessaires');submit(async()=>{const r=await supabase.rpc('create_team',{p_company:account.companyId,p_name:name.trim(),p_lead:lead});if(!r.error)setName('');return r})}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Créer l’équipe</Text></Pressable></>)}
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Affecter un employé</Text>{text('Équipe :',true)}{teams.map(t=>select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id)))}{text('Employé :',true)}{people.filter(p=>p.role==='employee'||p.role==='lead').map(p=>select(p.user_id.slice(0,8),p.user_id===worker,()=>setWorker(p.user_id)))}<Pressable onPress={()=>{if(!selectedTeam||!worker)return Alert.alert('Choisis une équipe et un employé');submit(()=>supabase.rpc('add_team_employee',{p_team:selectedTeam,p_employee:worker}))}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Ajouter à l’équipe</Text></Pressable></>)}
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Affecter une équipe à une job</Text>{text('Équipe :',true)}{teams.map(t=>select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id)))}{text('Chantier :',true)}{jobs.map(j=>select('#'+j.number+' — '+j.name,j.id===jobId,()=>setJobId(j.id)))}<Pressable onPress={()=>{if(!selectedTeam||!jobId)return Alert.alert('Sélectionne une équipe et une job');submit(()=>supabase.from('team_jobs').insert({company_id:account.companyId,team_id:selectedTeam,job_id:jobId}))}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Affecter la job</Text></Pressable></>)}
  </>:box(text('Le groupe privé de ton équipe est accessible dans l’onglet Messages.',true))}
 </ScrollView>;
}
