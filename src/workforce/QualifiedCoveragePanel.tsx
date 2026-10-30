import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {createQualifiedCoverageController,summarizeCoverageDemand,candidateStatusLabel} from '../../web/live/qualified-coverage.js';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canInvokeQualifiedAction,createQualifiedCoverageScope,mayLoadQualifiedCoverage,qualifiedDateLabel,qualifiedResourceRows} from './qualifiedCoverageScope.js';

type Token=ReturnType<ReturnType<typeof createQualifiedCoverageScope>['current']>;
export function QualifiedCoveragePanel({account}:{account:WorkspaceAccount}){
 const [,redraw]=useState(0),holder=useRef<any>(null);
 if(!holder.current)holder.current=createQualifiedCoverageController({sb:supabase,redraw:()=>redraw(v=>v+1),escape:(v:any)=>String(v??'')});
 const ui=holder.current,s=ui.state;
 const scope=useRef(createQualifiedCoverageScope(account)),latest=useRef(account);
 latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const identityMatches=scope.current.matches(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||loading||busy||!loaded||!s.allowed;
 useEffect(()=>{
  const token=scope.current.enter(account),generation=++loadId.current;
  alive.current=true;actionLock.current=false;
  ui.reset();setLoading(true);setLoaded(false);setBusy(false);setError('');
  if(mayLoadQualifiedCoverage(account)){
   void (async()=>{
    const [departments,locations]=await Promise.all([
     supabase.from('essential_departments').select('id,company_id,name,active,location_id')
      .eq('company_id',account.companyId).limit(251),
     supabase.from('essential_locations').select('id,company_id,name,timezone')
      .eq('company_id',account.companyId).limit(251)
    ]);
    if(!current(token)||generation!==loadId.current)return;
    if(departments.error||locations.error)throw Error('Référentiel non disponible');
    const d=qualifiedResourceRows(departments.data,account.companyId);
    const l=qualifiedResourceRows(locations.data,account.companyId);
    if(!current(token))return;
    await ui.load({company_id:account.companyId,role:account.role},d,l);
    if(!current(token)||generation!==loadId.current)return;
    if(s.error)throw Error('Accès ou chargement refusé');
    setLoaded(true);redraw(v=>v+1);
   })().catch(()=>{
    if(current(token)&&generation===loadId.current){
     ui.reset();setError('Couverture indisponible ou accès refusé. Réessaie.');redraw(v=>v+1);
    }
   }).finally(()=>{if(current(token)&&generation===loadId.current)setLoading(false)});
  }else{setLoading(false);setError('Accès réservé aux gestionnaires du forfait Essentiel.')}
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++;ui.reset()};
 },[account.companyId,account.userId,account.role,account.edition]);

 function retry(){
  const token=scope.current.current();
  if(!current(token)||loading||busy||!mayLoadQualifiedCoverage(account))return;
  // Increment the account epoch so in-flight results from the previous load cannot repaint this view.
  const generation=++loadId.current;
  ui.reset();setLoaded(false);setLoading(true);setError('');
  void (async()=>{
   const [a,b]=await Promise.all([
    supabase.from('essential_departments').select('id,company_id,name,active,location_id')
     .eq('company_id',account.companyId).limit(251),
    supabase.from('essential_locations').select('id,company_id,name,timezone')
     .eq('company_id',account.companyId).limit(251)
   ]);
   if(!current(token)||generation!==loadId.current)return;
   if(a.error||b.error)throw Error('Référentiel indisponible');
   const d=qualifiedResourceRows(a.data,account.companyId),l=qualifiedResourceRows(b.data,account.companyId);
   await ui.load({company_id:account.companyId,role:account.role},d,l);
   if(!current(token)||generation!==loadId.current)return;
   if(s.error)throw Error('Accès refusé');
   setLoaded(true);redraw(v=>v+1);
  })().catch(()=>{if(current(token)&&generation===loadId.current){
   ui.reset();setError('Chargement indisponible. Réessaie.');redraw(v=>v+1);
  }}).finally(()=>{if(current(token)&&generation===loadId.current)setLoading(false)});
 }
 const input=(key:string,value:string)=>{if(disabled||!s.editAllowed)return;ui.input({id:'qualified-'+key,value});redraw(v=>v+1)};
 const field=(label:string,key:string)=><View><Text>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled&&s.editAllowed} value={String(s[key]??'')} maxLength={1000} onChangeText={v=>input(key,v)} style={{padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/></View>;
 const button=(label:string,action:string,id='',blocked=false)=>{
  const inactive=disabled||blocked||!canInvokeQualifiedAction(account,s.allowed,loading,busy,action,s.editAllowed);
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
   accessibilityState={{disabled:inactive}} disabled={inactive}
   onPress={()=>{
    const token=scope.current.current();
    if(!current(token)||actionLock.current||
     !canInvokeQualifiedAction(account,s.allowed,loading,busy,action,s.editAllowed))return;
    actionLock.current=true;setBusy(true);setError('');
    void Promise.resolve().then(()=>{
     if(!current(token))return false;
     return ui.handle({dataset:{action:'qualified:'+action,id}});
    }).catch(()=>{
     if(current(token)){setError('Action refusée ou indisponible. Actualise le rapport.');redraw(v=>v+1)}
    }).finally(()=>{
     if(current(token)){actionLock.current=false;setBusy(false);redraw(v=>v+1)}
    });
   }}
   style={{minHeight:48,padding:13,justifyContent:'center',backgroundColor:'#E1E8DB',borderRadius:9,opacity:inactive?0.5:1}}>
   <Text style={{color:'#2F4935'}}>{label}</Text>
  </Pressable>;
 };
 const zone=(department:string)=>s.locations.find((l:any)=>l.id===s.departments.find((d:any)=>d.id===department)?.location_id)?.timezone||'America/Toronto';
 const date=(value:string,tz:string)=>qualifiedDateLabel(value,tz);
 const summary=summarizeCoverageDemand(s.report,s.planningReport);
 if(!identityMatches)return <View style={{padding:18}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView contentContainerStyle={{gap:13,padding:18,backgroundColor:'#FAFBF8'}}>
 <Text style={{fontSize:24,color:'#2F4935'}}>Couverture par qualification</Text>
 {loading?<ActivityIndicator accessibilityLabel="Chargement des qualifications"/>:null}
 {error?<Text accessibilityRole="alert">{error}</Text>:null}
 {!loading&&!busy&&mayLoadQualifiedCoverage(account)?<Pressable accessibilityRole="button"
  onPress={retry} accessibilityLabel="Réessayer le chargement" style={{padding:12,minHeight:48}}>
  <Text>{loaded?'Actualiser':'Réessayer'}</Text>
 </Pressable>:null}
 {!loaded?<Text>Gestionnaire et forfait Essentiel avec module requis.</Text>:!s.allowed?<Text>Module de couverture indisponible.</Text>:<>
<Text>Minimum de personnes avec certificat émis et valide pendant une plage précise. Le titre doit correspondre au dossier RH, casse et espaces aux extrémités ignorés. Un salarié peut satisfaire plusieurs qualifications; aucun poste exclusif n’est déduit.</Text>{s.editAllowed?<>{button('Nouvelle plage','new')}<Text>{s.editing?'Modifier la plage · v'+s.editing.version:'Nouvelle plage'}</Text><Text>Département</Text>{s.departments.filter((d:any)=>d.active).map((d:any)=><Pressable accessibilityRole="radio" accessibilityState={{selected:d.id===s.department}} disabled={disabled||!s.editAllowed} key={d.id} onPress={()=>input('department',d.id)} style={{padding:12,minHeight:48,justifyContent:'center'}}><Text>{d.id===s.department?'● ':'○ '}{d.name} · {zone(d.id)}</Text></Pressable>)}{field('Titre de la plage','title')}{field('Titre du certificat requis','certificate')}{field('Début local AAAA-MM-JJTHH:MM','start')}{field('Fin locale AAAA-MM-JJTHH:MM','end')}<Text>Heures locales du département choisi.</Text>{field('Minimum de personnes qualifiées','minimum')}{field('Motif','reason')}<Pressable accessibilityRole="checkbox" accessibilityState={{checked:s.active}} disabled={disabled||!s.editAllowed} onPress={()=>{if(disabled||!s.editAllowed)return;ui.input({id:'qualified-active',checked:!s.active});redraw(v=>v+1)}} style={{padding:12,minHeight:48,justifyContent:'center'}}><Text>{s.active?'✓ ':'○ '}Plage active</Text></Pressable>{button('Enregistrer la plage','save')}</>:<Text>Permission Certifications requise pour configurer les plages.</Text>}<Text style={{fontSize:19}}>Plages configurées</Text>{s.rules.map((r:any)=><View key={r.id} style={{gap:10,padding:13,borderWidth:1,borderColor:'#E1E8DB',borderRadius:10}}><Text>{r.title}{r.active?'':' · désactivée'}</Text><Text>{r.certificate_title} · minimum {r.minimum_staff}</Text><Text>{date(r.starts_at,zone(r.department_id))} → {date(r.ends_at,zone(r.department_id))} · {zone(r.department_id)}</Text>{s.editAllowed?<>{button('Modifier','edit',r.id)}{button('Copier la plage','copy',r.id)}</>:null}{button('Vérifier cette période','report',r.id,!r.active)}</View>)}{s.report?<View style={{gap:10}}><Text style={{fontWeight:'700',fontSize:18}}>Besoins et couverture consolidés</Text>
<Text>La couverture par qualification et celle du département sont distinctes. Les heures manquantes sont calculées par qualification; elles ne constituent ni un nombre de personnes uniques ni des heures de paie.</Text>
{summary?<View style={{gap:6}}>
 <Text>Intervalles de qualification insuffisants : {summary.gapCount}</Text>
 <Text>{summary.truncated?'Au moins ':''}Heures-personnes manquantes par qualification : {summary.missingStaffHours.toLocaleString('fr-CA')} h</Text>
 <Text>Quarts publiés sans salarié : {summary.vacantShifts===null?'Non disponible':String(summary.vacantShifts)}</Text>
 <Text>Heures planifiées affectées : {summary.plannedHours===null?'Non disponible':summary.plannedHours+' h'}</Text>
 <Text>Manques par département : {summary.departmentGaps===null?'Non disponible':summary.departmentGaps+' intervalle(s)'}</Text>
 </View>:null}
{s.planningWarning?<Text accessibilityRole="alert">Rapport des quarts indisponible, mais analyse des qualifications accessible.</Text>:null}
<Text>Résultat : {s.report.gap_count} intervalle(s) insuffisant(s)</Text><Text>{s.report.rules} règle(s) active(s) sur la période</Text><Text>{s.report.notice}</Text>{s.report.truncated?<Text accessibilityRole="alert">Résultat limité aux 2000 premiers intervalles. Réduire la période.</Text>:null}{s.report.gaps.map((g:any,i:number)=><View key={i} style={{gap:6,paddingVertical:8}}>
   <Text>{g.title} · {g.department_name} · {g.certificate_title} : {g.staffed}/{g.minimum_staff}</Text>
   <Text>{date(g.starts_at,g.timezone)} → {date(g.ends_at,g.timezone)} · {g.timezone}</Text>
   {s.editAllowed?button('Voir salariés admissibles (12 h max)','candidates',String(i)):null}
 </View>)}
 {s.candidates?<View style={{gap:7,padding:12,borderColor:'#E1E8DB',borderWidth:1,borderRadius:9}}>
   <Text style={{fontWeight:'700'}}>Candidats avec certification requise</Text>
   <Text>{s.candidates.available} disponible(s), {s.candidates.unknown} inconnu(s), {s.candidates.unavailable} indisponible(s).</Text>
   {s.candidateWindow?.partial?<Text>Seulement les 12 premières heures du déficit sont évaluées.</Text>:null}
   <Text>Aucun quart proposé ou attribué. Les raisons privées et coordonnées personnelles restent masquées.</Text>
   {s.candidates.candidates.map((w:any)=><Text key={w.worker_id}>{w.name} · {candidateStatusLabel(w.status)}</Text>)}
 </View>:null}</View>:null}</>}</ScrollView>;
}
