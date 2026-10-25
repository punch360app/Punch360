import {createArchiveFilesHandler} from './handler.mjs';
Deno.serve(createArchiveFilesHandler({env:(name:string)=>Deno.env.get(name)}));
