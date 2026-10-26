-- Audit de posture : archives d'entreprise et PDF prives.
-- Lecture seule: aucune entreprise, session, cle ni fichier n'est cree ou modifie.
-- Executer sur le projet officiel apres revue; toute anomalie leve une exception.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';

DO $audit$
DECLARE
  item text;
  table_oid oid;
  table_rls boolean;
  function_oid oid;
  fn record;
  bucket_count integer;
  audited_functions integer := 0;
BEGIN
  -- Aucune lecture/ecriture de tables internes depuis anon/authenticated.
  FOREACH item IN ARRAY ARRAY[
    'company_archive_keys', 'company_exports',
    'company_restore_context', 'company_restore_runs'
  ] LOOP
    SELECT c.oid, c.relrowsecurity
      INTO table_oid, table_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'private' AND c.relname = item AND c.relkind = 'r';

    IF table_oid IS NULL OR table_rls IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Archive private table missing or RLS disabled: %', item;
    END IF;

    IF has_table_privilege('anon', table_oid, 'SELECT')
       OR has_table_privilege('anon', table_oid, 'INSERT')
       OR has_table_privilege('anon', table_oid, 'UPDATE')
       OR has_table_privilege('anon', table_oid, 'DELETE')
       OR has_table_privilege('authenticated', table_oid, 'SELECT')
       OR has_table_privilege('authenticated', table_oid, 'INSERT')
       OR has_table_privilege('authenticated', table_oid, 'UPDATE')
       OR has_table_privilege('authenticated', table_oid, 'DELETE') THEN
      RAISE EXCEPTION 'Unexpected browser role grant on private archive table: %', item;
    END IF;
  END LOOP;

  -- Toute fonction export/import/restore reste refusee a anon et PUBLIC.
  -- Les fonctions de support privees sont aussi refusees aux utilisateurs.
  FOR fn IN
    SELECT p.oid, p.proname, n.nspname AS schema_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('private','public')
       AND (p.proname LIKE 'company_archive%'
         OR p.proname LIKE 'company_export%'
         OR p.proname LIKE 'company_restore%')
  LOOP
    audited_functions := audited_functions + 1;
    IF has_function_privilege('anon', fn.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1
           FROM aclexplode(COALESCE(
             (SELECT proacl FROM pg_proc WHERE oid = fn.oid),
             acldefault('f', (SELECT proowner FROM pg_proc WHERE oid = fn.oid))
           )) grant_row
          WHERE grant_row.grantee = 0 AND grant_row.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'Public/anon archive RPC execution grant: %.%',
        fn.schema_name, fn.proname;
    END IF;

    IF fn.schema_name = 'private'
       AND has_function_privilege('authenticated', fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated role can call internal archive function: %',
        fn.proname;
    END IF;
  END LOOP;

  IF audited_functions < 20 THEN
    RAISE EXCEPTION 'Archive RPC inventory unexpectedly reduced: %',
      audited_functions;
  END IF;

  -- Ces routines sensibles dans public sont reservees aux services internes.
  FOREACH item IN ARRAY ARRAY[
    'public.company_archive_file_proof(uuid,uuid,text,text,text,text)',
    'public.company_archive_file_restored(uuid,uuid,text,text,text,text)'
  ] LOOP
    function_oid := to_regprocedure(item);
    IF function_oid IS NULL
       OR has_function_privilege('authenticated', function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Server-only archive proof was exposed or removed: %', item;
    END IF;
  END LOOP;

  -- Les deux buckets essentiels conservent leur mode prive.
  SELECT COUNT(*) INTO bucket_count
    FROM storage.buckets
   WHERE id IN ('essential-hr', 'job-documents') AND public IS FALSE;
  IF bucket_count <> 2 THEN
    RAISE EXCEPTION 'Essential HR/job document storage bucket is missing or public';
  END IF;

  -- Le cycle de purge ne doit pas disparaitre en silence.
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
     WHERE jobname = 'punch-expired-company-exports'
       AND active AND schedule = '*/15 * * * *'
  ) THEN
    RAISE EXCEPTION 'Archive temporary export cleanup cron missing/inactive';
  END IF;

  RAISE NOTICE 'PASS: 4 private tables RLS/grants; % RPC; 2 private buckets; cleanup cron',
    audited_functions;
END
$audit$;

ROLLBACK;
