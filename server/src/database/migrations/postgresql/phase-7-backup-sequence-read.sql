-- BrakeCheck Phase 7: allow pg_dump to read identity sequence state.
-- Run as a migration owner against brakecheck_pg only.

BEGIN;

DO $migration_guard$
BEGIN
  IF current_database() <> 'brakecheck_pg' THEN
    RAISE EXCEPTION 'Migration target must be brakecheck_pg, current database is %.', current_database();
  END IF;

  IF current_user = 'brakecheck_app' THEN
    RAISE EXCEPTION 'Run this migration as a migration owner, not brakecheck_app.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'brakecheck_app'
  ) THEN
    RAISE EXCEPTION 'Required application role brakecheck_app does not exist.';
  END IF;

  IF to_regclass('public.auth_sessions_id_seq') IS NULL THEN
    RAISE EXCEPTION 'Required BrakeCheck identity sequences are missing.';
  END IF;
END;
$migration_guard$;

GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO brakecheck_app;

COMMIT;
