-- Step 9 migration: Packing inspection form
-- Safe note:
-- This file creates a new table and updates default packing form topics.
-- Do not run this against a real factory database until a backup is created.

USE brakecheck;

CREATE TABLE IF NOT EXISTS packing_inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_id INT NOT NULL,
  status ENUM('draft', 'completed') NOT NULL DEFAULT 'draft',
  inspection_date DATE NULL,
  form_config_snapshot JSON NULL,
  results_data JSON NULL,
  created_by INT NULL,
  updated_by INT NULL,
  completed_by INT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_packing_inspections_status (status),
  CONSTRAINT uq_packing_inspections_lot UNIQUE (lot_id),
  CONSTRAINT fk_packing_inspections_lot
    FOREIGN KEY (lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_packing_inspections_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_packing_inspections_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_packing_inspections_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- Older Step 9 drafts used ids 1-5 for packing topics.
-- Keep the rows for history, but disable them so the packing form shows only ids 201-205.
UPDATE form_config
SET is_active = FALSE
WHERE form_type = 'packing'
  AND id IN (1, 2, 3, 4, 5);

INSERT INTO form_config (
  id,
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
VALUES
  (201, 'packing', 'เงื่อนไขการบรรจุ', 1, 0, 'pass_fail', 'all', 1, 'ข้อกำหนดผลิตภัณฑ์ / ตาม Drawing รุ่นนั้นๆ'),
  (202, 'packing', 'ความถูกต้องของสินค้า / ชี้บ่ง / เลเซอร์ / ปั้มรหัส', 1, 0, 'pass_fail', 'all', 2, 'ข้อกำหนดผลิตภัณฑ์ / ตาม Drawing รุ่นนั้นๆ'),
  (203, 'packing', 'จำนวนชิ้น / ชุด', 1, 0, 'pass_fail', 'all', 3, 'ตาม Drawing / ข้อกำหนดมาตรฐานผลิตภัณฑ์ผ้าเบรก'),
  (204, 'packing', 'สภาพทั่วไป', 1, 0, 'pass_fail', 'all', 4, 'ข้อกำหนดเกณฑ์การตรวจสอบสภาพทั่วไปของผลิตภัณฑ์ผ้าเบรก'),
  (205, 'packing', 'สรุปผลการตรวจบรรจุ', 1, 0, 'pass_fail', 'all', 5, 'ลงชื่อผู้ตรวจ + วันที่อัตโนมัติ')
ON DUPLICATE KEY UPDATE
  form_type = VALUES(form_type),
  topic_name = VALUES(topic_name),
  input_count = VALUES(input_count),
  decimal_places = VALUES(decimal_places),
  input_type = VALUES(input_type),
  measure_pieces = VALUES(measure_pieces),
  display_order = VALUES(display_order),
  remark = VALUES(remark),
  is_active = TRUE;
