import React,{useEffect,useRef,useState} from 'react';
import {AppState,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import catalog from '../../web/live/themes.json';
import {createPersonalThemeScope,themeGridColumns,themeGridItemWidth} from './themeScope.js';

export type PersonalTheme=typeof catalog[number];
export const personalThemes=catalog;
const fallback=catalog.find(t=>t.id==='sage')!;
const isTheme=(id:unknown):id is string=>typeof id==='string'&&catalog.some(t=>t.id===id);
const failure='Impossible de synchroniser le thème personnel. Réessaie quand la connexion fonctionne.';

/** The appearance preference is per signed-in user, never per company or kiosk. */
export function usePersonalTheme(user:string){
 const [saved,setSaved]=useState('sage'),[preview,setPreview]=useState<string|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false),[hasPreference,setHasPreference]=useState(false);
 const scope=useRef(createPersonalThemeScope(user));
 const writeLock=useRef(false);
 const identityMatches=scope.current.matches(user);

 useEffect(()=>{
  const token=scope.current.enter(user);
  writeLock.current=false;
  setSaved('sage');setPreview(null);setError('');setBusy(false);
  setReady(false);setHasPreference(false);
  async function load(){
   const ticket=scope.current.startRead(token);
   if(!ticket)return;
   try{
    const cached=await AsyncStorage.getItem('punch-theme:'+user);
    if(!scope.current.allowsRead(ticket))return;
    if(isTheme(cached))setSaved(cached);
    const r=await supabase.from('essential_appearance').select('theme_id')
     .eq('user_id',user).maybeSingle();
    if(!scope.current.allowsRead(ticket))return;
    if(r.error)throw Error('Lecture de préférence refusée');
    const id=r.data?.theme_id;
    if(isTheme(id)){
     setSaved(id);setHasPreference(true);
     if(scope.current.allowsRead(ticket))await AsyncStorage.setItem('punch-theme:'+user,id);
    }else{
     // A legitimate empty server preference must not be confused with cached selection.
     setHasPreference(false);
    }
    if(scope.current.allowsRead(ticket)){setReady(true);setError('')}
   }catch{
    if(scope.current.allowsRead(ticket)){
     // An offline cache may still be displayed, but we never report server sync success.
     setReady(true);setError(failure);
    }
   }
  }
  void load();
  const subscription=AppState.addEventListener('change',state=>{
   if(state==='active'&&scope.current.allows(token))void load();
  });
  return()=>{
   scope.current.invalidate();
   writeLock.current=false;
   subscription.remove();
  };
 },[user]);

 async function save(){
  const token=scope.current.current();
  if(!scope.current.matches(user)||!scope.current.allows(token)||writeLock.current)return;
  const id=preview||saved;
  if(!isTheme(id))return;
  if(!scope.current.beginWrite(token))return;
  writeLock.current=true;setBusy(true);setError('');
  try{
   if(!scope.current.allows(token))return;
   const r=await supabase.from('essential_appearance')
    .upsert({user_id:user,theme_id:id},{onConflict:'user_id'});
   if(!scope.current.allows(token))return;
   if(r.error)throw Error('Préférence refusée');
   setSaved(id);setHasPreference(true);setPreview(null);setReady(true);
   // Cache follows confirmed server success only, never an unconfirmed preview.
   await AsyncStorage.setItem('punch-theme:'+user,id);
  }catch{
   if(scope.current.allows(token))setError(failure);
  }finally{
   if(scope.current.endWrite(token)){writeLock.current=false;setBusy(false)}
  }
 }
 const usable=identityMatches&&!busy;
 const selected=identityMatches?(preview||saved):'sage';
 return {
  needsChoice:identityMatches&&ready&&!hasPreference,
  theme:catalog.find(t=>t.id===selected)||fallback,
  preview:(id:string)=>{if(usable&&isTheme(id))setPreview(id)},
  cancel:()=>{if(usable)setPreview(null)},
  save,error:identityMatches?error:'',
  busy:!identityMatches||busy,
  ready:identityMatches&&ready
 };
}

export function ThemeDecoration({theme:t}:{theme:PersonalTheme}){
 const diagonal=['diagonal','fold'].includes(t.motif);
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
  style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden'}}>
  <View style={{position:'absolute',width:350,height:diagonal?500:350,
   borderRadius:diagonal?20:t.motif==='stone'?110:180,backgroundColor:t.decoration,
   opacity:t.dark?.22:.55,right:-220,top:40,
   transform:[{rotate:diagonal?'36deg':t.motif==='petal'?'45deg':'0deg'}]}}/>
  <View style={{position:'absolute',width:300,height:diagonal?450:300,
   borderRadius:diagonal?20:150,backgroundColor:t.decoration,opacity:.3,
   left:-230,bottom:20,transform:[{rotate:diagonal?'36deg':'0deg'}]}}/>
 </View>;
}

export function AppearancePanel({appearance:a,onPreviewActual}:{
 appearance:ReturnType<typeof usePersonalTheme>;onPreviewActual?:()=>void
}){
 const t=a.theme;
 const {width}=useWindowDimensions();
 const columns=themeGridColumns(width);
 const itemWidth=themeGridItemWidth(columns);
 const inactive=a.busy||!a.ready;
 const button=(label:string,onPress:()=>void,disabled=false)=><Pressable
  accessibilityRole="button" accessibilityLabel={label}
  accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:12,
   opacity:disabled?0.5:1,backgroundColor:t.surface,borderWidth:1,borderColor:t.line}}>
  <Text style={{color:t.text,textAlign:'center',fontWeight:'600'}}>{label}</Text>
 </Pressable>;
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{gap:14,padding:16,paddingBottom:32}}>
  <Text style={{fontSize:24,color:t.text,fontWeight:'700'}}>Choisis ton style PUNCH</Text>
  <Text style={{color:t.muted}}>10 designs · références 11 à 20 · Préférence personnelle</Text>
  {a.error?<Text accessibilityRole="alert" style={{color:t.text}}>{a.error}</Text>:null}
  {!a.ready?<Text accessibilityLiveRegion="polite" style={{color:t.muted}}>
   Chargement de la préférence personnelle…
  </Text>:null}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'}}>
   {catalog.map(c=><Pressable key={c.id} accessibilityRole="radio" accessibilityLabel={c.name}
    accessibilityState={{selected:t.id===c.id,disabled:inactive}}
    disabled={inactive} onPress={()=>a.preview(c.id)}
    style={{width:itemWidth,minHeight:240,borderWidth:t.id===c.id?3:1,
     borderColor:t.id===c.id?t.accent:t.line,borderRadius:14,overflow:'hidden',
     backgroundColor:c.bg,opacity:inactive?.6:1}}>
    <View style={{height:160,padding:12,alignItems:'center',gap:8,justifyContent:'center'}}>
     <ThemeDecoration theme={c}/>
     <Text style={{color:c.text,fontWeight:'700'}}>PUNCH 360°</Text>
     <Text style={{color:c.text,fontSize:12}}>Bonjour!</Text>
     <View style={{borderRadius:40,width:60,height:60,backgroundColor:c.accent,
      justifyContent:'center',alignItems:'center'}}>
      <Text style={{color:c.buttonText,fontSize:23}}>◷</Text>
     </View>
     <Text style={{color:c.text,fontSize:12}}>00:00:00</Text>
    </View>
    <View style={{padding:10,backgroundColor:c.surface,minHeight:74}}>
     <Text style={{color:c.text,fontSize:12,fontWeight:'700'}}>{c.number} · {c.name}</Text>
     <Text style={{color:c.muted,fontSize:11}}>{c.description}</Text>
    </View>
   </Pressable>)}
  </View>
  <View style={{padding:20,borderRadius:18,backgroundColor:t.surface,
   alignItems:'center',gap:12,borderWidth:1,borderColor:t.line}}>
   <Text style={{color:t.text,fontSize:19,fontWeight:'700'}}>PUNCH 360°</Text>
   <Text style={{color:t.text}}>Aperçu · {t.name}</Text>
   <View style={{borderRadius:65,width:130,height:130,backgroundColor:t.accent,
    alignItems:'center',justifyContent:'center'}}>
    <Text style={{color:t.buttonText,fontSize:20,fontWeight:'700'}}>PUNCH IN</Text>
   </View>
   <Text style={{color:t.text}}>00:00:00</Text>
   <Text style={{color:t.muted}}>Punch · Heures · Horaire · Plus</Text>
  </View>
  {onPreviewActual?button('Voir mon écran Punch',onPreviewActual,inactive):null}
  <Pressable accessibilityRole="button" accessibilityLabel="Utiliser ce design"
   accessibilityState={{disabled:inactive}} disabled={inactive}
   onPress={a.save} style={{minHeight:48,padding:16,borderRadius:12,
    justifyContent:'center',backgroundColor:t.accent,opacity:inactive?.5:1}}>
   <Text style={{color:t.buttonText,textAlign:'center',fontWeight:'700'}}>
    {a.busy?'Enregistrement…':'Utiliser ce design'}
   </Text>
  </Pressable>
  {button('Revenir au design enregistré',a.cancel,inactive)}
  <Text style={{color:t.muted,fontSize:12}}>
   Le thème personnel ne change pas les bornes ni les consoles de gestion.
  </Text>
 </ScrollView>;
}
