/** Prevent delayed native offline reads from reviving a workspace after logout.
 * The Auth revision invalidates old requests when the session changes;
 * an explicit SIGNED_OUT event also blocks newly scheduled offline reads
 * until a fresh non-signout Auth event restarts verification.
 */
export function mayRestoreCachedWorkspace(requestRevision:number,currentRevision:number,explicitlySignedOut:boolean):boolean{
 return requestRevision===currentRevision&&!explicitlySignedOut;
}
