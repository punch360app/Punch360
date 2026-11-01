import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import {blankClient,blankSite,clientSaveArgs,siteSaveArgs,siteAddress} from '../../web/live/client-directory.js';
import {canCreateSiteForClient,canEditDirectoryRow,createClientDirectoryScope,directorySearch,safeDirectoryPage} from './clientDirectoryScope.js';

type Row=Record<string,any>;
type Kind='clients'|'sites';
type Token=ReturnType<ReturnType<typeof createClientDirectoryScope>['current']>;
const clientFields:[string,string][]=[['Nom du client','name'],['Référence interne','reference'],['Nom du contact','contact_name'],['Téléphone professionnel','contact_phone']];
const siteFields:[string,string][]=[
 ['Nom du lieu','name'],['Adresse complète','address_line'],['Appartement / unité','unit'],
 ['Ville','city'],['Province / région','region'],['Code postal','postal_code'],
 ['Pays (CA, US...)','country'],['Fuseau IANA','timezone'],['Latitude facultative','latitude'],
 ['Longitude facultative','longitude'],['Contact professionnel','contact_name'],
 ['Téléphone professionnel','contact_phone'],['Instructions d’accès non sensibles','access_instructions'],
 ['Notes internes aux responsables','internal_notes']
];
const unavailable='Impossible de charger le carnet privé. Réessaie ou vérifie les autorisations.';
const denied='Action refusée ou fiche modifiée. Actualise avant de réessayer.';

/** Private manager directory; the four server RPCs enforce Boss/Admin, Essential and version rules. */
export function ClientDirectoryPanel({companyId}:{companyId:string}){
 const [tab,setTab]=useState<Kind>('clients');
 const [clients,setClients]=useState<Row[]>([]),[sites,setSites]=useState<Row[]>([]);
 const [clientMore,setClientMore]=useState(false),[siteMore,setSiteMore]=useState(false);
 const [clientSearch,setClientSearch]=useState(''),[siteSearch,setSiteSearch]=useState('');
 const [editingClient,setEditingClient]=useState<Row|null>(null),[editingSite,setEditingSite]=useState<Row|null>(null);
 const [clientDraft,setClientDraft]=useState<Row|null>(null),[siteDraft,setSiteDraft]=useState<Row|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const scope=useRef(createClientDirectoryScope(companyId));
 const latestCompany=useRef(companyId);latestCompany.current=companyId;
 const alive=useRef(false),request=useRef({clients:0,sites:0}),actionLock=useRef(false);
 const visible=useRef<{clients:Row[];sites:Row[]}>({clients:[],sites:[]});
 const moreRef=useRef({clients:false,sites:false}),applied=useRef({clients:'',sites:''});
 const identityMatches=scope.current.matches(companyId);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latestCompany.current);
 const disabled=!identityMatches||loading||busy||!loaded;
 const title=(value:string)=><Text style={{fontSize:18,color:'#2F4935',fontWeight:'700'}}>{value}</Text>;
 const explain=(value:string)=><Text style={{color:'#527359',fontSize:12,lineHeight:18}}>{value}</Text>;
 const button=(value:string,onPress:()=>void)=><Pressable accessibilityRole="button"
  accessibilityLabel={value} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={{borderRadius:10,backgroundColor:'#4e7051',padding:12,minHeight:48,justifyContent:'center',marginVertical:3,opacity:disabled?0.5:1}}>
  <Text style={{color:'white',fontSize:13,textAlign:'center',fontWeight:'600'}}>{value}</Text>
 </Pressable>;
 const input=(label:string,key:string,draft:Row,setDraft:(next:Row)=>void)=><View key={key} style={{gap:4}}>
  <Text style={{color:'#2F4935',fontSize:12}}>{label}</Text>
  <TextInput accessibilityLabel={label} value={String(draft[key]??'')} editable={!disabled}
   onChangeText={v=>setDraft({...draft,[key]:v})}
   maxLength={key==='access_instructions'||key==='internal_notes'?1200:1000}
   multiline={key==='access_instructions'||key==='internal_notes'}
   style={{borderColor:'#DCE8D6',color:'#2F4935',borderWidth:1,padding:10,borderRadius:8,minHeight:48}}/>
 </View>;
 const status=(draft:Row,update:(f:Row)=>void)=><View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
  {([true,false] as const).map(active=><Pressable key={String(active)} accessibilityRole="radio"
   accessibilityState={{selected:draft.active===active,disabled}} disabled={disabled}
   onPress={()=>update({...draft,active})}
   style={{minHeight:48,padding:12,borderRadius:9,borderWidth:1,borderColor:'#779574',
    backgroundColor:draft.active===active?'#DCE9D6':'white'}}>
   <Text style={{color:'#2F4935'}}>{active?'Actif':'Archivé'}</Text>
  </Pressable>)}
 </View>;
 async function rpc(name:string,args:Row,token:Token):Promise<Row>{
  if(!current(token))throw Error('Compte modifié');
  const result=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte modifié');
  if(result.error)throw Error('Accès refusé');
  return result.data as Row;
 }
 async function page(kind:Kind,rawSearch:string,more=false,token:Token=scope.current.current()){
  if(!current(token))return false;
  const search=directorySearch(rawSearch);
  if(more&&(!moreRef.current[kind]||applied.current[kind]!==search))throw Error('Recherche modifiée');
  const prior=more?visible.current[kind]:[];
  const cursor=more?prior[prior.length-1]?.id||null:null;
  const id=++request.current[kind];
  try{
   const response=await rpc(kind==='clients'?'list_essential_clients':'list_essential_client_sites',
    {p_company:companyId,p_search:search,p_after:cursor,p_limit:50},token);
   if(!current(token)||id!==request.current[kind])return false;
   const next=safeDirectoryPage(response,companyId,prior,more,50);
   visible.current[kind]=next;moreRef.current[kind]=response.has_more;applied.current[kind]=search;
   if(kind==='clients'){setClients(next);setClientMore(response.has_more)}
   else{setSites(next);setSiteMore(response.has_more)}
   return true;
  }catch{
   if(current(token)&&id===request.current[kind]&&!more){
    visible.current[kind]=[];moreRef.current[kind]=false;
    if(kind==='clients'){setClients([]);setClientMore(false)}
    else{setSites([]);setSiteMore(false)}
   }
   throw Error('Recherche privée indisponible');
  }
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  setLoading(true);setLoaded(false);setError('');setNotice('');
  try{
   const [a,b]=await Promise.all([page('clients','',false,token),page('sites','',false,token)]);
   if(!current(token))return false;
   if(!a||!b)throw Error('Répertoire incomplet');
   setLoaded(true);return true;
  }catch{
   if(current(token)){
    visible.current={clients:[],sites:[]};moreRef.current={clients:false,sites:false};
    setClients([]);setSites([]);setClientMore(false);setSiteMore(false);
    setLoaded(false);setError(unavailable);
   }
   return false;
  }finally{if(current(token))setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(companyId);
  alive.current=true;actionLock.current=false;request.current.clients++;request.current.sites++;
  visible.current={clients:[],sites:[]};moreRef.current={clients:false,sites:false};
  applied.current={clients:'',sites:''};
  setTab('clients');setClients([]);setSites([]);setClientMore(false);setSiteMore(false);
  setClientSearch('');setSiteSearch('');setEditingClient(null);setEditingSite(null);
  setClientDraft(null);setSiteDraft(null);
  setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();request.current.clients++;request.current.sites++};
 },[companyId]);
 async function work(fn:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(disabled||!current(token)||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await fn(token)}
  catch{if(current(token))setError(denied)}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 async function saveClient(form:Row,original:Row|null,token:Token){
  if(original&&!canEditDirectoryRow(original,companyId,visible.current.clients))throw Error('Fiche périmée');
  const args=clientSaveArgs(companyId,form,original);
  await rpc('save_essential_client',args,token);
  if(!current(token))return;
  setClientDraft(null);setEditingClient(null);
  await page('clients',applied.current.clients,false,token);
  if(current(token))setNotice('Fiche enregistrée. Aucun établissement ni contrat modifié.');
 }
 async function saveSite(form:Row,original:Row|null,token:Token){
  if(original&&!canEditDirectoryRow(original,companyId,visible.current.sites))throw Error('Adresse périmée');
  if(!canCreateSiteForClient(form.client_id,visible.current.clients)&&
   !(original&&original.client_id===form.client_id))throw Error('Client non chargé');
  const args=siteSaveArgs(companyId,form,original);
  await rpc('save_essential_client_site',args,token);
  if(!current(token))return;
  setSiteDraft(null);setEditingSite(null);
  await page('sites',applied.current.sites,false,token);
  if(current(token))setNotice('Adresse enregistrée sans créer de quart ni pointage.');
 }
 function archive(kind:Kind,entry:Row){
  const token=scope.current.current();
  if(!current(token)||!canEditDirectoryRow(entry,companyId,visible.current[kind])||disabled)return;
  Alert.alert('Archiver sans supprimer ?',
   kind==='clients'?'Les adresses actives doivent être archivées d’abord.':'Les historiques restent conservés.',
   [{text:'Annuler',style:'cancel'},{text:'Archiver',onPress:()=>{
    if(!current(token))return;
    void work(async t=>{
     if(!current(t)||!canEditDirectoryRow(entry,companyId,visible.current[kind]))throw Error('Fiche périmée');
     if(kind==='clients')await saveClient({...entry,active:false},entry,t);
     else await saveSite({...entry,active:false},entry,t);
    });
   }}]);
 }
 const activeClients=clients.filter(c=>c.active);
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement d’entreprise en cours…</Text>
 </View>;
 return <View style={{padding:16,borderColor:'#DCE8D6',borderWidth:1,borderRadius:13,backgroundColor:'white',gap:11}}>
  {title('Clients et lieux d’intervention')}
  {explain('Clients et adresses distincts des établissements, bornes et places payantes. Aucune mission, aucun quart ni suivi GPS créé. Coordonnées et notes réservées aux responsables.')}
  {loading?<Text accessibilityLiveRegion="polite">Chargement des clients et adresses…</Text>:null}
  {busy?<ActivityIndicator color="#779574"/>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:9,backgroundColor:'#F4F7F2'}}>
   <Text style={{color:'#2F4935'}}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {loaded?<View style={{gap:10}}>
   <View style={{flexDirection:'row',gap:8}}>
    {(['clients','sites'] as const).map(t=><Pressable key={t} accessibilityRole="button"
     accessibilityState={{selected:tab===t,disabled}} disabled={disabled}
     onPress={()=>{setTab(t);setClientDraft(null);setSiteDraft(null);setEditingClient(null);setEditingSite(null)}}
     style={{minHeight:48,padding:12,flex:1,borderRadius:10,backgroundColor:tab===t?'#DCE9D6':'#F4F7F2'}}>
     <Text style={{color:'#2F4935',textAlign:'center'}}>{t==='clients'?'Clients':'Adresses'}</Text>
    </Pressable>)}
   </View>
   {tab==='clients'?<View style={{gap:9}}>
    {input('Rechercher client','search',{search:clientSearch},v=>setClientSearch(String(v.search||'')))}
    {button('Rechercher',()=>void work(async token=>{await page('clients',clientSearch,false,token)}))}
    {button('Ajouter un client',()=>{setEditingClient(null);setClientDraft(blankClient())})}
    {clients.map(c=><View key={c.id} style={{paddingVertical:7,borderBottomWidth:1,borderColor:'#F0F2EF',gap:3}}>
     <Text style={{color:'#2F4935',fontWeight:'600'}}>{c.name}{c.active?'':' · Archivé'}</Text>
     {explain(c.reference||'Référence non renseignée')}
     <View style={{flexDirection:'row',gap:9,flexWrap:'wrap'}}>
      {button('Modifier',()=>{if(canEditDirectoryRow(c,companyId,visible.current.clients)){
       setEditingClient(c);setClientDraft({...c});
      }})}
      {c.active?button('Adresse pour ce client',()=>{if(!canCreateSiteForClient(c.id,visible.current.clients))return;
       setTab('sites');setEditingSite(null);setSiteDraft({...blankSite(),client_id:c.id});
      }):null}
      {c.active?button('Archiver',()=>archive('clients',c)):null}
     </View>
    </View>)}
    {clientMore?button('Voir plus de clients',()=>void work(async token=>{
     await page('clients',clientSearch,true,token);
    })):null}
    {clientDraft?<View style={{gap:8,padding:12,backgroundColor:'#F4F7F2',borderRadius:10}}>
     {title(editingClient?'Modifier le client':'Nouveau client')}
     {clientFields.map(([label,key])=>input(label,key,clientDraft,setClientDraft))}
     {status(clientDraft,setClientDraft)}
     {button('Enregistrer le client',()=>void work(t=>saveClient(clientDraft,editingClient,t)))}
     {button('Annuler',()=>{setClientDraft(null);setEditingClient(null)})}
    </View>:null}
   </View>:<View style={{gap:9}}>
    {input('Rechercher adresse, ville ou client','search',{search:siteSearch},v=>setSiteSearch(String(v.search||'')))}
    {button('Rechercher les adresses',()=>void work(async token=>{await page('sites',siteSearch,false,token)}))}
    {button('Nouvelle adresse',()=>{setEditingSite(null);setSiteDraft({...blankSite(),client_id:activeClients[0]?.id||''})})}
    {sites.map(site=><View key={site.id} style={{paddingVertical:8,borderBottomWidth:1,borderColor:'#F0F2EF',gap:3}}>
     <Text style={{color:'#2F4935',fontWeight:'600'}}>{site.name}{site.active?'':' · Archivée'}</Text>
     {explain(String(site.client_name||'Client')+' · '+siteAddress(site))}
     <View style={{flexDirection:'row',gap:9,flexWrap:'wrap'}}>
      {button('Modifier',()=>{if(canEditDirectoryRow(site,companyId,visible.current.sites)){
       setEditingSite(site);setSiteDraft({...site});
      }})}
      {site.active?button('Archiver',()=>archive('sites',site)):null}
     </View>
    </View>)}
    {siteMore?button('Voir plus d’adresses',()=>void work(async token=>{
     await page('sites',siteSearch,true,token);
    })):null}
    {siteDraft?<View style={{gap:8,padding:12,backgroundColor:'#F4F7F2',borderRadius:10}}>
     {title(editingSite?'Modifier l’adresse':'Nouvelle adresse')}
     {explain('Choisis un client actif chargé dans le carnet. Si absent, recherche-le dans l’onglet Clients.')}
     {activeClients.length===0?explain('Aucun client actif affiché : recherche ou crée un client.'):null}
     {activeClients.slice(0,25).map(c=><Pressable accessibilityRole="radio" key={c.id}
      accessibilityState={{selected:siteDraft.client_id===c.id,disabled}} disabled={disabled}
      onPress={()=>setSiteDraft({...siteDraft,client_id:c.id})}
      style={{padding:12,minHeight:48,borderRadius:8,backgroundColor:siteDraft.client_id===c.id?'#DCE9D6':'white',borderWidth:1,borderColor:'#DCE8D6'}}>
      <Text style={{color:'#2F4935'}}>{c.name}</Text>
     </Pressable>)}
     {siteFields.map(([label,key])=>input(label,key,siteDraft,setSiteDraft))}
     {status(siteDraft,setSiteDraft)}
     {button('Enregistrer l’adresse',()=>void work(t=>saveSite(siteDraft,editingSite,t)))}
     {button('Annuler',()=>{setSiteDraft(null);setEditingSite(null)})}
    </View>:null}
   </View>}
  </View>:null}
 </View>;
}
