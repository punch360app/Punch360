/** Prevent delayed native offline reads from reviving a workspace after logout.
 * The Auth revision invalidates old requests when the session changes;
 * an explicit SIGNED_OUT event also blocks newly scheduled offline reads
 * until a fresh non-signout Auth event restarts verification.
 */
export function mayRestoreCachedWorkspace(requestRevision:number,currentRevision:number,explicitlySignedOut:boolean):boolean{
 return requestRevision===currentRevision&&!explicitlySignedOut;
}

/** A logout cannot be undone by a delayed bootstrap or token-refresh event.
 * A new explicit sign-in or password-recovery event must include a session;
 * that session is subsequently verified against Supabase Auth by refresh().
 */
export function canResumeAfterExplicitSignOut(event:string,hasSession:boolean):boolean{
 return hasSession&&(event==='SIGNED_IN'||event==='PASSWORD_RECOVERY');
}
