-- Step 12.1 System Settings foundation
-- Backup database before running this migration on a real factory database.

ALTER TABLE form_config
  ADD COLUMN rule_key VARCHAR(80) NULL AFTER measure_pieces;

UPDATE form_config
SET rule_key = 'hole_inspection'
WHERE form_type = 'dimension'
  AND topic_name LIKE CONCAT('%', CONVERT(UNHEX('E0B8A3E0B8B9E0B980E0B888E0B8B2E0B8B02FE0B8A3E0B8B9E0B884E0B8A7E0B989E0B8B2E0B899') USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%');

CREATE TABLE IF NOT EXISTS system_setting_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_area VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id INT NULL,
  reason TEXT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  changed_by INT NULL,
  actor_name_snapshot VARCHAR(200) NULL,
  actor_position_snapshot VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_setting_audit_logs_changed_by
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  INDEX idx_system_setting_audit_logs_area_created (setting_area, created_at)
);
