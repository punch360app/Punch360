import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';

// The manager must review an explicit lot and confirm again before hours can change.
// Only the server can authorize and apply a provisional punch.
type Decision={id:string;approve:boolean;note:string};
export function KioskOfflineReviewPanel({account}:{account:WorkspaceAccount}){
 const [rows,setRows]=useState<any[]>([]),[note,setNote]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<Decision|null>(null);
 const alive=useRef(false),generation=useRef(0),inFlight=useRef(false);
 const safeError='Décision non enregistrée. Réessayez ou contactez le support.';
 async function load(expected=generation.current){
  const result=await supabase.rpc('list_kiosk_offline',{p_company:account.companyId});
  if(result.error||!Array.isArray(result.data))throw Error('load-denied');
  if(alive.current&&expected===generation.current){
   setRows(result.data);
   setPending(prev=>prev&&!result.data.some((x:any)=>x.id===prev.id&&!x.closed_at)?null:prev);
  }
 }
 useEffect(()=>{
  alive.current=true;const n=++generation.current;
  setRows([]);setNote('');setPending(null);setError('');setBusy(false);inFlight.current=false;
  load(n).catch(()=>{if(alive.current&&n===generation.current)
   setError('Impossible de charger les observations. Réessayez.')});
  return()=>{alive.current=false;generation.current++};
 },[account.companyId]);
 async function run(fn:()=>Promise<void>){
  if(inFlight.current)return;
  inFlight.current=true;const n=generation.current;
  setBusy(true);setError('');
  try{
   await fn();
   if(alive.current&&n===generation.current)await load(n);
  }catch{
   if(alive.current&&n===generation.current)setError(safeError);
  }finally{
   if(alive.current&&n===generation.current){inFlight.current=false;setBusy(false)}
  }
 }
 const button=(label:string,fn:()=>Promise<void>)=><Pressable accessibilityRole="button"
  disabled={busy} onPress={()=>run(fn)} style={{padding:12,minHeight:48,backgroundColor:'#edf2e9',borderRadius:8}}>
  <Text style={{color:'#2F4935'}}>{label}</Text></Pressable>;
 const choose=(id:string,approve:boolean)=>{
  if(busy)return;
  if(note.trim().length<3){setError('Motif de décision requis (3 caractères minimum).');return}
  const row=rows.find(x=>x.id===id&&!x.closed_at);
  if(!row){setError(safeError);setPending(null);return}
  setPending({id,approve,note:note.trim()});setError('');
 };
 const commit=async()=>{
  const selected=pending;
  if(!selected||note.trim()!==selected.note)throw Error('confirmation-invalid');
  const n=generation.current;
  const latest=await supabase.rpc('list_kiosk_offline',{p_company:account.companyId});
  if(latest.error||!Array.isArray(latest.data))throw Error('recheck-failed');
  if(n!==generation.current)return;
  if(!latest.data.some((x:any)=>x.id===selected.id&&!x.closed_at))
   throw Error('closed-lot');
  const r=await supabase.rpc('review_kiosk_offline',{
   p_grant:selected.id,p_approve:selected.approve,p_note:selected.note
  });
  if(r.error)throw Error('decision-denied');
  if(n===generation.current){setPending(null);setNote('')}
 };
 return <View style={{gap:12}}>
  <Text style={{fontSize:22,color:'#2F4935'}}>Réconciliation hors ligne</Text>
  <Text>Observations provisoires : vérifiez les heures et pauses avant confirmation. Les journées encore ouvertes, les semaines fermées et les changements d’un autre appareil empêchent la confirmation.</Text>
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  <TextInput accessibilityLabel="Motif de décision hors ligne" placeholder="Motif de décision"
   value={note} onChangeText={setNote} editable={!busy&&!pending} maxLength={1000}
   style={{padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,color:'#2F4935'}}/>
  {button('Actualiser',async()=>{})}
  {rows.map(g=><View key={g.id} style={{gap:8,padding:14,backgroundColor:'white',borderRadius:10}}>
   <Text style={{fontWeight:'600',color:'#2F4935'}}>{g.worker} · {g.device}</Text>
   {g.events.map((ev:any)=><Text key={ev.id}>{new Date(ev.at).toLocaleString('fr-CA')} ·
    {({in:'Entrée',out:'Sortie',break_start:'Pause non payée',break_start_paid:'Pause payée',break_end:'Fin de pause'} as Record<string,string>)[ev.action]} ·
    {({pending:'En attente',approved:'Confirmé',rejected:'Refusé',conflict:'Conflit'} as Record<string,string>)[ev.state]}
    {ev.note?' · '+ev.note:''}</Text>)}
   {!g.closed_at?(pending?.id===g.id?
    <View style={{gap:8,padding:12,backgroundColor:'#eef3e8',borderRadius:8}}>
     <Text accessibilityLiveRegion="polite" style={{color:'#2F4935',fontWeight:'600'}}>
      {pending.approve?'Confirmer les observations':'Refuser et conserver l’historique'} — {g.worker} · {g.device}
     </Text>
     {button('Enregistrer cette décision',commit)}
     <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setPending(null)}
      style={{padding:12,minHeight:48,justifyContent:'center'}}>
      <Text style={{color:'#2F4935'}}>Annuler</Text>
     </Pressable>
    </View>:
    <View style={{gap:8}}>
     <Pressable accessibilityRole="button" disabled={busy} onPress={()=>choose(g.id,true)}
      style={{padding:12,minHeight:48,backgroundColor:'#edf2e9',borderRadius:8}}>
      <Text style={{color:'#2F4935'}}>Confirmer les observations</Text>
     </Pressable>
     <Pressable accessibilityRole="button" disabled={busy} onPress={()=>choose(g.id,false)}
      style={{padding:12,minHeight:48,backgroundColor:'#edf2e9',borderRadius:8}}>
      <Text style={{color:'#2F4935'}}>Refuser et conserver l’historique</Text>
     </Pressable>
    </View>):null}
  </View>)}
  <Text>100 lots récents. Une borne encore déconnectée peut conserver d’autres observations sur son appareil.</Text>
 </View>;
}
