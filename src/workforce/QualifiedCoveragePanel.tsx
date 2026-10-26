import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {createQualifiedCoverageController,summarizeCoverageDemand,candidateStatusLabel} from '../../web/live/qualified-coverage.js';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
export function QualifiedCoveragePanel({account}:{account:WorkspaceAccount}){
 const [,redraw]=useState(0),holder=useRef<any>(null);
 if(!holder.current)holder.current=createQualifiedCoverageController({sb:supabase,redraw:()=>redraw(v=>v+1),escape:(v:any)=>String(v??'')});
 const ui=holder.current,s=ui.state;
 useEffect(()=>{let active=true;const load=async()=>{const [d,l]=await Promise.all(['essential_departments','essential_locations'].map(table=>supabase.from(table).select('*').eq('company_id',account.companyId)));if(!active)return;if(d.error||l.error)throw d.error||l.error;await ui.load({company_id:account.companyId,role:account.role},d.data||[],l.data||[]);if(active)redraw(v=>v+1)};load().catch(e=>{if(active){s.error=e.message;redraw(v=>v+1)}});return()=>{active=false;ui.reset()}},[account.companyId,account.userId]);
 const input=(key:string,value:string)=>{ui.input({id:'qualified-'+key,value});redraw(v=>v+1)};
 const field=(label:string,key:string)=><View><Text>{label}</Text><TextInput accessibilityLabel={label} editable={!s.busy} value={s[key]} onChangeText={v=>input(key,v)} style={{padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/></View>;
 const button=(label:string,action:string,id='',disabled=false)=><Pressable accessibilityRole="button" disabled={s.busy||disabled} onPress={()=>{const pending=ui.handle({dataset:{action:'qualified:'+action,id}});redraw(v=>v+1);void pending}} style={{padding:13,backgroundColor:'#E1E8DB',borderRadius:9,opacity:s.busy||disabled?0.5:1}}><Text style={{color:'#2F4935'}}>{label}</Text></Pressable>;
 const zone=(department:string)=>s.locations.find((l:any)=>l.id===s.departments.find((d:any)=>d.id===department)?.location_id)?.timezone||'America/Toronto';
 const date=(value:string,tz:string)=>new Intl.DateTimeFormat('fr-CA',{timeZone:tz,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 const summary=summarizeCoverageDemand(s.report,s.planningReport);
 return <ScrollView contentContainerStyle={{gap:13,padding:18,backgroundColor:'#FAFBF8'}}><Text style={{fontSize:24,color:'#2F4935'}}>Couverture par qualification</Text>{s.error?<Text accessibilityRole="alert">{s.error}</Text>:null}{!s.allowed?<Text>Gestionnaire et forfait Pro requis.</Text>:<><Text>Minimum de personnes avec certificat émis et valide pendant une plage précise. Le titre doit correspondre au dossier RH, casse et espaces aux extrémités ignorés. Un salarié peut satisfaire plusieurs qualifications; aucun poste exclusif n’est déduit.</Text>{s.editAllowed?<>{button('Nouvelle plage','new')}<Text>{s.editing?'Modifier la plage · v'+s.editing.version:'Nouvelle plage'}</Text><Text>Département</Text>{s.departments.filter((d:any)=>d.active).map((d:any)=><Pressable accessibilityRole="radio" accessibilityState={{selected:d.id===s.department}} disabled={s.busy} key={d.id} onPress={()=>input('department',d.id)} style={{padding:12}}><Text>{d.id===s.department?'● ':'○ '}{d.name} · {zone(d.id)}</Text></Pressable>)}{field('Titre de la plage','title')}{field('Titre du certificat requis','certificate')}{field('Début local AAAA-MM-JJTHH:MM','start')}{field('Fin locale AAAA-MM-JJTHH:MM','end')}<Text>Heures locales du département choisi.</Text>{field('Minimum de personnes qualifiées','minimum')}{field('Motif','reason')}<Pressable accessibilityRole="checkbox" accessibilityState={{checked:s.active}} disabled={s.busy} onPress={()=>{ui.input({id:'qualified-active',checked:!s.active});redraw(v=>v+1)}} style={{padding:12}}><Text>{s.active?'✓ ':'○ '}Plage active</Text></Pressable>{button('Enregistrer la plage','save')}</>:<Text>Permission Certifications requise pour configurer les plages.</Text>}<Text style={{fontSize:19}}>Plages configurées</Text>{s.rules.map((r:any)=><View key={r.id} style={{gap:10,padding:13,borderWidth:1,borderColor:'#E1E8DB',borderRadius:10}}><Text>{r.title}{r.active?'':' · désactivée'}</Text><Text>{r.certificate_title} · minimum {r.minimum_staff}</Text><Text>{date(r.starts_at,zone(r.department_id))} → {date(r.ends_at,zone(r.department_id))} · {zone(r.department_id)}</Text>{s.editAllowed?<>{button('Modifier','edit',r.id)}{button('Copier la plage','copy',r.id)}</>:null}{button('Vérifier cette période','report',r.id,!r.active)}</View>)}{s.report?<View style={{gap:10}}><Text style={{fontWeight:'700',fontSize:18}}>Besoins et couverture consolidés</Text>
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
