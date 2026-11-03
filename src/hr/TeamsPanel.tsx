import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {boundedTeamRows,canManageTeams,canSeeTeamHours,createTeamsScope,localTeamDay,teamCreationAllowed,teamJobAllowed,teamMemberAllowed,visibleLeadHours} from './teamsScope.js';

type Team={id:string;company_id:string;name:string;lead_user_id:string};
type Person={user_id:string;role:string;status:string};
type Job={id:string;company_id:string;number:string;name:string};
type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createTeamsScope>['current']>;
const colors={panel:'#122632',line:'#36505A',text:'#FFFFFF',muted:'#9BB0BD',gold:'#FFBF40'};
const problem='Impossible de charger ces équipes ou heures autorisées. Réessaie.';
const denied='Action refusée ou données modifiées. Actualise avant de réessayer.';
const max=250;

export function TeamsPanel({account}:{account:WorkspaceAccount}){
 const [teams,setTeams]=useState<Team[]>([]),[people,setPeople]=useState<Person[]>([]),[jobs,setJobs]=useState<Job[]>([]);
 const [name,setName]=useState(''),[lead,setLead]=useState(''),[selectedTeam,setSelectedTeam]=useState('');
 const [worker,setWorker]=useState(''),[jobId,setJobId]=useState('');
 const [teamHours,setTeamHours]=useState(0),[visibleCount,setVisibleCount]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createTeamsScope(account)),latest=useRef(account);latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account);
 const manager=canManageTeams(account),leadRole=canSeeTeamHours(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||busy||loading||!loaded;
 const text=(s:string,dim=false)=><Text style={{color:dim?colors.muted:colors.text,fontSize:13,lineHeight:20}}>{s}</Text>;
 const box=(children:React.ReactNode)=><View style={{padding:12,backgroundColor:colors.panel,borderRadius:12,
  borderWidth:1,borderColor:colors.line,gap:10,marginBottom:10}}>{children}</View>;
 const button=(label:string,fn:()=>void,blocked=false)=><Pressable accessibilityRole="button"
  accessibilityLabel={label} accessibilityState={{disabled:disabled||blocked}} disabled={disabled||blocked} onPress={fn}
  style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:10,
   opacity:disabled||blocked?0.5:1,backgroundColor:colors.gold}}>
  <Text style={{color:'#08131C',fontWeight:'800',textAlign:'center'}}>{label}</Text>
 </Pressable>;
 const select=(caption:string,selected:boolean,fn:()=>void)=><Pressable key={caption}
  accessibilityRole="radio" accessibilityLabel={caption}
  accessibilityState={{selected,disabled}} disabled={disabled} onPress={fn}
  style={{padding:12,minHeight:48,justifyContent:'center',borderRadius:9,backgroundColor:selected?'#5B491C':'#1A3340'}}>
  {text((selected?'● ':'○ ')+caption)}</Pressable>;
 function requireRows(result:Row,limit=max):Row[]{
  if(result?.error)throw Error('Requête interdite');
  return boundedTeamRows(result?.data,limit);
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const id=++loadId.current;
  setLoading(true);setLoaded(false);setError('');setNotice('');
  setTeams([]);setPeople([]);setJobs([]);setTeamHours(0);setVisibleCount(0);
  try{
   let teamQuery=supabase.from('teams').select('id,company_id,name,lead_user_id')
    .eq('company_id',account.companyId);
   if(leadRole)teamQuery=teamQuery.eq('lead_user_id',account.userId);
   const [t,m,j]=await Promise.all([
    teamQuery.order('name').limit(max+1),
    manager?supabase.from('company_members').select('user_id,role,status')
     .eq('company_id',account.companyId).eq('status','active').limit(max+1)
     :Promise.resolve({data:[],error:null}),
    manager?supabase.from('jobs').select('id,company_id,number,name')
     .eq('company_id',account.companyId).eq('active',true).limit(max+1)
     :Promise.resolve({data:[],error:null})
   ]);
   if(!current(token)||id!==loadId.current)return false;
   const loadedTeams=requireRows(t),loadedPeople=requireRows(m),loadedJobs=requireRows(j);
   if(loadedTeams.some(x=>x.company_id!==account.companyId)||
    loadedJobs.some(x=>x.company_id!==account.companyId))throw Error('Entreprise différente');
   let hours=0,count=0;
   if(leadRole&&loadedTeams.length){
    const teamIds=loadedTeams.map(x=>x.id);
    const [members,assignments]=await Promise.all([
     supabase.from('team_members').select('company_id,team_id,user_id')
      .eq('company_id',account.companyId).in('team_id',teamIds).limit(max+1),
     supabase.from('team_jobs').select('company_id,team_id,job_id')
      .eq('company_id',account.companyId).in('team_id',teamIds).limit(max+1)
    ]);
    if(!current(token)||id!==loadId.current)return false;
    const allMembers=requireRows(members),allJobs=requireRows(assignments);
    if([...allMembers,...allJobs].some(x=>x.company_id!==account.companyId||!teamIds.includes(x.team_id)))
     throw Error('Équipe non autorisée');
    const memberIds=[...new Set(allMembers.map(x=>x.user_id).filter(Boolean))];
    const jobIds=[...new Set(allJobs.map(x=>x.job_id).filter(Boolean))];
    if(memberIds.length&&jobIds.length){
     const window=localTeamDay();
     const result=await supabase.from('punch_segments')
      .select('id,job_id,started_at,ended_at,punch_sessions!inner(user_id)')
      .eq('company_id',account.companyId)
      .in('job_id',jobIds)
      .in('punch_sessions.user_id',memberIds)
      .lt('started_at',window.end)
      .or('ended_at.is.null,ended_at.gte.'+window.start)
      .order('started_at',{ascending:true}).limit(501);
     if(!current(token)||id!==loadId.current)return false;
     const filtered=requireRows(result,500);
     const summary=visibleLeadHours(filtered,memberIds,jobIds,window.start,window.end);
     hours=summary.milliseconds;count=summary.count;
    }
   }
   if(!current(token)||id!==loadId.current)return false;
   setTeams(loadedTeams as Team[]);setPeople(loadedPeople as Person[]);setJobs(loadedJobs as Job[]);
   setTeamHours(hours);setVisibleCount(count);
   setSelectedTeam(prev=>loadedTeams.some(x=>x.id===prev)?prev:'');
   setLead(prev=>loadedPeople.some(x=>x.user_id===prev&&x.role==='lead')?prev:'');
   setWorker(prev=>loadedPeople.some(x=>x.user_id===prev)?prev:'');
   setJobId(prev=>loadedJobs.some(x=>x.id===prev)?prev:'');
   setLoaded(true);return true;
  }catch{
   if(current(token)&&id===loadId.current){
    setTeams([]);setPeople([]);setJobs([]);setTeamHours(0);setVisibleCount(0);
    setLoaded(false);setError(problem);
   }
   return false;
  }finally{if(current(token)&&id===loadId.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setTeams([]);setPeople([]);setJobs([]);setName('');setLead('');setSelectedTeam('');setWorker('');setJobId('');
  setTeamHours(0);setVisibleCount(0);setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);
 async function submit(fn:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!current(token)||disabled||!manager||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   if(!current(token))throw Error('Compte modifié');
   await fn(token);
   if(!current(token))return;
   const success=await load(token);
   if(current(token)&&success)setNotice('Équipes mises à jour.');
  }catch{if(current(token))setError(denied)}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function createTeam(){
  if(!teamCreationAllowed(account,lead,people,name)){setError('Choisis un nom et un chef actif.');return}
  const fixedName=name.trim(),fixedLead=lead;
  void submit(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.rpc('create_team',{p_company:account.companyId,p_name:fixedName,p_lead:fixedLead});
   if(!current(token))return;
   if(r.error)throw Error('Requête refusée');
   setName('');
  });
 }
 function addMember(){
  if(!teamMemberAllowed(account,selectedTeam,worker,teams,people)){setError('Choisis une équipe et un employé actif.');return}
  const fixedTeam=selectedTeam,fixedWorker=worker;
  void submit(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.rpc('add_team_employee',{p_team:fixedTeam,p_employee:fixedWorker});
   if(!current(token))return;
   if(r.error)throw Error('Requête refusée');
  });
 }
 function assignJob(){
  if(!teamJobAllowed(account,selectedTeam,jobId,teams,jobs)){setError('Choisis une équipe et un chantier valide.');return}
  const fixedTeam=selectedTeam,fixedJob=jobId;
  void submit(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.from('team_jobs').insert({
    company_id:account.companyId,team_id:fixedTeam,job_id:fixedJob
   });
   if(!current(token))return;
   if(r.error)throw Error('Requête refusée');
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:14,paddingBottom:28}}>
  {loading?<Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>Chargement des équipes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#CE746B'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:colors.muted}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,backgroundColor:'#1A3340'}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<>
   {leadRole?box(<>
    <Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Heures de mon équipe aujourd’hui</Text>
    {text((teamHours/3600000).toFixed(2)+' h · '+visibleCount+' segments autorisés')}
    {text('Estimation des segments de mes membres sur les chantiers attribués, limitée à aujourd’hui.',true)}
   </>):null}
   {box(<>
    <Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Mes équipes</Text>
    {teams.length?teams.map(t=><View key={t.id}>{text(t.name+' · Chef : '+t.lead_user_id.slice(0,8))}</View>)
     :text('Aucune équipe accessible.',true)}
   </>)}
   {manager?<>
    {box(<>
     <Text style={{color:colors.gold,fontWeight:'800'}}>Créer une équipe</Text>
     <TextInput accessibilityLabel="Nom de l’équipe" value={name} editable={!disabled} onChangeText={setName}
      maxLength={140} placeholder="Nom de l’équipe" placeholderTextColor={colors.muted}
      style={{color:colors.text,minHeight:48,borderBottomColor:colors.line,borderBottomWidth:1,padding:12}}/>
     {text('Chef d’équipe actif :',true)}
     {people.filter(p=>p.role==='lead').map(p=><View key={p.user_id}>{select(p.user_id.slice(0,8),p.user_id===lead,()=>setLead(p.user_id))}</View>)}
     {button('Créer l’équipe',createTeam,!teamCreationAllowed(account,lead,people,name))}
    </>)}
    {box(<>
     <Text style={{color:colors.gold,fontWeight:'800'}}>Affecter un employé</Text>
     {text('Équipe :',true)}
     {teams.map(t=><View key={t.id}>{select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id))}</View>)}
     {text('Employé actif :',true)}
     {people.filter(p=>p.role==='employee'||p.role==='lead').map(p=>
      <View key={p.user_id}>{select(p.user_id.slice(0,8),p.user_id===worker,()=>setWorker(p.user_id))}</View>)}
     {button('Ajouter à l’équipe',addMember,!teamMemberAllowed(account,selectedTeam,worker,teams,people))}
    </>)}
    {box(<>
     <Text style={{color:colors.gold,fontWeight:'800'}}>Affecter une équipe à un chantier</Text>
     {text('Équipe :',true)}
     {teams.map(t=><View key={t.id}>{select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id))}</View>)}
     {text('Chantier actif :',true)}
     {jobs.map(j=><View key={j.id}>{select('#'+j.number+' — '+j.name,j.id===jobId,()=>setJobId(j.id))}</View>)}
     {button('Affecter le chantier',assignJob,!teamJobAllowed(account,selectedTeam,jobId,teams,jobs))}
    </>)}
   </>:box(text('Le groupe privé de ton équipe reste accessible dans Messages.',true))}
  </>:null}
 </ScrollView>;
}
