import {readFileSync} from 'node:fs';
const source=readFileSync('web/live/app.js','utf8');
const key=source.match(/const PUBLISHABLE='([^']+)'/)?.[1];
const project=source.match(/const PROJECT='([^']+)'/)?.[1];
if(!key||!project){console.log('OAuth diagnostic: public config not found');process.exit(0)}
try{
 const response=await fetch(project+'/auth/v1/settings',{headers:{apikey:key,accept:'application/json'},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('status '+response.status);
 const settings=await response.json();
 console.log('Google OAuth enabled in Supabase:',settings.external?.google===true);
 console.log('Apple OAuth enabled in Supabase:',settings.external?.apple===true);
 console.log('Note: enabled does not guarantee provider credentials and redirect allow list are valid; test an actual sign-in.');
}catch(err){console.log('OAuth provider status could not be checked:',err.message)}
