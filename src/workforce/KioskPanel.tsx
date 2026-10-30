import {KioskOfflineReviewPanel} from './KioskOfflineReviewPanel';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Share,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canAlterKiosk,canAlterKioskWorker,canEnrollKioskPin,createKioskConsoleScope,
 kioskIdleOptions,mayManageKiosks,validKioskDevices,validKioskLocations,
 validKioskSecret,validKioskWorkers,validPairingInput} from './kioskConsoleScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createKioskConsoleScope>['current']>;
const kioskUrl='https://punch360app.github.io/Punch360/kiosk.html';
const denied='Action refusée ou compte modifié. Actualise les bornes avant de réessayer.';
const unavailable='Impossible de charger les bornes et les accès autorisés. Réessaie.';
const ink='#2F4935',line='#E1E8DB',green='#4D7051';
const safeDate=(value:unknown)=>{
 const t=Date.parse(String(value||''));
 return Number.isFinite(t)?new Date(t).toLocaleString('fr-CA'):'Date non disponible';
};

export function KioskPanel({account}:{account:WorkspaceAccount}){
 const [devices,setDevices]=useState<Row[]>([]);
 const [locations,setLocations]=useState<Row[]>([]),[workers,setWorkers]=useState<Row[]>([]);
 const [location,setLocation]=useState(''),[name,setName]=useState('');
 const [code,setCode]=useState(''),[enrollment,setEnrollment]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createKioskConsoleScope(account));
 const latest=useRef(account);latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const identityMatches=scope.current.matches(account);
 const manager=mayManageKiosks(account);
 const disabled=!identityMatches||!manager||busy||loading||!loaded;
 const panel=(children:React.ReactNode)=><View style={{padding:15,backgroundColor:'white',
  borderRadius:12,borderColor:line,borderWidth:1,gap:8,marginBottom:10}}>{children}</View>;
 const text=(value:string)=><Text style={{color:ink,lineHeight:21}}>{value}</Text>;
 const button=(title:string,callback:()=>void,blocked=false)=><Pressable
  accessibilityRole="button" accessibilityLabel={title}
  accessibilityState={{disabled:disabled||blocked}} disabled={disabled||blocked}
  onPress={callback} style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:green,
   opacity:disabled||blocked?0.5:1,borderRadius:9,marginVertical:3}}>
  <Text style={{color:'white',fontWeight:'600',textAlign:'center'}}>{title}</Text>
 </Pressable>;
 const choose=(title:string,chosen:boolean,callback:()=>void,blocked=false)=><Pressable
  accessibilityRole="radio" accessibilityLabel={title}
  accessibilityState={{selected:chosen,disabled:disabled||blocked}}
  disabled={disabled||blocked} onPress={callback}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,
   borderColor:line,borderWidth:1,backgroundColor:chosen?'#DCE9D6':'white'}}>
  {text((chosen?'● ':'○ ')+title)}
 </Pressable>;

 async function rpc(fn:string,args:Row,token:Token):Promise<any>{
  if(!current(token))throw Error('Compte modifié');
  const r=await supabase.rpc(fn,args);
  if(!current(token))throw Error('Compte modifié');
  if(r.error)throw Error('Accès refusé');
  return r.data;
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token)||!manager)return false;
  const id=++loadId.current;
  setLoading(true);setLoaded(false);setError('');setNotice('');
  try{
   const [d,l,w]=await Promise.all([
    rpc('list_kiosk_devices',{p_company:account.companyId},token),
    supabase.from('essential_locations').select('id,company_id,name,active')
     .eq('company_id',account.companyId).eq('active',true).limit(251),
    supabase.from('company_workers')
     .select('id,company_id,role,employee_number,first_name,last_name,can_mobile_punch,can_kiosk_punch,personal_access,status')
     .eq('company_id',account.companyId).limit(501)
   ]);
   if(!current(token)||id!==loadId.current)return false;
   if(l.error||w.error)throw Error('Référentiels refusés');
   const dd=validKioskDevices(d),ll=validKioskLocations(l.data,account.companyId);
   const ww=validKioskWorkers(w.data,account.companyId);
   if(!current(token))return false;
   setDevices(dd);setLocations(ll);setWorkers(ww);
   setLocation(previous=>ll.some(x=>x.id===previous)?previous:ll[0]?.id||'');
   setLoaded(true);return true;
  }catch{
   if(current(token)&&id===loadId.current){
    setDevices([]);setLocations([]);setWorkers([]);setLocation('');
    setLoaded(false);setError(unavailable);
   }
   return false;
  }finally{if(current(token)&&id===loadId.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setDevices([]);setLocations([]);setWorkers([]);setLocation('');
  setName('');setCode('');setEnrollment('');
  setBusy(false);setError('');setNotice('');setLoading(true);setLoaded(false);
  if(manager)void load(token);
  else{setLoading(false);setError('Gestion des bornes réservée aux responsables de l’édition Essentiel.')}
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);

 useEffect(()=>{
  if(!code)return;
  const timeout=setTimeout(()=>setCode(''),10*60*1000);
  return()=>clearTimeout(timeout);
 },[code]);
 useEffect(()=>{
  if(!enrollment)return;
  const timeout=setTimeout(()=>setEnrollment(''),15*60*1000);
  return()=>clearTimeout(timeout);
 },[enrollment]);

 async function run(callback:(token:Token)=>Promise<void>,refresh=false){
  const token=scope.current.current();
  if(!current(token)||disabled||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await callback(token);
   if(!current(token))return;
   if(refresh)await load(token);
  }catch{
   if(current(token))setError(denied);
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function pair(){
  let values:{location:string;name:string};
  try{values=validPairingInput(location,name,locations as any)}
  catch{setError('Choisis un établissement actif et un nom de borne (2 à 100 caractères).');return}
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const result=await rpc('create_essential_kiosk_pairing',{
    p_company:account.companyId,p_location:values.location,p_name:values.name
   },token);
   if(!current(token))return;
   const secret=validKioskSecret(result?.pairing_code);
   setCode(secret);setEnrollment('');
  },true);
 }
 function setIdle(device:Row,value:number){
  if(!kioskIdleOptions.includes(value)||!canAlterKiosk(device,devices as any,account))return;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   await rpc('set_kiosk_idle',{p_device:device.id,p_seconds:value},token);
  },true);
 }
 function revoke(device:Row){
  if(disabled||!canAlterKiosk(device,devices as any,account))return;
  const token=scope.current.current();
  Alert.alert('Révoquer la borne','Cette tablette ne pourra plus pointer.',
   [{text:'Annuler',style:'cancel'},{
    text:'Révoquer',style:'destructive',onPress:()=>{
     if(!current(token)||!canAlterKiosk(device,devices as any,account))return;
     void run(async activeToken=>{
      if(!current(activeToken))throw Error('Compte modifié');
      await rpc('revoke_kiosk',{p_device:device.id,p_reason:'Révocation depuis la console mobile'},activeToken);
     },true);
    }
   }]);
 }
 function updateWorker(worker:Row,mode:'mobile'|'kiosk'|'mixed'){
  if(!canAlterKioskWorker(worker,workers as any,account))return;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   await rpc('set_essential_worker_channels',{
    p_worker:worker.id,p_mobile:mode!=='kiosk',p_kiosk:mode!=='mobile',
    p_personal:worker.personal_access,p_reason:'Méthodes de pointage choisies par le Boss'
   },token);
  },true);
 }
 function enroll(worker:Row){
  if(!canEnrollKioskPin(worker,workers as any,account))return;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const secret=validKioskSecret(await rpc('create_pin_enrollment',{p_worker:worker.id},token));
   if(!current(token))return;
   setCode('');setEnrollment(secret);
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 if(!manager)return <View style={{padding:16}}>
  <Text accessibilityRole="alert">Gestion des bornes réservée aux responsables autorisés.</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:20,gap:12,backgroundColor:'#FAFBF8'}}>
  <Text style={{fontSize:24,color:ink,fontWeight:'700'}}>Bornes de pointage</Text>
  {text('L’employé présente son QR; la tablette le scanne avec sa caméra. Aucun lecteur externe requis.')}
  {error?<Text accessibilityRole="alert" style={{color:'#A44232'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {loading?<Text accessibilityLiveRegion="polite">Chargement des bornes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Vérification en cours…</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{const token=scope.current.current();if(!actionLock.current&&current(token)){setCode('');setEnrollment('');void load(token)}}}
   style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:'#DCE9D6',borderRadius:9}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<>
   {button('Ouvrir la pointeuse',()=>void run(async token=>{
    if(!current(token))throw Error('Compte modifié');await Linking.openURL(kioskUrl);
   }))}
   {button('Partager le lien public',()=>void run(async token=>{
    if(!current(token))throw Error('Compte modifié');
    await Share.share({message:kioskUrl});
   }))}
   {text('Le lien public ne contient aucun code d’appairage ni autorisation.')}
   {panel(<>
    <Text style={{fontSize:18,fontWeight:'700',color:ink}}>Nouvelle borne</Text>
    <TextInput accessibilityLabel="Nom de borne" placeholder="Réception" placeholderTextColor="#647D67"
     maxLength={100} editable={!disabled} value={name} onChangeText={setName}
     style={{minHeight:48,borderWidth:1,borderColor:line,color:ink,padding:12,borderRadius:8}}/>
    {locations.map(l=><View key={l.id}>
     {choose(l.name,l.id===location,()=>setLocation(l.id))}
    </View>)}
    {!locations.length?text('Aucun établissement autorisé.'):null}
    {button('Générer un code temporaire',pair)}
   </>)}
   {code?panel(<>
    <Text style={{fontWeight:'700',color:ink}}>Code temporaire d’appairage</Text>
    <Text selectable style={{color:ink}}>{code}</Text>
    {text('À saisir sur la tablette · valide 10 minutes. Ne partage pas ce code avec d’autres personnes.')}
    {button('Masquer le code',()=>setCode(''))}
   </>):null}
   {panel(<>
    <Text style={{fontSize:18,fontWeight:'700',color:ink}}>Tablettes inscrites</Text>
    {devices.map(d=><View key={d.id} style={{paddingVertical:12,borderBottomWidth:1,borderColor:line,gap:6}}>
     <Text style={{fontWeight:'700',color:ink}}>{d.name}</Text>
     {text(d.revoked_at?'Révoquée':!d.paired_at?'À appairer':
      d.last_seen_at&&Date.now()-Date.parse(d.last_seen_at)<300000?'Contact récent':'Sans connexion récente')}
     {text('Dernier contact : '+safeDate(d.last_seen_at))}
     {!d.revoked_at?<>
      {text('Délai de confidentialité : '+String(d.idle_seconds||10)+' secondes')}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
       {kioskIdleOptions.map(seconds=><View key={seconds}>
        {button(seconds+' s',()=>setIdle(d,seconds))}
       </View>)}
      </View>
      {button('Révoquer '+d.name,()=>revoke(d))}
     </>:null}
    </View>)}
    {!devices.length?text('Aucune tablette inscrite.'):null}
   </>)}
   {panel(<>
    <Text style={{fontSize:18,fontWeight:'700',color:ink}}>Accès des salariés</Text>
    {workers.filter(w=>w.status==='active').map(w=><View key={w.id}
     style={{paddingVertical:12,borderBottomWidth:1,borderColor:line,gap:6}}>
     <Text style={{color:ink,fontWeight:'600'}}>{w.first_name} {w.last_name} · {w.employee_number}</Text>
     {text((w.can_mobile_punch?'Téléphone autorisé':'Téléphone en consultation')+
      ' · '+(w.can_kiosk_punch?'Borne autorisée':'Borne interdite'))}
     {account.role==='boss'?<View style={{gap:5}}>
      {(['mobile','kiosk','mixed'] as const).map(mode=><View key={mode}>
       {button(({mobile:'Téléphone',kiosk:'Tablette',mixed:'Mixte'})[mode],()=>updateWorker(w,mode))}
      </View>)}
     </View>:null}
     {w.can_kiosk_punch?button('Code d’enrôlement NIP',()=>enroll(w)):null}
    </View>)}
    {!workers.some(w=>w.status==='active')?text('Aucun salarié actif dans le répertoire.'):null}
   </>)}
   {enrollment?panel(<>
    <Text style={{fontWeight:'700',color:ink}}>Code privé d’enrôlement NIP</Text>
    <Text selectable style={{color:ink}}>{enrollment}</Text>
    {text('À remettre en personne au salarié. Il choisit lui-même son NIP sur la tablette · 15 minutes.')}
    {button('Masquer',()=>setEnrollment(''))}
   </>):null}
   <KioskOfflineReviewPanel key={[account.companyId,account.userId,account.role,account.edition].join(':')}
    account={account}/>
  </>:null}
 </ScrollView>;
}
