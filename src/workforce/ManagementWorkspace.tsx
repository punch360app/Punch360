import {BossHandoffPanel} from './BossHandoffPanel';
import {QualifiedCoveragePanel} from './QualifiedCoveragePanel';
import {LaborBudgetsPanel} from './LaborBudgetsPanel';
import {SupervisorApprovalsPanel} from './SupervisorApprovalsPanel';
import {BreakPoliciesPanel} from './BreakPoliciesPanel';
import {MissingDaysPanel} from './MissingDaysPanel';
import {SupportPanel} from '../support/SupportPanel';
import {BreakCorrectionsPanel} from './BreakCorrectionsPanel';
import {EssentialPayrollPanel} from '../hr/EssentialPayrollPanel';
import {EssentialCommunicationsPanel} from '../hr/EssentialCommunicationsPanel';
import {EssentialHrPanel} from '../hr/EssentialHrPanel';
import {KioskPanel} from './KioskPanel';
import {BillingPanel} from '../billing/BillingPanel';
import {EssentialPlanningPanel} from './EssentialPlanningPanel';
import {EssentialPeoplePanel} from './EssentialPeoplePanel';
import React,{useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {nativeEssentialLanguages,nativeEssentialText,nativeManagementLabel,readNativeLocale,writeNativeLocale,nativeLocaleDirection} from '../i18n/essential-native-locale';
import {Pressable,SafeAreaView,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {MorePortal,type Section} from '../hr/MorePortal';
import {MessagesScreen} from '../messages/MessagesScreen';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
type Person={user_id:string;role:string};
export function ManagementWorkspace({account,children}:{account:WorkspaceAccount;children?:React.ReactNode}){
 const {width}=useWindowDimensions();const wide=width>850,boss=account.role==='boss',essential=account.edition==='essential';
 const [page,setPage]=useState<Section|'home'|'members'|'messages'|'punch'|'supervision'|'breakPolicies'|'organization'|'billing'|'kiosks'|'hr'|'communications'|'payroll'|'laborBudgets'|'qualifiedCoverage'|'missingDays'|'breakCorrections'|'support'|'bossHandoff'>('home'),[people,setPeople]=useState<Person[]>([]),[error,setError]=useState('');
 const [billingStatus,setBillingStatus]=useState(account.billingStatus),[statusLoading,setStatusLoading]=useState(essential),[statusFailed,setStatusFailed]=useState(false);
 const restricted=essential&&(statusLoading||statusFailed||['restricted','cancelled'].includes(billingStatus));
 const [language,setLanguage]=useState('fr'),[languageMenu,setLanguageMenu]=useState(false);
 const rtl=essential&&nativeLocaleDirection(language)==='rtl';
 const t=(key:string)=>nativeEssentialText(language,key);
 useEffect(()=>{let alive=true;setLanguage('fr');setLanguageMenu(false);
  if(essential)readNativeLocale(AsyncStorage,account.userId).then(code=>{if(alive)setLanguage(code)});
  return()=>{alive=false};
 },[account.userId,essential]);
 async function selectLanguage(code:string){setLanguage(code);setLanguageMenu(false);
  try{await writeNativeLocale(AsyncStorage,account.userId,code);}
  catch{setError('Impossible d’enregistrer la préférence linguistique.');}
 }

 useEffect(()=>{
  let alive=true;setPage('home');setBillingStatus(account.billingStatus);setStatusLoading(essential);setStatusFailed(false);
  if(!essential)return()=>{alive=false;};
  (async()=>{try{
   const r=await supabase.rpc('essential_entitlements',{p_company:account.companyId});
   if(!alive)return;if(r.error)throw r.error;
   setBillingStatus((r.data as {billing_status?:string}|null)?.billing_status||account.billingStatus);
  }catch{if(alive)setStatusFailed(true);}finally{if(alive)setStatusLoading(false);}})();
  return()=>{alive=false;};
 },[account.companyId,account.role,account.edition,account.billingStatus]);
 async function refresh(){const r=await supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active');if(r.error)setError(r.error.message);else setPeople(r.data||[]);}
 useEffect(()=>{if(restricted)setPeople([]);else refresh();},[account.companyId,restricted]);
 const links:[typeof page,string][]=restricted?[['home','Accès limité'],...(boss?[['billing','Abonnement et factures']] as [typeof page,string][]:[]),['support','Support PUNCH'],...(boss?[['punch','Mon pointage']] as [typeof page,string][]:[])]:([['home','Vue d’ensemble'],['members','Employés'],...(essential?[['organization','Établissements et départements'],['breakPolicies','Politiques de pauses'],['kiosks','Bornes de pointage'],['supervision','Approbations de l’équipe'],['missingDays','Journées oubliées'],['breakCorrections','Corrections de pauses'],['hr','Documents et formations'],['support','Support PUNCH'],['communications','Communications'],['payroll','Paie, coûts et banques'],['laborBudgets','Budgets de main-d’œuvre'],['qualifiedCoverage','Couverture par qualification'],['bossHandoff','Transmission de direction']] as [typeof page,string][]:[]),...(account.edition!=='essential'?[['admin','Chantiers'],['teams','Équipes']] as [typeof page,string][]:[]),['schedule','Planification'],['workforce','Heures et approbations'],['geofence','Contrôle GPS'],['invite','Invitations'],...(account.edition!=='essential'?[['documents','Documents']] as [typeof page,string][]:[]),['messages','Messages'],...(essential&&boss?[['billing','Abonnement et factures']] as [typeof page,string][]:[])]);
 const localizedLinks=essential?links.map(([id,label])=>[id,nativeManagementLabel(language,id,label)] as [typeof page,string]):links;
 const go=(id:typeof page)=>{if(restricted&&!['home','support',...(boss?['billing','punch']:[])].includes(id))return;setPage(id);};
 const tile=(id:typeof page,label:string)=><Pressable key={id} onPress={()=>go(id)} style={{backgroundColor:'white',borderColor:(essential?'#E1E8DB':'#dae2e8'),borderWidth:1,padding:18,borderRadius:12,width:wide?'31%':'47%',minHeight:85,justifyContent:'center'}}><Text style={{color:(essential?'#2F4935':'#234557'),fontWeight:'600',fontSize:15}}>{label}</Text></Pressable>;
 if(page==='punch'&&boss)return <View style={{flex:1}}><Pressable onPress={()=>go('home')} style={{padding:12,backgroundColor:(essential?'#eff4ec':'#142d3b')}}><Text style={{color:'white'}}>{essential?t('bossSpace'):'← Retour à la direction'}</Text></Pressable>{children}</View>;
 return <SafeAreaView style={{flex:1,backgroundColor:(essential?'#FAFBF8':'#f2f4f7')}}><View style={{flex:1,flexDirection:wide?'row':'column'}}>
  <View style={{width:wide?235:'100%',padding:16,gap:10,backgroundColor:boss?(essential?'#eff4ec':'#142d3b'):'white',borderRightWidth:wide?1:0,borderColor:(essential?'#E1E8DB':'#dce4ea'),direction:rtl?'rtl':'ltr'}}>
   <Text style={{fontWeight:'800',fontSize:23,color:boss?(essential?'#2F4935':'#fff'):(essential?'#2F4935':'#234557')}}>PUNCH <Text style={{color:boss?(essential?'#4e7051':'#d8bd80'):(essential?'#779574':'#538199')}}>360°</Text></Text><Text style={{fontSize:10,letterSpacing:1,color:boss?(essential?'#6d8066':'#c4b487'):(essential?'#6d8066':'#71899a')}}>{essential?(boss?t('bossSpace'):t('adminOffice')):boss?'ESPACE DIRECTION':'ADMINISTRATION · BUREAU'}</Text>
   {essential?<View style={{gap:5}}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('language')} accessibilityState={{expanded:languageMenu}} onPress={()=>setLanguageMenu(v=>!v)} style={{borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,padding:8}}>
     <Text style={{color:'#2F4935',fontSize:13,textAlign:rtl?'right':'left'}}>{t('language')} : {nativeEssentialLanguages.find(x=>x.code===language)?.name||'Français'} ▾</Text>
    </Pressable>
    {languageMenu?<ScrollView nestedScrollEnabled style={{maxHeight:150,backgroundColor:'#fff',borderRadius:8,borderWidth:1,borderColor:'#E1E8DB'}}>
     {nativeEssentialLanguages.map(item=><Pressable key={item.code} accessibilityRole="button" accessibilityState={{selected:language===item.code}} onPress={()=>{void selectLanguage(item.code)}} style={{padding:9,backgroundColor:language===item.code?'#edf4ea':'white'}}>
      <Text style={{color:'#2F4935',textAlign:item.dir==='rtl'?'right':'left'}}>{item.name}</Text>
     </Pressable>)}
    </ScrollView>:null}
   </View>:null}
   <ScrollView horizontal={!wide} style={{flex:wide?1:undefined}} contentContainerStyle={{gap:5}}>{localizedLinks.map(([id,label])=><Pressable key={id} onPress={()=>go(id)} style={{padding:10,borderRadius:8,backgroundColor:page===id?(boss?(essential?'#dce9d6':'#304f5e'):(essential?'#dce9d6':'#e7eff4')):'transparent'}}><Text style={{color:boss?(essential?'#2F4935':'#e1ebf0'):(essential?'#2F4935':'#37596e'),fontSize:13,textAlign:rtl?'right':'left'}}>{label}</Text></Pressable>)}</ScrollView>
   {wide?<Pressable onPress={()=>supabase.auth.signOut()}><Text style={{color:boss?'white':(essential?'#2F4935':'#37596e')}}>{essential?t('logout'):'Se déconnecter'}</Text></Pressable>:null}
  </View>
  <View style={{flex:1,minWidth:0}}><View style={{padding:18,backgroundColor:'white',borderBottomWidth:1,borderColor:'#e0e6eb'}}><Text style={{color:(essential?'#2F4935':'#264556'),fontSize:20,fontWeight:'600'}}>{account.companyName}</Text><Text style={{color:(essential?'#6d8066':'#78909e'),fontSize:11,marginTop:4}}>{essential?t('companyManagement'):boss?'Direction de l’entreprise':'Gestion administrative'}</Text></View>
  {error?<Text style={{color:'#ad3345',padding:12}}>{error}</Text>:null}
  {restricted?(page==='support'&&essential?<SupportPanel key={account.companyId+account.userId} account={account}/>:page==='billing'&&essential&&boss?<BillingPanel account={account}/>:<View style={{padding:22,gap:12}}><Text style={{fontSize:22,fontWeight:'700',color:'#2F4935'}}>{essential?t('accessLimited'):'Accès limité'}</Text><Text style={{color:'#2F4935'}}>{statusLoading?(essential?t('accessChecking'):'Vérification de votre accès en cours…'):statusFailed?(essential?t('billingUnavailable'):'État de facturation temporairement indisponible. Réessayez plus tard.'):(essential?t('managementSuspended'):'La gestion est suspendue. Le support, les factures et le pointage personnel restent accessibles selon votre rôle.')}</Text>{boss?<Pressable onPress={()=>go('billing')} accessibilityRole="button"><Text style={{color:'#4D7051',fontWeight:'600'}}>{essential?t('billing'):'Abonnement et factures'}</Text></Pressable>:null}<Pressable onPress={()=>go('support')} accessibilityRole="button"><Text style={{color:'#4D7051',fontWeight:'600'}}>{essential?t('support'):'Support PUNCH'}</Text></Pressable>{boss?<Pressable onPress={()=>go('punch')} accessibilityRole="button"><Text style={{color:'#4D7051',fontWeight:'600'}}>{essential?t('punchAccess'):'Accéder à mon pointage'}</Text></Pressable>:null}</View>):page==='bossHandoff'&&essential?<BossHandoffPanel key={account.companyId+account.userId} account={account}/>:page==='qualifiedCoverage'&&essential?<QualifiedCoveragePanel key={[account.companyId,account.userId,account.role,account.edition].join(':')} account={account}/>:page==='laborBudgets'&&essential?<LaborBudgetsPanel key={account.companyId+account.userId} account={account}/>:page==='supervision'&&essential?<SupervisorApprovalsPanel key={account.companyId+account.userId} account={account}/>:page==='breakPolicies'&&essential?<ScrollView><BreakPoliciesPanel key={account.companyId+account.userId} account={account}/></ScrollView>:page==='missingDays'?<MissingDaysPanel key={account.companyId+account.userId} account={account}/>:page==='support'&&essential?<SupportPanel key={account.companyId+account.userId} account={account}/>:page==='breakCorrections'&&essential?<BreakCorrectionsPanel key={account.companyId+account.userId} account={account}/>:page==='payroll'&&essential?<EssentialPayrollPanel key={account.companyId+account.userId} account={account}/>:page==='communications'&&essential?<EssentialCommunicationsPanel key={account.companyId+account.userId} account={account}/>:page==='hr'&&essential?<EssentialHrPanel key={account.companyId+account.userId} account={account}/>:page==='kiosks'&&essential?<KioskPanel account={account}/>:page==='billing'&&essential&&boss?<BillingPanel account={account}/>:page==='home'?<View style={{flex:1,padding:18,gap:15}}><Text style={{fontSize:25,fontWeight:'600',color:(essential?'#2F4935':'#243f50')}}>{essential?(boss?t('overview'):t('adminOffice')):boss?'Vue d’ensemble':'Mon bureau'}</Text><Text style={{color:(essential?'#6d8066':'#718794')}}>{people.length} {essential?t('membersCount'):'membre(s)'} · {account.edition==='essential'?'PUNCH Essentiel':'PUNCH Construction'}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{localizedLinks.filter(([id])=>!['home','messages'].includes(id)).map(([id,label])=>tile(id,label))}</View>{boss?tile('punch',essential?t('punchAccess'):'Accéder à mon punch'):null}<Pressable onPress={()=>supabase.auth.signOut()}><Text style={{color:'#45667a'}}>{essential?t('logout'):'Se déconnecter'}</Text></Pressable></View>:(page==='schedule'||page==='organization')&&essential?<EssentialPlanningPanel account={account} initial={page==='organization'?'organization':'calendar'}/>:page==='members'&&account.edition==='essential'?<EssentialPeoplePanel account={account}/>:page==='members'?<ScrollView contentContainerStyle={{padding:20,gap:12}}>{people.map(p=><View key={p.user_id} style={{padding:16,backgroundColor:'white',borderRadius:10}}><Text style={{color:(essential?'#2F4935':'#234557')}}>{p.user_id===account.userId?account.email:p.user_id.slice(0,8)}</Text><Text style={{color:(essential?'#6d8066':'#718794')}}>{p.role}</Text></View>)}</ScrollView>:page==='messages'?<MessagesScreen account={account}/>:<MorePortal key={page} account={account} initialSection={page as Section} managementOnly onRefresh={refresh}/>}
  </View>
 </View></SafeAreaView>;
}
