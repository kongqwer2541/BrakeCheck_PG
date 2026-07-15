-- Step 6.5 migration: Manual Lot input support
-- Safe to run more than once.

USE brakecheck;

DELIMITER $$

CREATE PROCEDURE brakecheck_step_6_5_manual_lot()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'import_source'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN import_source ENUM('excel', 'manual') NOT NULL DEFAULT 'excel' AFTER import_batch_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'manual_reason'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN manual_reason TEXT NULL AFTER remark3;
  END IF;
END$$

DELIMITER ;

CALL brakecheck_step_6_5_manual_lot();
DROP PROCEDURE brakecheck_step_6_5_manual_lot;
