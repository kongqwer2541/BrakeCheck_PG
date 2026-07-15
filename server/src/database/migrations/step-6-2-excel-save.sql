-- Step 6.2 migration: Save Excel import data
-- This migration is safe to run more than once.
-- It adds Lot Pack barcode support and upload history.

USE brakecheck;

DELIMITER $$

CREATE PROCEDURE brakecheck_step_6_2_excel_save()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'lot_pack_barcode'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN lot_pack_barcode VARCHAR(50) NULL AFTER lot_number;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE lots
      ADD COLUMN import_batch_id INT NULL AFTER imported_by;
  END IF;

  CREATE TABLE IF NOT EXISTS excel_import_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_file_name VARCHAR(255) NOT NULL,
    file_hash CHAR(64) NOT NULL,
    file_size INT NOT NULL,
    sheet_name VARCHAR(100) NOT NULL DEFAULT 'DATA',
    production_dates JSON NULL,
    total_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    uploaded_by INT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_excel_import_batches_uploaded_by
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  );

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND index_name = 'idx_lots_lot_pack_barcode'
  ) THEN
    CREATE INDEX idx_lots_lot_pack_barcode ON lots(lot_pack_barcode);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'lots'
      AND constraint_name = 'fk_lots_import_batch'
  ) THEN
    ALTER TABLE lots
      ADD CONSTRAINT fk_lots_import_batch
        FOREIGN KEY (import_batch_id) REFERENCES excel_import_batches(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END$$

DELIMITER ;

CALL brakecheck_step_6_2_excel_save();
DROP PROCEDURE brakecheck_step_6_2_excel_save;
