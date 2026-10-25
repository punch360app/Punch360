import {createPromotionHandler} from './handler.mjs';
Deno.serve(createPromotionHandler({env:(name:string)=>Deno.env.get(name)}));
