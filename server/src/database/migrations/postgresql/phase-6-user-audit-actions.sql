-- BrakeCheck Phase 6: allow password changes in the user audit history.
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

  IF to_regclass('public.user_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Required table public.user_audit_logs is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_audit_action'
      AND conrelid = 'public.user_audit_logs'::regclass
  ) THEN
    RAISE EXCEPTION 'Required constraint chk_user_audit_action is missing.';
  END IF;
END;
$migration_guard$;

ALTER TABLE public.user_audit_logs
  DROP CONSTRAINT chk_user_audit_action;

ALTER TABLE public.user_audit_logs
  ADD CONSTRAINT chk_user_audit_action
  CHECK (action IN ('create_user', 'update_user', 'reset_password', 'change_password'));

COMMIT;
