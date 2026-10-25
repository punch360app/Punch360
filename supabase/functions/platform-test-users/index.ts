import {createPlatformTestHandler} from './handler.js';
Deno.serve(createPlatformTestHandler({env:(name:string)=>Deno.env.get(name)}));
