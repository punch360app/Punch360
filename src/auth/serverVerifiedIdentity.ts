import type {Session,User} from '@supabase/supabase-js';

/**
 * The cached session user is not the authority for company membership.
 * Require a fresh Supabase Auth getUser(access_token) response for the
 * exact same identity before querying RLS memberships or caching a workspace.
 */
export function requireServerVerifiedIdentity(
 session:Session|null|undefined,
 verified:{data:{user:User|null}|null;error:unknown}
):User{
 const local=session?.user?.id,remote=verified?.data?.user?.id;
 if(typeof session?.access_token!=='string'||!session.access_token||
    typeof local!=='string'||!local||
    verified?.error||typeof remote!=='string'||!remote||remote!==local)
  throw Error('AUTH_SERVER_IDENTITY_UNVERIFIED');
 return verified.data!.user!;
}
