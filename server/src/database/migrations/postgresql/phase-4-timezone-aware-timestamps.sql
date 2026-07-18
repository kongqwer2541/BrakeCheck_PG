-- BrakeCheck Phase 4: convert an existing empty local/test schema to timezone-aware timestamps.
-- Run as a migration owner against brakecheck_pg only.

BEGIN;

DO $migration_guard$
DECLARE
  target_table TEXT;
  has_rows BOOLEAN;
BEGIN
  IF current_database() <> 'brakecheck_pg' THEN
    RAISE EXCEPTION 'Migration target must be brakecheck_pg, current database is %.', current_database();
  END IF;

  IF current_user = 'brakecheck_app' THEN
    RAISE EXCEPTION 'Run this migration as a migration owner, not brakecheck_app.';
  END IF;

  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'auth_sessions',
    'user_audit_logs',
    'excel_import_batches',
    'lots',
    'lot_audit_logs',
    'lot_attachments',
    'sampling_rules',
    'dimension_instrument_prefixes',
    'form_config',
    'system_setting_audit_logs',
    'dimension_inspections',
    'packing_inspections',
    'dimension_inspection_values'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% is missing.', target_table;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)',
      target_table
    ) INTO has_rows;

    IF has_rows THEN
      RAISE EXCEPTION 'Migration requires empty local/test tables; public.% contains data.', target_table;
    END IF;
  END LOOP;
END;
$migration_guard$;

ALTER TABLE public.users
  ALTER COLUMN locked_until TYPE TIMESTAMP WITH TIME ZONE USING locked_until AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.auth_sessions
  ALTER COLUMN expires_at TYPE TIMESTAMP WITH TIME ZONE USING expires_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN revoked_at TYPE TIMESTAMP WITH TIME ZONE USING revoked_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.user_audit_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.excel_import_batches
  ALTER COLUMN uploaded_at TYPE TIMESTAMP WITH TIME ZONE USING uploaded_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.lots
  ALTER COLUMN voided_at TYPE TIMESTAMP WITH TIME ZONE USING voided_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.lot_audit_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.lot_attachments
  ALTER COLUMN uploaded_at TYPE TIMESTAMP WITH TIME ZONE USING uploaded_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.sampling_rules
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.dimension_instrument_prefixes
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.form_config
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.system_setting_audit_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.dimension_inspections
  ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE USING completed_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.packing_inspections
  ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE USING completed_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.dimension_inspection_values
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'Asia/Bangkok';

COMMIT;
