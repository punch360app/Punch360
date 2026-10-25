begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();promo_id uuid:=gen_random_uuid();other uuid:=gen_random_uuid();values_json jsonb;v integer;denied boolean;ctx jsonb;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 values_json:=jsonb_build_object('code','FIX'||replace(promo_id::text,'-',''),'mode','test','percent_off',20,'duration','repeating','duration_months',3,'max_redemptions',10,'first_transaction',true);
 values_json:=jsonb_set(values_json,'{code}',to_jsonb(left(values_json->>'code',30)));
 execute 'set local role authenticated';
 perform public.platform_create_promotion(promo_id,values_json,'Test transactionnel');perform public.platform_create_promotion(promo_id,values_json,'Test transactionnel');
 denied:=false;begin perform public.platform_create_promotion(other,values_json||'{"code":"INVALIDE","duration_months":null}','Test null');exception when check_violation then denied:=true;end;if not denied then raise exception 'Null repeating duration accepted';end if;
 denied:=false;begin perform public.platform_begin_promotion(promo_id,'publish',1,'Publication','live');exception when others then denied:=true;end;if not denied then raise exception 'Wrong key mode accepted';end if;
 perform public.platform_begin_promotion(promo_id,'publish',1,'Publication','test');perform public.platform_begin_promotion(promo_id,'publish',1,'Reprise','test');
 denied:=false;begin perform public.platform_begin_promotion(promo_id,'disable',1,'Désactivation concurrente','test');exception when others then denied:=true;end;if not denied then raise exception 'Concurrent actions allowed';end if;
 denied:=false;begin perform public.platform_promotion_context(owner_id,promo_id,'publish');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client service RPC exposed';end if;
 execute 'reset role';ctx:=public.platform_promotion_context(owner_id,promo_id,'publish');if ctx->>'code'<>upper(values_json->>'code') then raise exception 'Wrong operation context';end if;
 denied:=false;begin perform public.platform_complete_promotion(owner_id,promo_id,'publish',null,'STRIPE_429_rate_limit');exception when others then denied:=true;end;if not denied then raise exception 'Uncertain operation unlocked';end if;
 perform public.platform_complete_promotion(owner_id,promo_id,'publish','{"mode":"test","promotion_id":"promo_fixture","coupon_id":"coupon_fixture","active":true,"times_redeemed":0}');
 select version into v from private.platform_promotions where platform_promotions.id=promo_id;
 execute 'set local role authenticated';if public.platform_begin_promotion(promo_id,'publish',1,'Reprise après confirmation','test') then raise exception 'Completed publication reserved twice';end if;perform public.platform_begin_promotion(promo_id,'disable',v,'Fin de campagne','test');execute 'reset role';
 perform public.platform_complete_promotion(owner_id,promo_id,'disable','{"mode":"test","promotion_id":"promo_fixture","active":false,"times_redeemed":2}');
 if not exists(select 1 from private.platform_promotions p where p.id=promo_id and status='disabled' and times_redeemed=2) then raise exception 'Disable not confirmed';end if;
 delete from auth.sessions where auth.sessions.id=sid;execute 'set local role authenticated';
 denied:=false;begin perform public.platform_list_promotions();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked session read discounts';end if;execute 'reset role';
end $$;
rollback;
