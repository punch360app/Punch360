import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {buildTeamWorkerJobPairs,createTeamsScope,summarizeTeamHours} from './teamsScope.js';
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
 const [teamHours,setTeamHours]=useState<number>(0);
 const [visibleCount,setVisibleCount]=useState<number>(0);
 const manager=['admin','boss'].includes(account.role);
 const scope=useRef(createTeamsScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),requestVersion=useRef(0),actionLock=useRef(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:ReturnType<typeof scope.current.current>)=>alive.current&&scope.current.allows(token);
 async function load(token:ReturnType<typeof scope.current.current>=scope.current.current()){
  if(!current(token))return;
  const version=++requestVersion.current;setLoading(true);
  try{
   const t=await supabase.from('teams').select('id,name,lead_user_id')
    .eq('company_id',account.companyId).limit(900);
   if(!current(token)||version!==requestVersion.current)return;
   if(t.error||!Array.isArray(t.data)||t.data.length>=900)throw Error('teams');
   const visible=account.role==='lead'?t.data.filter(x=>x.lead_user_id===account.userId):t.data;
   let newPeople:Person[]=[],newJobs:{id:string;number:string;name:string}[]=[];
   if(manager){
    const [members,jobs]=await Promise.all([
     supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active').limit(900),
     supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId).eq('active',true).limit(900)
    ]);
    if(!current(token)||version!==requestVersion.current)return;
    if(members.error||jobs.error||!Array.isArray(members.data)||!Array.isArray(jobs.data)||
       members.data.length>=900||jobs.data.length>=900)throw Error('company');
    newPeople=members.data;newJobs=jobs.data;
   }
   let hours=0,count=0;
   if(account.role==='lead'&&visible.length){
    const teamIds=visible.map(x=>x.id);
    const [members,assignments]=await Promise.all([
     supabase.from('team_members').select('team_id,user_id').eq('company_id',account.companyId).in('team_id',teamIds).limit(900),
     supabase.from('team_jobs').select('team_id,job_id').eq('company_id',account.companyId).in('team_id',teamIds).limit(900)
    ]);
    if(!current(token)||version!==requestVersion.current)return;
    if(members.error||assignments.error||!Array.isArray(members.data)||!Array.isArray(assignments.data)||
       members.data.length>=900||assignments.data.length>=900)throw Error('assignments');
    const pairs=buildTeamWorkerJobPairs(visible,members.data,assignments.data);
    const jobIds=[...new Set(assignments.data.map(x=>x.job_id))];
    if(pairs.size&&jobIds.length){
     const now=Date.now(),today=new Date(now);
     const dayStart=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime();
     const segments:{id:string;session_id:string;job_id:string;started_at:string;ended_at:string|null}[]=[];
     // Include shifts starting yesterday and ending today; paginate and fail closed on a cap.
     for(let offset=0;offset<5000;offset+=500){
      const r=await supabase.from('punch_segments').select('id,session_id,job_id,started_at,ended_at')
       .eq('company_id',account.companyId).in('job_id',jobIds)
       .lte('started_at',new Date(now).toISOString())
       .or('ended_at.gte.'+new Date(dayStart).toISOString()+',ended_at.is.null')
       .order('id').range(offset,offset+499);
      if(!current(token)||version!==requestVersion.current)return;
      if(r.error||!Array.isArray(r.data))throw Error('segments');
      segments.push(...r.data);
      if(r.data.length<500)break;
      if(offset===4500)throw Error('cap');
     }
     const sessions:{id:string;user_id:string}[]=[];
     const ids=[...new Set(segments.map(x=>x.session_id))];
     for(let offset=0;offset<ids.length;offset+=100){
      const r=await supabase.from('punch_sessions').select('id,user_id')
       .eq('company_id',account.companyId).in('id',ids.slice(offset,offset+100));
      if(!current(token)||version!==requestVersion.current)return;
      if(r.error||!Array.isArray(r.data))throw Error('sessions');
      sessions.push(...r.data);
     }
     const summary=summarizeTeamHours(segments,sessions,pairs,dayStart,now);
     hours=summary.milliseconds;count=summary.count;
    }
   }
   if(!current(token)||version!==requestVersion.current)return;
   setTeams(visible);setPeople(newPeople);setJobs(newJobs);
   setTeamHours(hours);setVisibleCount(count);setError('');
  }catch{
   if(current(token)&&version===requestVersion.current){
    setTeams([]);setPeople([]);setJobs([]);setTeamHours(0);setVisibleCount(0);
    setError('Impossible de vérifier les équipes et les heures. Réessaie.');
   }
  }finally{if(current(token)&&version===requestVersion.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;requestVersion.current++;actionLock.current=false;
  setTeams([]);setPeople([]);setJobs([]);setTeamHours(0);setVisibleCount(0);
  setName('');setLead('');setSelectedTeam('');setWorker('');setJobId('');
  setBusy(false);setError('');setLoading(true);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();requestVersion.current++};
 },[account.companyId,account.userId,account.role]);
 const text=(s:string,dim=false)=><Text style={{color:dim?colors.muted:colors.text,fontSize:13}}>{s}</Text>;
 const box=(children:React.ReactNode)=><View style={{padding:12,backgroundColor:colors.panel,borderRadius:12,borderWidth:1,borderColor:colors.line,gap:9,marginBottom:9}}>{children}</View>;
 const select=(s:string,active:boolean,onPress:()=>void)=><Pressable key={s} onPress={onPress} style={{padding:11,borderRadius:9,backgroundColor:active?'#5B491C':'#1A3340'}}>{text((active?'● ':'○ ')+s)}</Pressable>;
 const submit=async(fn:()=>PromiseLike<any>)=>{try{const r=await fn();if(r.error)throw r.error;await load();Alert.alert('Enregistré')}catch(e:any){Alert.alert('Erreur',e.message)}};
 return <ScrollView contentContainerStyle={{paddingBottom:25}}>
  {account.role==='lead'?box(<><Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Heures de mes gars aujourd’hui</Text>{text((teamHours/3600000).toFixed(2)+' h · '+visibleCount+' segments visibles')}</>):null}
  {box(<><Text style={{color:colors.gold,fontSize:16,fontWeight:'800'}}>Mes équipes</Text>{teams.length?teams.map(t=><View key={t.id}>{text(t.name+' · Chef : '+t.lead_user_id.slice(0,8))}</View>):text('Aucune équipe attribuée.',true)}</>)}
  {manager?<>
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Créer une équipe</Text><TextInput value={name} onChangeText={setName} placeholder="Nom de l’équipe" placeholderTextColor={colors.muted} style={{color:colors.text,borderBottomColor:colors.line,borderBottomWidth:1,padding:8}}/>{text('Choisir un chef d’équipe :',true)}{people.filter(p=>p.role==='lead').map(p=>select(p.user_id.slice(0,8),p.user_id===lead,()=>setLead(p.user_id)))}<Pressable onPress={()=>{if(!name.trim()||!lead)return Alert.alert('Nom et chef nécessaires');submit(async()=>{const r=await supabase.rpc('create_team',{p_company:account.companyId,p_name:name.trim(),p_lead:lead});if(!r.error)setName('');return r})}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Créer l’équipe</Text></Pressable></>)}
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Affecter un employé</Text>{text('Équipe :',true)}{teams.map(t=>select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id)))}{text('Employé :',true)}{people.filter(p=>p.role==='employee'||p.role==='lead').map(p=>select(p.user_id.slice(0,8),p.user_id===worker,()=>setWorker(p.user_id)))}<Pressable onPress={()=>{if(!selectedTeam||!worker)return Alert.alert('Choisis une équipe et un employé');submit(()=>supabase.rpc('add_team_employee',{p_team:selectedTeam,p_employee:worker}))}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Ajouter à l’équipe</Text></Pressable></>)}
   {box(<><Text style={{color:colors.gold,fontWeight:'800'}}>Affecter une équipe à une job</Text>{text('Équipe :',true)}{teams.map(t=>select(t.name,t.id===selectedTeam,()=>setSelectedTeam(t.id)))}{text('Chantier :',true)}{jobs.map(j=>select('#'+j.number+' — '+j.name,j.id===jobId,()=>setJobId(j.id)))}<Pressable onPress={()=>{if(!selectedTeam||!jobId)return Alert.alert('Sélectionne une équipe et une job');submit(()=>supabase.from('team_jobs').insert({company_id:account.companyId,team_id:selectedTeam,job_id:jobId}))}} style={{backgroundColor:colors.gold,padding:12,borderRadius:10}}><Text style={{color:'#08131C',textAlign:'center',fontWeight:'800'}}>Affecter la job</Text></Pressable></>)}
  </>:box(text('Le groupe privé de ton équipe est accessible dans l’onglet Messages.',true))}
 </ScrollView>;
}
