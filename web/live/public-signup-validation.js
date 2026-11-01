// Client-side UX guard only. Supabase remains the authority on account policy.
// Never log, save, or include passwords in any public plan intent.
export function validatePublicSignupPassword(password,confirmation){
 if(typeof password!=='string'||password.length<8)return 'Choisis un mot de passe d’au moins 8 caractères.';
 if(typeof confirmation!=='string'||password!==confirmation)return 'Les mots de passe ne correspondent pas.';
 return null;
}
