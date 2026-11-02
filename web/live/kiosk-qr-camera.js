// Only previews an employee-presented QR on a common tablet camera.
// QR contents are untrusted and intentionally NOT returned to the UI or sent to
// kiosk_execute: the deployed Edge Function accepts employee number + PIN only.
// No credential, video frame or decoded QR is persisted, logged or exported.
export const kioskQrCopy=Object.freeze({
 fr:{open:'Scanner la carte QR de l’employé',help:'Présentez votre carte QR devant la caméra de la tablette. Le pointage par QR nécessite encore la validation du serveur. Matricule et NIP restent disponibles.',title:'Lire une carte QR',scanning:'Caméra en cours · placez le QR dans le cadre',close:'Fermer la caméra',unsupported:'Cette tablette ne prend pas en charge la lecture QR dans ce navigateur. Utilisez matricule et NIP.',camera:'Caméra indisponible ou accès refusé. Utilisez matricule et NIP.',decode:'Lecture QR interrompue. Utilisez matricule et NIP.',expired:'Lecture interrompue après 30 secondes. Réessayez ou utilisez le NIP.',read:'QR détecté, mais non authentifié : aucun pointage enregistré. Utilisez matricule et NIP.'},
 en:{open:'Scan employee QR card',help:'Present your QR card to the tablet camera. QR punch-in still requires server verification. Employee ID and PIN remain available.',title:'Read QR card',scanning:'Camera on · place the QR in view',close:'Close camera',unsupported:'QR scanning is not supported by this browser. Use employee ID and PIN.',camera:'Camera unavailable or permission denied. Use employee ID and PIN.',decode:'QR scanning stopped. Use employee ID and PIN.',expired:'Scanning stopped after 30 seconds. Retry or use PIN.',read:'QR detected but not authenticated. No punch recorded. Use employee ID and PIN.'},
 es:{open:'Escanear tarjeta QR del empleado',help:'Muestre la tarjeta QR a la cámara de la tableta. El fichaje QR aún requiere verificación del servidor. Puede usar número y PIN.',title:'Leer tarjeta QR',scanning:'Cámara activa · muestre el QR',close:'Cerrar cámara',unsupported:'Lectura QR no disponible. Use número y PIN.',camera:'Cámara no disponible o permiso denegado. Use número y PIN.',decode:'Lectura QR interrumpida. Use número y PIN.',expired:'Lectura detenida tras 30 segundos. Use el PIN.',read:'QR detectado, pero no autenticado. No se registró ningún fichaje. Use número y PIN.'},
 pt:{open:'Ler cartão QR do empregado',help:'Mostre o QR à câmera do tablet. O registro por QR ainda precisa de validação do servidor. Número e PIN continuam disponíveis.',title:'Ler cartão QR',scanning:'Câmera ativa · mostre o QR',close:'Fechar câmera',unsupported:'Leitura QR indisponível. Use número e PIN.',camera:'Câmera indisponível ou acesso negado. Use número e PIN.',decode:'Leitura QR interrompida. Use número e PIN.',expired:'Leitura encerrada após 30 segundos. Use o PIN.',read:'QR detectado, mas não autenticado. Nenhum ponto registrado. Use número e PIN.'},
 it:{open:'Scansiona QR dipendente',help:'Mostra il QR alla fotocamera del tablet. La timbratura QR richiede ancora la verifica del server. Restano disponibili matricola e PIN.',title:'Leggi carta QR',scanning:'Fotocamera attiva · mostra il QR',close:'Chiudi fotocamera',unsupported:'Scansione QR non disponibile. Usa matricola e PIN.',camera:'Fotocamera non disponibile o accesso negato. Usa matricola e PIN.',decode:'Scansione QR interrotta. Usa matricola e PIN.',expired:'Scansione terminata dopo 30 secondi. Usa il PIN.',read:'QR rilevato ma non autenticato. Nessuna timbratura registrata. Usa matricola e PIN.'},
 de:{open:'Mitarbeiter-QR scannen',help:'QR-Karte vor die Tablet-Kamera halten. QR-Stempeln benötigt noch die Serverprüfung. Personalnummer und PIN bleiben verfügbar.',title:'QR-Karte lesen',scanning:'Kamera aktiv · QR zeigen',close:'Kamera schließen',unsupported:'QR-Lesen nicht verfügbar. Personalnummer und PIN verwenden.',camera:'Kamera nicht verfügbar oder Zugriff verweigert. Personalnummer und PIN verwenden.',decode:'QR-Lesen unterbrochen. Personalnummer und PIN verwenden.',expired:'Scan nach 30 Sekunden beendet. PIN verwenden.',read:'QR erkannt, aber nicht authentifiziert. Keine Zeit erfasst. Personalnummer und PIN verwenden.'},
 ar:{open:'مسح رمز QR للموظف',help:'اعرض بطاقة QR أمام كاميرا الجهاز. يتطلب تسجيل الوقت بالرمز تحقق الخادم. رقم الموظف والرمز السري متاحان.',title:'قراءة بطاقة QR',scanning:'الكاميرا تعمل · اعرض رمز QR',close:'إغلاق الكاميرا',unsupported:'مسح QR غير مدعوم. استخدم الرقم والرمز السري.',camera:'الكاميرا غير متاحة أو تم رفض الإذن. استخدم الرقم والرمز السري.',decode:'توقفت قراءة QR. استخدم الرقم والرمز السري.',expired:'توقفت القراءة بعد 30 ثانية. استخدم الرمز السري.',read:'تم اكتشاف QR دون التحقق من الهوية. لم يُسجل أي دوام. استخدم الرقم والرمز السري.'},
 zh:{open:'扫描员工二维码',help:'请将员工二维码出示给平板摄像头。二维码打卡仍需服务器验证，也可使用员工编号和 PIN。',title:'读取二维码',scanning:'摄像头已开启 · 请对准二维码',close:'关闭摄像头',unsupported:'浏览器不支持二维码扫描。请使用员工编号和 PIN。',camera:'摄像头不可用或权限被拒。请使用员工编号和 PIN。',decode:'扫描已中断。请使用员工编号和 PIN。',expired:'扫描已在 30 秒后停止。请使用 PIN。',read:'已识别二维码，但尚未完成身份验证；未记录打卡。请使用员工编号和 PIN。'},
 hi:{open:'कर्मचारी QR कार्ड स्कैन करें',help:'टैबलेट कैमरे पर QR कार्ड दिखाएँ। QR पंच के लिए सर्वर सत्यापन अभी आवश्यक है। कर्मचारी नंबर और PIN उपलब्ध हैं।',title:'QR कार्ड पढ़ें',scanning:'कैमरा चालू · QR दिखाएँ',close:'कैमरा बंद करें',unsupported:'इस ब्राउज़र में QR स्कैन उपलब्ध नहीं। नंबर और PIN उपयोग करें।',camera:'कैमरा उपलब्ध नहीं या अनुमति नहीं। नंबर और PIN उपयोग करें।',decode:'QR स्कैन रुका। नंबर और PIN उपयोग करें।',expired:'30 सेकंड बाद स्कैन बंद। PIN उपयोग करें।',read:'QR मिला लेकिन पहचान सत्यापित नहीं। कोई पंच दर्ज नहीं हुआ। नंबर और PIN उपयोग करें।'},
 tl:{open:'I-scan ang employee QR card',help:'Ipakita ang QR card sa camera ng tablet. Kailangan pa ng server verification para mag-punch gamit ang QR. Puwede pa ring employee number at PIN.',title:'Basahin ang QR card',scanning:'Aktibo ang camera · itapat ang QR',close:'Isara ang camera',unsupported:'Walang QR scan sa browser na ito. Gamitin ang number at PIN.',camera:'Hindi available ang camera o walang pahintulot. Gamitin ang number at PIN.',decode:'Nahinto ang QR scan. Gamitin ang number at PIN.',expired:'Nahinto ang scan pagkalipas ng 30 segundo. Gamitin ang PIN.',read:'Nakita ang QR pero hindi na-authenticate. Walang punch na naitala. Gamitin ang number at PIN.'}
});
export const kioskQrText=(language,key)=>(kioskQrCopy[language]||kioskQrCopy.en)[key]||kioskQrCopy.en[key]||'';

// Ignore unrelated QR codes (URLs, payment QRs, contact cards, old/future
// formats). This is only a local protocol-shape check, NOT authentication.
// Even a correctly shaped QR must never expose its content or trigger a punch.
const looksLikeEmployeeCard=code=>code?.format==='qr_code'
 && typeof code.rawValue==='string' && /^P360C1\.[0-9a-f]{64}$/.test(code.rawValue);

// Never expose the raw QR text via callbacks; recognizing a QR is NOT an identity check.
export function createKioskQrCamera({mediaDevices,BarcodeDetector,notify,schedule=callback=>setTimeout(callback,180),cancel=clearTimeout,expire=callback=>setTimeout(callback,30000),cancelExpire=clearTimeout,now=()=>Date.now()}={}){
 let generation=0,stream=null,video=null,detector=null,timer=null,expirationTimer=null,active=false;
 let detachTrackListeners=null;
 let started=0;
 const stopTracks=media=>{for(const track of media?.getTracks?.()||[])try{track.stop()}catch{}};
 function stop(){
  generation++;active=false;
  if(timer!==null){cancel(timer);timer=null;}
  if(expirationTimer!==null){cancelExpire(expirationTimer);expirationTimer=null;}
  // Detach before stopping tracks: any late hardware-ended callbacks must
  // never affect a new camera session on the same shared tablet.
  const detach=detachTrackListeners;detachTrackListeners=null;
  try{detach?.()}catch{}
  const oldVideo=video,oldStream=stream;video=null;stream=null;detector=null;
  try{oldVideo?.pause?.()}catch{}
  if(oldVideo)try{oldVideo.srcObject=null}catch{}
  stopTracks(oldStream);
 }
 async function start(element){
  stop();const token=generation;
  if(!element||!mediaDevices?.getUserMedia||typeof BarcodeDetector!=='function'){
   notify?.('unsupported');return false;
  }
  let reader;
  try{reader=new BarcodeDetector({formats:['qr_code']});}
  catch{notify?.('unsupported');return false;}
  // Bound the WHOLE camera attempt: permissions and video.play() may remain
  // unresolved indefinitely. If media arrives after expiry, release it
  // immediately instead of reviving a discarded shared-tablet session.
  started=now();
  expirationTimer=expire(()=>{if(token!==generation)return;stop();notify?.('expired');});
  let acquired;
  try{
   acquired=await mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
   if(token!==generation){stopTracks(acquired);return false;}
   stream=acquired;video=element;detector=reader;video.srcObject=acquired;
   await video.play?.();
   if(token!==generation)return false;
   active=true;
   // A camera can disappear while scanning (device unplugged, permission
   // withdrawn, OS interruption). Stop the whole preview immediately and
   // detach all listeners on every close/restart, without exposing QR data.
   const tracks=acquired.getTracks?.()||[];
   const onEnded=()=>{if(token!==generation||!active)return;stop();notify?.('camera');};
   for(const track of tracks)try{track.addEventListener?.('ended',onEnded)}catch{}
   detachTrackListeners=()=>{for(const track of tracks)try{track.removeEventListener?.('ended',onEnded)}catch{}};
   // The startup watchdog remains active during decoding, including when
   // BarcodeDetector.detect() never resolves.
   const scan=async()=>{
    if(!active||token!==generation)return;
    if(now()-started>=30000){stop();notify?.('expired');return;}
    try{
     const codes=await reader.detect(element);
     if(token!==generation||!active)return;
     if(Array.isArray(codes)&&codes.some(looksLikeEmployeeCard)){
      stop();notify?.('read');return;
     }
    }catch{if(token===generation){stop();notify?.('decode');}return;}
    if(token===generation&&active)timer=schedule(scan);
   };
   timer=schedule(scan);return true;
  }catch{
   if(token!==generation){if(acquired&&acquired!==stream)stopTracks(acquired);return false;}
   stop();notify?.('camera');return false;
  }
 }
 return {start,stop,get active(){return active;}};
}
