-- Step 10.1.1 audit actor snapshot
-- Stores the actor name and position at the time the audit log is created.
-- Backup the database before running this migration on real production data.

ALTER TABLE lot_audit_logs
  ADD COLUMN actor_name_snapshot VARCHAR(200) NULL AFTER changed_by,
  ADD COLUMN actor_position_snapshot VARCHAR(100) NULL AFTER actor_name_snapshot;
