import {createOfflineKioskHandler} from './handler.mjs';
// Device token + successful online personal PIN for issuance; signed proof for replay.
Deno.serve(createOfflineKioskHandler({env:(name:string)=>Deno.env.get(name)}));
