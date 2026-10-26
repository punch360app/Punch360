import {ESSENTIAL_LANGUAGES,LOCALE_STRINGS} from '../../web/live/essential-locale.js';
export const nativeEssentialLanguages=ESSENTIAL_LANGUAGES;
const codes=new Set(ESSENTIAL_LANGUAGES.map(x=>x.code));
export function validateNativeLocale(code){return codes.has(code)?code:'fr';}
export function nativeEssentialText(code,key){const lang=validateNativeLocale(code);return LOCALE_STRINGS[lang]?.[key]??LOCALE_STRINGS.fr[key]??key;}
export function nativeLocaleDirection(code){return validateNativeLocale(code)==='ar'?'rtl':'ltr';}
export function nativeLocaleKey(userId){return 'punch-locale:'+String(userId);}
export async function readNativeLocale(storage,userId){
 if(!userId)return 'fr';
 try{return validateNativeLocale(await storage.getItem(nativeLocaleKey(userId)));}
 catch{return 'fr';}
}
export async function writeNativeLocale(storage,userId,code){
 const valid=validateNativeLocale(code);
 if(userId)await storage.setItem(nativeLocaleKey(userId),valid);
 return valid;
}
export const nativeManagementKeys=Object.freeze({
 home:'overview',members:'employees',organization:'organization',breakPolicies:'breakPolicies',
 kiosks:'kiosks',supervision:'teamApprovals',missingDays:'missingDays',
 breakCorrections:'breakCorrections',hr:'hrDocuments',support:'support',
 communications:'communications',payroll:'payroll',laborBudgets:'laborBudgets',
 qualifiedCoverage:'qualifiedCoverage',bossHandoff:'bossHandoff',
 schedule:'planning',workforce:'workforce',geofence:'geofence',invite:'invitations',
 messages:'messages',billing:'billing',punch:'punchAccess',admin:'constructionJobs',teams:'teams'
});
export function nativeManagementLabel(code,id,fallback){const key=nativeManagementKeys[id];return key?nativeEssentialText(code,key):fallback;}
