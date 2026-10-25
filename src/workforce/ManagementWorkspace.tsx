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
import {Pressable,SafeAreaView,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {MorePortal,type Section} from '../hr/MorePortal';
import {MessagesScreen} from '../messages/MessagesScreen';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
type Person={user_id:string;role:string};
export function ManagementWorkspace({account,children}:{account:WorkspaceAccount;children?:React.ReactNode}){
 const {width}=useWindowDimensions();const wide=width>850,boss=account.role==='boss',essential=account.edition==='essential';
 const [page,setPage]=useState<Section|'home'|'members'|'messages'|'punch'|'supervision'|'breakPolicies'|'organization'|'billing'|'kiosks'|'hr'|'communications'|'payroll'|'missingDays'|'breakCorrections'|'support'>('home'),[people,setPeople]=useState<Person[]>([]),[error,setError]=useState('');
 async function refresh(){const r=await supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active');if(r.error)setError(r.error.message);else setPeople(r.data||[]);}
 useEffect(()=>{refresh()},[account.companyId]);
 const links:[typeof page,string][]=[['home','Vue d’ensemble'],['members','Employés'],...(essential?[['organization','Établissements et départements'],['breakPolicies','Politiques de pauses'],['kiosks','Bornes de pointage'],['supervision','Approbations de l’équipe'],['missingDays','Journées oubliées'],['breakCorrections','Corrections de pauses'],['hr','Documents et formations'],['support','Support PUNCH'],['communications','Communications'],['payroll','Paie, coûts et banques']] as [typeof page,string][]:[]),...(account.edition!=='essential'?[['admin','Chantiers'],['teams','Équipes']] as [typeof page,string][]:[]),['schedule','Planification'],['workforce','Heures et approbations'],['geofence','Contrôle GPS'],['invite','Invitations'],...(account.edition!=='essential'?[['documents','Documents']] as [typeof page,string][]:[]),['messages','Messages'],...(essential&&boss?[['billing','Abonnement et factures']] as [typeof page,string][]:[])];
 const go=(id:typeof page)=>setPage(id);
 const tile=(id:typeof page,label:string)=><Pressable key={id} onPress={()=>go(id)} style={{backgroundColor:'white',borderColor:(essential?'#E1E8DB':'#dae2e8'),borderWidth:1,padding:18,borderRadius:12,width:wide?'31%':'47%',minHeight:85,justifyContent:'center'}}><Text style={{color:(essential?'#2F4935':'#234557'),fontWeight:'600',fontSize:15}}>{label}</Text></Pressable>;
 if(page==='punch'&&boss)return <View style={{flex:1}}><Pressable onPress={()=>go('home')} style={{padding:12,backgroundColor:(essential?'#eff4ec':'#142d3b')}}><Text style={{color:'white'}}>← Retour à la direction</Text></Pressable>{children}</View>;
 return <SafeAreaView style={{flex:1,backgroundColor:(essential?'#FAFBF8':'#f2f4f7')}}><View style={{flex:1,flexDirection:wide?'row':'column'}}>
  <View style={{width:wide?235:'100%',padding:16,gap:10,backgroundColor:boss?(essential?'#eff4ec':'#142d3b'):'white',borderRightWidth:wide?1:0,borderColor:(essential?'#E1E8DB':'#dce4ea')}}>
   <Text style={{fontWeight:'800',fontSize:23,color:boss?(essential?'#2F4935':'#fff'):(essential?'#2F4935':'#234557')}}>PUNCH <Text style={{color:boss?(essential?'#4e7051':'#d8bd80'):(essential?'#779574':'#538199')}}>360°</Text></Text><Text style={{fontSize:10,letterSpacing:1,color:boss?(essential?'#6d8066':'#c4b487'):(essential?'#6d8066':'#71899a')}}>{boss?'ESPACE DIRECTION':'ADMINISTRATION · BUREAU'}</Text>
   <ScrollView horizontal={!wide} style={{flex:wide?1:undefined}} contentContainerStyle={{gap:5}}>{links.map(([id,label])=><Pressable key={id} onPress={()=>go(id)} style={{padding:10,borderRadius:8,backgroundColor:page===id?(boss?(essential?'#dce9d6':'#304f5e'):(essential?'#dce9d6':'#e7eff4')):'transparent'}}><Text style={{color:boss?(essential?'#2F4935':'#e1ebf0'):(essential?'#2F4935':'#37596e'),fontSize:13}}>{label}</Text></Pressable>)}</ScrollView>
   {wide?<Pressable onPress={()=>supabase.auth.signOut()}><Text style={{color:boss?'white':(essential?'#2F4935':'#37596e')}}>Se déconnecter</Text></Pressable>:null}
  </View>
  <View style={{flex:1,minWidth:0}}><View style={{padding:18,backgroundColor:'white',borderBottomWidth:1,borderColor:'#e0e6eb'}}><Text style={{color:(essential?'#2F4935':'#264556'),fontSize:20,fontWeight:'600'}}>{account.companyName}</Text><Text style={{color:(essential?'#6d8066':'#78909e'),fontSize:11,marginTop:4}}>{boss?'Direction de l’entreprise':'Gestion administrative'}</Text></View>
  {error?<Text style={{color:'#ad3345',padding:12}}>{error}</Text>:null}
  {page==='supervision'&&essential?<SupervisorApprovalsPanel key={account.companyId+account.userId} account={account}/>:page==='breakPolicies'&&essential?<ScrollView><BreakPoliciesPanel key={account.companyId+account.userId} account={account}/></ScrollView>:page==='missingDays'?<MissingDaysPanel key={account.companyId+account.userId} account={account}/>:page==='support'&&essential?<SupportPanel key={account.companyId+account.userId} account={account}/>:page==='breakCorrections'&&essential?<BreakCorrectionsPanel key={account.companyId+account.userId} account={account}/>:page==='payroll'&&essential?<EssentialPayrollPanel key={account.companyId+account.userId} account={account}/>:page==='communications'&&essential?<EssentialCommunicationsPanel key={account.companyId+account.userId} account={account}/>:page==='hr'&&essential?<EssentialHrPanel key={account.companyId+account.userId} account={account}/>:page==='kiosks'&&essential?<KioskPanel account={account}/>:page==='billing'&&essential&&boss?<BillingPanel account={account}/>:page==='home'?<View style={{flex:1,padding:18,gap:15}}><Text style={{fontSize:25,fontWeight:'600',color:(essential?'#2F4935':'#243f50')}}>{boss?'Vue d’ensemble':'Mon bureau'}</Text><Text style={{color:(essential?'#6d8066':'#718794')}}>{people.length} membre(s) · {account.edition==='essential'?'PUNCH Essentiel':'PUNCH Construction'}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{links.filter(([id])=>!['home','messages'].includes(id)).map(([id,label])=>tile(id,label))}</View>{boss?tile('punch','Accéder à mon punch'):null}<Pressable onPress={()=>supabase.auth.signOut()}><Text style={{color:'#45667a'}}>Se déconnecter</Text></Pressable></View>:(page==='schedule'||page==='organization')&&essential?<EssentialPlanningPanel account={account} initial={page==='organization'?'organization':'calendar'}/>:page==='members'&&account.edition==='essential'?<EssentialPeoplePanel account={account}/>:page==='members'?<ScrollView contentContainerStyle={{padding:20,gap:12}}>{people.map(p=><View key={p.user_id} style={{padding:16,backgroundColor:'white',borderRadius:10}}><Text style={{color:(essential?'#2F4935':'#234557')}}>{p.user_id===account.userId?account.email:p.user_id.slice(0,8)}</Text><Text style={{color:(essential?'#6d8066':'#718794')}}>{p.role}</Text></View>)}</ScrollView>:page==='messages'?<MessagesScreen account={account}/>:<MorePortal key={page} account={account} initialSection={page as Section} managementOnly onRefresh={refresh}/>}
  </View>
 </View></SafeAreaView>;
}
