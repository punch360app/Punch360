/** Shared, presentational permission and feedback contract for Super Admin screens.
 * The server remains responsible for AAL2, RLS, membership and audit authorization.
 */
export const PLATFORM_ACCESS_DENIED_MESSAGE='Accès expiré ou refusé. Reconnectez-vous avec MFA.';

export function isPlatformAuthorizationDenied(error){
  return error?.code==='42501'||error?.status===401||error?.status===403||
    error?.status==='401'||error?.status==='403';
}

export function platformSafeError(error,{fallback='Action impossible. Réessayez.',local=[]}={}){
  if(isPlatformAuthorizationDenied(error))return PLATFORM_ACCESS_DENIED_MESSAGE;
  if(typeof error?.message==='string'&&local.includes(error.message))return error.message;
  return fallback;
}

/** Accessible status before the protected list; no server diagnostics are interpolated. */
export function renderPlatformFeedback({error='',busy=false}={},escape){
  const e=escape||((value)=>String(value??''));
  return (error?'<p class="ess-notice" role="alert">'+e(error)+'</p>':'')+
    (busy?'<p class="ess-notice" role="status" aria-live="polite">Vérification en cours…</p>':'');
}
