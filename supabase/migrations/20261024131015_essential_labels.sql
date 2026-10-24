do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.punch_with_location(uuid,text,uuid,double precision,double precision,double precision)'::regprocedure) into definition;
 if position($old$'Punch à valider — #'||j.number$old$ in definition)=0 then raise exception 'Unexpected punch function definition';end if;
 definition:=replace(definition,$old$'Punch à valider — #'||j.number$old$,$new$case when exists(select 1 from public.companies c where c.id=p_company and c.product_edition='essential') then 'Punch à valider' else 'Punch à valider — #'||j.number end$new$);
 definition:=replace(definition,'Coordonnées du chantier à configurer.','Coordonnées de l’établissement à configurer.');
 execute definition;
end $patch$;
