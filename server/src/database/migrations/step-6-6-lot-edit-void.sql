-- Step 6.6 migration: Lot edit and void support
-- Safe to run more than once.

USE brakecheck;

DELIMITER $$

CREATE PROCEDURE brakecheck_step_6_6_lot_edit_void()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'voided_by'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN voided_by INT NULL AFTER import_source,
      ADD CONSTRAINT fk_lots_voided_by
        FOREIGN KEY (voided_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN voided_at DATETIME NULL AFTER voided_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN void_reason TEXT NULL AFTER voided_at;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'status'
      AND column_type NOT LIKE '%void%'
  ) THEN
    ALTER TABLE lots
      MODIFY COLUMN status ENUM(
        'pending',
        'temp',
        'waiting_pack',
        'waiting_approve',
        'need_fix',
        'approved',
        'ng',
        'void'
      ) NOT NULL DEFAULT 'pending';
  END IF;
END$$

DELIMITER ;

CALL brakecheck_step_6_6_lot_edit_void();
DROP PROCEDURE brakecheck_step_6_6_lot_edit_void;

CREATE TABLE IF NOT EXISTS lot_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_id INT NOT NULL,
  action ENUM('edit', 'void') NOT NULL,
  reason TEXT NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  changed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_audit_logs_lot
    FOREIGN KEY (lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_lot_audit_logs_changed_by
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);
