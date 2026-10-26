import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {blankClient,blankSite,clientSaveArgs,siteSaveArgs,siteAddress} from '../../web/live/client-directory.js';

type Row=Record<string,any>;
const clientFields:[string,string][]=[['Nom du client','name'],['Référence interne','reference'],['Nom du contact','contact_name'],['Téléphone professionnel','contact_phone']];
const siteFields:[string,string][]=[
 ['Nom du lieu','name'],['Adresse complète','address_line'],['Appartement / unité','unit'],
 ['Ville','city'],['Province / région','region'],['Code postal','postal_code'],['Pays (CA, US...)','country'],
 ['Fuseau IANA','timezone'],['Latitude facultative','latitude'],['Longitude facultative','longitude'],
 ['Contact professionnel','contact_name'],['Téléphone professionnel','contact_phone'],
 ['Instructions d’accès non sensibles','access_instructions'],['Notes internes aux responsables','internal_notes']
];

/** Private Boss/Admin directory; NO company-branch, punch, scheduling or payroll mutation. */
export function ClientDirectoryPanel({companyId}:{companyId:string}){
 const [tab,setTab]=useState<'clients'|'sites'>('clients');
 const [clients,setClients]=useState<Row[]>([]),[sites,setSites]=useState<Row[]>([]);
 const [clientMore,setClientMore]=useState(false),[siteMore,setSiteMore]=useState(false);
 const [clientSearch,setClientSearch]=useState(''),[siteSearch,setSiteSearch]=useState('');
 const [editingClient,setEditingClient]=useState<Row|null>(null),[editingSite,setEditingSite]=useState<Row|null>(null);
 const [clientDraft,setClientDraft]=useState<Row|null>(null),[siteDraft,setSiteDraft]=useState<Row|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const live=useRef(0),latestCompany=useRef(companyId);latestCompany.current=companyId;
 async function query(name:string,args:Row){
  const result=await supabase.rpc(name,args);
  if(result.error)throw result.error;
  return result.data as Row;
 }
 async function page(kind:'clients'|'sites',search:string,more=false,revision=live.current){
  const list=kind==='clients'?clients:sites;
  const cursor=more?list[list.length-1]?.id||null:null;
  const response=await query(kind==='clients'?'list_essential_clients':'list_essential_client_sites',
   {p_company:companyId,p_search:search,p_after:cursor,p_limit:50});
  if(revision!==live.current||companyId!==latestCompany.current)return;
  if(kind==='clients'){setClients(c=>more?[...c,...(response.items||[])]:response.items||[]);setClientMore(!!response.has_more);}
  else{setSites(c=>more?[...c,...(response.items||[])]:response.items||[]);setSiteMore(!!response.has_more);}
 }
 useEffect(()=>{
  const revision=++live.current;
  setClients([]);setSites([]);setClientSearch('');setSiteSearch('');
  setEditingClient(null);setEditingSite(null);setClientDraft(null);setSiteDraft(null);
  setNotice('');
  Promise.all([page('clients','',false,revision),page('sites','',false,revision)])
    .catch(e=>{if(revision===live.current)setNotice(e.message)});
  return ()=>{live.current++};
 },[companyId]);
 async function work(fn:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setNotice('');
  try{await fn()}catch(e:any){setNotice(e.message||'Erreur réseau')}finally{setBusy(false)}
 }
 const title=(text:string)=><Text style={{fontSize:18,color:'#2F4935',fontWeight:'700'}}>{text}</Text>;
 const explain=(text:string)=><Text style={{color:'#527359',fontSize:12,lineHeight:18}}>{text}</Text>;
 const btn=(label:string,onPress:()=>void)=>(
  <Pressable accessibilityRole="button" disabled={busy} onPress={onPress}
   style={{borderRadius:10,backgroundColor:'#4e7051',padding:11,minHeight:44,justifyContent:'center',marginVertical:3}}>
   <Text style={{color:'white',fontSize:13,textAlign:'center',fontWeight:'600'}}>{label}</Text>
  </Pressable>
 );
 const input=(label:string,key:string,draft:Row,setDraft:(next:Row)=>void)=>(
  <View key={key} style={{gap:4}}>
   <Text style={{color:'#2F4935',fontSize:12}}>{label}</Text>
   <TextInput accessibilityLabel={label} value={String(draft[key]??'')}
    onChangeText={v=>setDraft({...draft,[key]:v})}
    multiline={key==='access_instructions'||key==='internal_notes'}
    style={{borderColor:'#DCE8D6',color:'#2F4935',borderWidth:1,padding:10,borderRadius:8,minHeight:42}}/>
  </View>
 );
 const status=(draft:Row,update:(f:Row)=>void)=>(
  <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
   {([true,false] as const).map(active=><Pressable key={String(active)} onPress={()=>update({...draft,active})}
    style={{padding:10,borderRadius:9,borderWidth:1,borderColor:'#779574',backgroundColor:draft.active===active?'#DCE9D6':'white'}}>
    <Text style={{color:'#2F4935'}}>{active?'Actif':'Archivé'}</Text></Pressable>)}
  </View>
 );
 const refresh=(kind:'clients'|'sites')=>page(kind,kind==='clients'?clientSearch:siteSearch);
 async function saveClient(form:Row,original:Row|null){
  await query('save_essential_client',clientSaveArgs(companyId,form,original));
  setClientDraft(null);setEditingClient(null);
  await refresh('clients');setNotice('Client enregistré sans changer les établissements ni le contrat.');
 }
 async function saveSite(form:Row,original:Row|null){
  await query('save_essential_client_site',siteSaveArgs(companyId,form,original));
  setSiteDraft(null);setEditingSite(null);
  await refresh('sites');setNotice('Adresse enregistrée, aucun quart ni pointage créé.');
 }
 function archive(kind:'clients'|'sites',entry:Row){
  Alert.alert('Archiver sans supprimer ?',
   kind==='clients'?'Les adresses actives de ce client doivent d’abord être archivées.':'Les historiques restent conservés.',
   [{text:'Annuler',style:'cancel'}, {text:'Archiver',onPress:()=>work(async()=>{
     if(kind==='clients')await saveClient({...entry,active:false},entry);
     else await saveSite({...entry,active:false},entry);
   })}]);
 }
 const activeClients=clients.filter(c=>c.active);
 return <View style={{padding:16,borderColor:'#DCE8D6',borderWidth:1,borderRadius:13,backgroundColor:'white',gap:11}}>
  {title('Clients et lieux d’intervention')}
  {explain('Clients et adresses illimités, distincts des établissements, bornes et places payantes. Aucun quart ni suivi GPS créés. Les coordonnées et notes sont réservées aux responsables.')}
  <View style={{flexDirection:'row',gap:8}}>
   {(['clients','sites'] as const).map(t=><Pressable key={t} accessibilityRole="button"
     onPress={()=>{setTab(t);setClientDraft(null);setSiteDraft(null)}} style={{
      padding:10,flex:1,borderRadius:10,backgroundColor:tab===t?'#DCE9D6':'#F4F7F2'}}>
     <Text style={{color:'#2F4935',textAlign:'center'}}>{t==='clients'?'Clients':'Adresses'}</Text>
    </Pressable>)}
  </View>
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#86412A'}}>{notice}</Text>:null}
  {busy?<ActivityIndicator color="#779574"/>:null}
  {tab==='clients'?<View style={{gap:9}}>
   {input('Rechercher client', 'search', {search:clientSearch},d=>setClientSearch(String(d.search||'')))}
   {btn('Rechercher',()=>work(()=>page('clients',clientSearch)))}
   {btn('Ajouter un client',()=>{setEditingClient(null);setClientDraft(blankClient())})}
   {clients.map(c=><View key={c.id} style={{paddingVertical:7,borderBottomWidth:1,borderColor:'#F0F2EF',gap:3}}>
     <Text style={{color:'#2F4935',fontWeight:'600'}}>{c.name}{c.active?'':' · Archivé'}</Text>
     {explain(c.reference||'Référence non renseignée')}
     <View style={{flexDirection:'row',gap:9,flexWrap:'wrap'}}>
      {btn('Modifier',()=>{setEditingClient(c);setClientDraft({...c})})}
      {c.active?btn('Adresse pour ce client',()=>{setTab('sites');setEditingSite(null);setSiteDraft({...blankSite(),client_id:c.id})}):null}
      {c.active?btn('Archiver',()=>archive('clients',c)):null}
     </View>
   </View>)}
   {clientMore?btn('Voir plus de clients',()=>work(()=>page('clients',clientSearch,true))):null}
   {clientDraft?<View style={{gap:8,padding:12,backgroundColor:'#F4F7F2',borderRadius:10}}>
     {title(editingClient?'Modifier le client':'Nouveau client')}
     {clientFields.map(([label,key])=>input(label,key,clientDraft,setClientDraft))}
     {status(clientDraft,setClientDraft)}
     {btn('Enregistrer le client',()=>work(()=>saveClient(clientDraft,editingClient)))}
     {btn('Annuler',()=>{setClientDraft(null);setEditingClient(null)})}
    </View>:null}
  </View>:<View style={{gap:9}}>
   {input('Rechercher adresse, ville ou client','search',{search:siteSearch},d=>setSiteSearch(String(d.search||'')))}
   {btn('Rechercher les adresses',()=>work(()=>page('sites',siteSearch)))}
   {btn('Nouvelle adresse',()=>{setEditingSite(null);setSiteDraft({...blankSite(),client_id:activeClients[0]?.id||''})})}
   {sites.map(site=><View key={site.id} style={{paddingVertical:8,borderBottomWidth:1,borderColor:'#F0F2EF',gap:3}}>
     <Text style={{color:'#2F4935',fontWeight:'600'}}>{site.name}{site.active?'':' · Archivée'}</Text>
     {explain(site.client_name+' · '+siteAddress(site))}
     <View style={{flexDirection:'row',gap:9}}>{btn('Modifier',()=>{setEditingSite(site);setSiteDraft({...site})})}
      {site.active?btn('Archiver',()=>archive('sites',site)):null}</View>
    </View>)}
   {siteMore?btn('Voir plus d’adresses',()=>work(()=>page('sites',siteSearch,true))):null}
   {siteDraft?<View style={{gap:8,padding:12,backgroundColor:'#F4F7F2',borderRadius:10}}>
     {title(editingSite?'Modifier l’adresse':'Nouvelle adresse')}
     {explain('Choisissez un client dans le résultat affiché. Recherchez-le dans l’onglet Clients si nécessaire.')}
     {activeClients.length===0?explain('Aucun client actif sur cette page : recherchez ou créez un client.'):null}
     {activeClients.slice(0,25).map(c=><Pressable key={c.id} onPress={()=>setSiteDraft({...siteDraft,client_id:c.id})}
       style={{padding:8,borderRadius:8,backgroundColor:siteDraft.client_id===c.id?'#DCE9D6':'white',borderWidth:1,borderColor:'#DCE8D6'}}>
       <Text style={{color:'#2F4935'}}>{c.name}</Text></Pressable>)}
     {siteFields.map(([label,key])=>input(label,key,siteDraft,setSiteDraft))}
     {status(siteDraft,setSiteDraft)}
     {btn('Enregistrer l’adresse',()=>work(()=>saveSite(siteDraft,editingSite)))}
     {btn('Annuler',()=>{setSiteDraft(null);setEditingSite(null)})}
    </View>:null}
  </View>}
 </View>;
}
