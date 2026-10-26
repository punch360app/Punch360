/** Essentiel employee shell translations. Backend error messages and specialist modules
 * retain their own locale until migrated; never machine-translate payroll/legal text.
 */
export const ESSENTIAL_LANGUAGES=Object.freeze([
 {code:'fr',name:'Français',dir:'ltr'},
 {code:'en',name:'English',dir:'ltr'},
 {code:'es',name:'Español',dir:'ltr'},
 {code:'pt',name:'Português',dir:'ltr'},
 {code:'it',name:'Italiano',dir:'ltr'},
 {code:'de',name:'Deutsch',dir:'ltr'},
 {code:'ar',name:'العربية',dir:'rtl'},
 {code:'zh',name:'简体中文',dir:'ltr'},
 {code:'hi',name:'हिन्दी',dir:'ltr'},
 {code:'tl',name:'Filipino',dir:'ltr'}
]);
const keys=['punch','hours','schedule','more','management','settings','language','profile',
 'employees','logout','notifications','refresh','greeting','startDay','endDay',
 'break','resume','thisWeek','workingTime','status','synchronized','offline',
 'mySpace','myLeave','myCalendar','myHours','support','theme','save','cancel'];
const translated={
 fr:['Punch','Heures','Horaire','Plus','Gestion','Paramètres','Langue','Mon profil','Employés','Se déconnecter','Notifications','Actualiser','Bonjour','Commencer ma journée','Terminer ma journée','Pause','Reprendre le travail','Cette semaine','Temps travaillé aujourd’hui','Statut','Synchronisé','Hors ligne','Mon espace','Mes congés','Mon horaire','Mes heures','Support PUNCH','Apparence','Enregistrer','Annuler'],
 en:['Clock','Hours','Schedule','More','Management','Settings','Language','My profile','Employees','Sign out','Notifications','Refresh','Hello','Start my day','End my day','Break','Resume work','This week','Time worked today','Status','Synced','Offline','My space','My leave','My schedule','My hours','PUNCH support','Appearance','Save','Cancel'],
 es:['Fichar','Horas','Horario','Más','Gestión','Configuración','Idioma','Mi perfil','Empleados','Cerrar sesión','Notificaciones','Actualizar','Hola','Comenzar mi jornada','Terminar mi jornada','Descanso','Volver al trabajo','Esta semana','Tiempo trabajado hoy','Estado','Sincronizado','Sin conexión','Mi espacio','Mis ausencias','Mi horario','Mis horas','Soporte PUNCH','Apariencia','Guardar','Cancelar'],
 pt:['Ponto','Horas','Horário','Mais','Gestão','Configurações','Idioma','Meu perfil','Funcionários','Sair','Notificações','Atualizar','Olá','Iniciar meu dia','Encerrar meu dia','Pausa','Retomar o trabalho','Esta semana','Tempo trabalhado hoje','Estado','Sincronizado','Offline','Meu espaço','Minhas folgas','Meu horário','Minhas horas','Suporte PUNCH','Aparência','Salvar','Cancelar'],
 it:['Timbratura','Ore','Orario','Altro','Gestione','Impostazioni','Lingua','Il mio profilo','Dipendenti','Esci','Notifiche','Aggiorna','Ciao','Inizia la giornata','Termina la giornata','Pausa','Riprendi il lavoro','Questa settimana','Ore lavorate oggi','Stato','Sincronizzato','Offline','Il mio spazio','Le mie assenze','Il mio orario','Le mie ore','Supporto PUNCH','Aspetto','Salva','Annulla'],
 de:['Stempeln','Stunden','Dienstplan','Mehr','Verwaltung','Einstellungen','Sprache','Mein Profil','Mitarbeiter','Abmelden','Benachrichtigungen','Aktualisieren','Hallo','Arbeitstag beginnen','Arbeitstag beenden','Pause','Arbeit fortsetzen','Diese Woche','Heute gearbeitete Zeit','Status','Synchronisiert','Offline','Mein Bereich','Meine Abwesenheiten','Mein Dienstplan','Meine Stunden','PUNCH Support','Design','Speichern','Abbrechen'],
 ar:['تسجيل الوقت','الساعات','الجدول','المزيد','الإدارة','الإعدادات','اللغة','ملفي الشخصي','الموظفون','تسجيل الخروج','الإشعارات','تحديث','مرحبًا','بدء يوم العمل','إنهاء يوم العمل','استراحة','استئناف العمل','هذا الأسبوع','وقت العمل اليوم','الحالة','تمت المزامنة','دون اتصال','مساحتي','إجازاتي','جدولي','ساعاتي','دعم PUNCH','المظهر','حفظ','إلغاء'],
 zh:['打卡','工时','排班','更多','管理','设置','语言','个人资料','员工','退出登录','通知','刷新','你好','开始工作','结束工作','休息','继续工作','本周','今日工时','状态','已同步','离线','我的空间','我的假期','我的排班','我的工时','PUNCH 支持','外观','保存','取消'],
 hi:['पंच','घंटे','कार्यसूची','अधिक','प्रबंधन','सेटिंग','भाषा','मेरी प्रोफ़ाइल','कर्मचारी','लॉग आउट','सूचनाएँ','ताज़ा करें','नमस्ते','काम शुरू करें','काम समाप्त करें','ब्रेक','काम फिर शुरू करें','इस सप्ताह','आज का कार्य समय','स्थिति','सिंक हुआ','ऑफ़लाइन','मेरा क्षेत्र','मेरी छुट्टियाँ','मेरी कार्यसूची','मेरे घंटे','PUNCH सहायता','दिखावट','सहेजें','रद्द करें'],
 tl:['Punch','Oras','Iskedyul','Iba pa','Pamamahala','Mga setting','Wika','Aking profile','Mga empleyado','Mag-sign out','Mga abiso','I-refresh','Kumusta','Simulan ang trabaho','Tapusin ang trabaho','Pahinga','Magpatuloy sa trabaho','Ngayong linggo','Oras ng trabaho ngayon','Status','Naka-sync','Offline','Aking espasyo','Aking leave','Aking iskedyul','Aking oras','PUNCH support','Hitsura','I-save','Kanselahin']
};
export const LOCALE_STRINGS=Object.freeze(Object.fromEntries(Object.entries(translated).map(([lang,words])=>{
 if(words.length!==keys.length)throw Error('Translation coverage mismatch: '+lang);
 return [lang,Object.freeze(Object.fromEntries(keys.map((key,i)=>[key,words[i]])))];
})));
export function createEssentialLocale({storage=null}={}){
 let user=null,code='fr';
 const valid=value=>ESSENTIAL_LANGUAGES.some(l=>l.code===value)?value:'fr';
 return {
  get code(){return code;},
  get dir(){return ESSENTIAL_LANGUAGES.find(x=>x.code===code)?.dir||'ltr';},
  setUser(id){if(user===id)return;user=id;try{code=valid(user?storage?.getItem('punch-locale:'+user):'fr');}catch{code='fr';}},
  select(value){code=valid(value);try{if(user)storage?.setItem('punch-locale:'+user,code);}catch{}return code;},
  t(key){return LOCALE_STRINGS[code]?.[key]??LOCALE_STRINGS.fr[key]??key;}
 };
}
