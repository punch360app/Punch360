import React,{useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
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
 async function load(){
  const [t,m,j]=await Promise.all([
   supabase.from('teams').select('id,name,lead_user_id').eq('company_id',account.companyId),
   supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active'),
   supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId).eq('active',true)
  ]);
  if(t.error)Alert.alert('Équipes',t.error.message);
  else setTeams(t.data||[]);
  if(!m.error)setPeople(m.data||[]);
  if(!j.error)setJobs(j.data||[]);
  if(account.role==='lead'){
   const {data:segments}=await supabase.from('punch_segments').select('started_at,ended_at').eq('company_id',account.companyId);
   const now=Date.now();const day=new Date();const dayStart=new Date(day.getFullYear(),day.getMonth(),day.getDate()).getTime();
   const parts=segments||[];
   setVisibleCount(parts.length);
   setTeamHours(parts.reduce((sum,seg)=>{
    const a=Math.max(dayStart,Date.parse(seg.started_at));const b=Math.min(now,seg.ended_at?Date.parse(seg.ended_at):now);
    return sum+Math.max(0,b-a);
   },0));
  }
 }
 useEffect(()=>{load()},[account.companyId]);
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
