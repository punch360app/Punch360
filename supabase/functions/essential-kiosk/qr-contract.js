// Proposed V1 QR request boundary for the shared Essentiel tablet.
// This module never authorizes a punch. The database transaction, revocable
// credential lookup, independent PIN verification and event locks are NOT
// implemented here. See docs/KIOSK_QR_SERVER_CONTRACT.md before integration.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_SECRET=/^[0-9a-f]{64}$/i;
const CARD=/^P360C1\.[0-9a-f]{64}$/i;
const PIN=/^[0-9]{6,12}$/;
const PUNCH_ACTIONS=new Set(['in','out','break_start','break_start_paid','break_end']);
const IDENTIFY_KEYS=new Set(['action','deviceId','token','cardCode','pin']);
const EXECUTE_KEYS=new Set([...IDENTIFY_KEYS,'eventId','eventAction']);
const exactKeys=(value,allowed)=>Object.keys(value).every(k=>allowed.has(k));

/** Parse shape ONLY. QR and PIN are secrets: do not log, return, cache or
 * persist request data from this check. The only safe result is a boolean and
 * operation metadata; never treat "ok" as identity verification.
 */
export function parseKioskQrEnvelope(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false};
 const identify=value.action==='qr_identify';
 const execute=value.action==='qr_execute';
 if(!identify&&!execute)return {ok:false};
 if(!exactKeys(value,execute?EXECUTE_KEYS:IDENTIFY_KEYS))return {ok:false};
 if(typeof value.deviceId!=='string'||!UUID.test(value.deviceId)||
    typeof value.token!=='string'||!DEVICE_SECRET.test(value.token)||
    typeof value.cardCode!=='string'||!CARD.test(value.cardCode)||
    typeof value.pin!=='string'||!PIN.test(value.pin))return {ok:false};
 if(identify)return {ok:true,operation:'identify'};
 if(typeof value.eventId!=='string'||!UUID.test(value.eventId)||
    typeof value.eventAction!=='string'||!PUNCH_ACTIONS.has(value.eventAction))return {ok:false};
 return {ok:true,operation:'execute',eventAction:value.eventAction};
}

/** A precondition checklist from TRUSTED database evidence, never request
 * fields. Passing it is not a grant: the SQL function MUST recheck credential,
 * PIN, revocation, grants and idempotency atomically under row/advisory locks.
 */
export function checkKioskQrTrustedPreconditions(evidence){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return false;
 const required=[
  'devicePaired','deviceNotRevoked','deviceTokenMatched','deviceNotLocked',
  'siteEnabled','companyActiveForPunch','cardHashMatched','cardNotRevoked',
  'cardNotExpired','cardBoundToWorker','cardBoundToCompany',
  'phoneEnrollmentActive','workerActive','workerCanPunch','workerBelongsToCompany',
  'independentPinMatched','pinNotLocked'
 ];
 return required.every(key=>evidence[key]===true);
}

/** Exact sensitive request fields expected at the future HTTP boundary.
 * There is deliberately NO `enabled` override and no client-provided worker,
 * company, role or authorization claim.
 */
export const KIOSK_QR_REQUEST_ACTIONS=Object.freeze(['qr_identify','qr_execute']);
