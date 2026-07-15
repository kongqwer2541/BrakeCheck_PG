-- BrakeCheck database schema
-- Step 2: First database tables
--
-- Beginner note:
-- A database is where the program stores data permanently.
-- A table is like one Excel sheet inside the database.
-- A row is one record, such as one user or one production Lot.

CREATE DATABASE IF NOT EXISTS brakecheck
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE brakecheck;

-- users
-- Stores QC users who can log in to the system.
-- Important security rule: never store the real password.
-- Store only password_hash, which is a one-way encrypted value.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  position VARCHAR(100) NOT NULL,
  role ENUM('head', 'assistant', 'officer') NOT NULL DEFAULT 'officer',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count TINYINT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- auth_sessions
-- Stores login sessions so logout can immediately revoke an issued token.
-- Revoked rows are retained for security traceability.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_id CHAR(36) NOT NULL UNIQUE,
  user_id INT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at)
);

-- user_audit_logs
-- Stores important user-management actions for security review.
-- This is not login/logout logging. It only records changes made in module 2.
CREATE TABLE IF NOT EXISTS user_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  target_user_id INT NULL,
  action ENUM('create_user', 'update_user', 'reset_password') NOT NULL,
  detail TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_user_audit_target
    FOREIGN KEY (target_user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- excel_import_batches
-- Stores one upload history row each time a user confirms an Excel import.
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

-- lots
-- Stores production Lot data imported from Excel or entered manually.
-- lot_number comes from Excel column A and is unique.
-- lot_pack_barcode comes from Excel column R. It can repeat because one Lot Pack can contain many Lots.
-- lot_packing comes from Excel column X and is used for packing/sticker checks.
CREATE TABLE IF NOT EXISTS lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_number VARCHAR(20) NOT NULL UNIQUE,
  lot_pack_barcode VARCHAR(50) NULL,
  lot_packing VARCHAR(50) NULL,
  model_name VARCHAR(200) NULL,
  dimension VARCHAR(100) NULL,
  aci_grade VARCHAR(20) NULL,
  code VARCHAR(20) NULL,
  purchase_order VARCHAR(50) NULL,
  drill_size DECIMAL(6,2) NULL,
  bore_size DECIMAL(6,2) NULL,
  rivet_no VARCHAR(50) NULL,
  production_date DATE NULL,
  quantity INT NOT NULL DEFAULT 0,
  sample_count INT NOT NULL DEFAULT 0,
  remark1 TEXT NULL,
  remark2 TEXT NULL,
  remark3 TEXT NULL,
  manual_reason TEXT NULL,
  status ENUM(
    'pending',
    'temp',
    'waiting_pack',
    'waiting_approve',
    'need_fix',
    'approved',
    'ng',
    'void'
  ) NOT NULL DEFAULT 'pending',
  imported_by INT NULL,
  import_batch_id INT NULL,
  import_source ENUM('excel', 'manual') NOT NULL DEFAULT 'excel',
  voided_by INT NULL,
  voided_at DATETIME NULL,
  void_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lots_imported_by
    FOREIGN KEY (imported_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_lots_import_batch
    FOREIGN KEY (import_batch_id) REFERENCES excel_import_batches(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_lots_voided_by
    FOREIGN KEY (voided_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- lot_audit_logs
-- Stores edit and void history for traceability without hard deleting Lot data.
CREATE TABLE IF NOT EXISTS lot_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_id INT NOT NULL,
  action ENUM('edit', 'void', 'approve', 'cancel_approve', 'send_back', 'review_ng', 'confirm_ng', 'upload_attachment', 'delete_attachment') NOT NULL,
  reason TEXT NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  changed_by INT NULL,
  actor_name_snapshot VARCHAR(200) NULL,
  actor_position_snapshot VARCHAR(100) NULL,
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

-- lot_attachments
-- Stores file attachment metadata tied to Lot records. Files live under storage/attachments.
CREATE TABLE IF NOT EXISTS lot_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  uploaded_by INT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_by INT NULL,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_lot_attachments_lot
    FOREIGN KEY (lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_lot_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_lot_attachments_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  UNIQUE KEY uq_lot_attachments_stored_name (stored_name),
  INDEX idx_lot_attachments_lot_active (lot_id, deleted_at)
);

-- sampling_rules
-- Stores rules for calculating how many pieces QC must inspect.
-- Example: quantity 2-100 means sample_count = 2.
CREATE TABLE IF NOT EXISTS sampling_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  qty_min INT NOT NULL,
  qty_max INT NULL,
  sample_count INT NOT NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sampling_rules_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_sampling_qty_min CHECK (qty_min >= 0),
  CONSTRAINT chk_sampling_qty_max CHECK (qty_max IS NULL OR qty_max >= qty_min),
  CONSTRAINT chk_sampling_sample_count CHECK (sample_count > 0)
);

-- dimension_instrument_prefixes
-- Stores the current allowed prefix for the 5 dimension inspection instrument fields.
CREATE TABLE IF NOT EXISTS dimension_instrument_prefixes (
  slot_no TINYINT NOT NULL PRIMARY KEY,
  prefix VARCHAR(20) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_dimension_instrument_prefixes_slot CHECK (slot_no BETWEEN 1 AND 5),
  CONSTRAINT chk_dimension_instrument_prefixes_prefix CHECK (prefix REGEXP '^A-[0-9]{2}-$')
);

-- form_config
-- Stores dynamic form topics for dimension inspection and packing inspection.
-- This lets QC leaders adjust inspection topics without changing code.
CREATE TABLE IF NOT EXISTS form_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_type ENUM('dimension', 'packing') NOT NULL,
  topic_name VARCHAR(200) NOT NULL,
  input_count TINYINT NOT NULL DEFAULT 1,
  decimal_places TINYINT NOT NULL DEFAULT 0,
  input_type ENUM('number', 'pass_fail') NOT NULL,
  measure_pieces VARCHAR(50) NOT NULL DEFAULT 'all',
  rule_key VARCHAR(80) NULL,
  display_order TINYINT NOT NULL DEFAULT 1,
  remark TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_form_config_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_form_input_count CHECK (input_count > 0),
  CONSTRAINT chk_form_decimal_places CHECK (decimal_places BETWEEN 0 AND 3)
);

-- system_setting_audit_logs
-- Stores history for System Settings changes without tying them to one Lot.
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

-- dimension_inspections
-- Stores one dimension inspection header per Lot.
-- Completed rows keep snapshots so old records do not change when form settings change later.
CREATE TABLE IF NOT EXISTS dimension_inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lot_id INT NOT NULL,
  status ENUM('draft', 'completed') NOT NULL DEFAULT 'draft',
  inspection_date DATE NULL,
  shift ENUM('1', '2') NULL,
  instrument_codes JSON NULL,
  rivet_no VARCHAR(50) NULL,
  production_code VARCHAR(50) NULL,
  brake_type ENUM('normal', 'taper', 'sheet') NULL,
  brake_model ENUM('drilled_bored', 'no_hole') NULL,
  rivet_hole_thickness DECIMAL(3,1) NULL,
  sample_count INT NULL,
  form_config_snapshot JSON NULL,
  pieces_data JSON NULL,
  created_by INT NULL,
  updated_by INT NULL,
  completed_by INT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_dimension_inspections_lot UNIQUE (lot_id),
  CONSTRAINT fk_dimension_inspections_lot
    FOREIGN KEY (lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_dimension_inspections_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_dimension_inspections_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_dimension_inspections_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_dimension_sample_count CHECK (sample_count IS NULL OR sample_count > 0)
);

-- packing_inspections
-- Stores one packing inspection header per Lot.
-- Completed rows keep snapshots so old records do not change when form settings change later.
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

-- dimension_inspection_values
-- Prepared for detailed measured values. Step 8.2 stores JSON snapshots first.
CREATE TABLE IF NOT EXISTS dimension_inspection_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT NOT NULL,
  topic_config_id INT NULL,
  topic_name VARCHAR(200) NOT NULL,
  piece_no INT NOT NULL,
  input_index TINYINT NOT NULL,
  numeric_value DECIMAL(12,3) NULL,
  pass_fail_value ENUM('pass', 'fail') NULL,
  raw_value VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dimension_values_inspection
    FOREIGN KEY (inspection_id) REFERENCES dimension_inspections(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_dimension_values_topic_config
    FOREIGN KEY (topic_config_id) REFERENCES form_config(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_dimension_values_piece_no CHECK (piece_no > 0),
  CONSTRAINT chk_dimension_values_input_index CHECK (input_index > 0)
);

-- Indexes help MySQL search faster when the table becomes large.
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_model_name ON lots(model_name);
CREATE INDEX idx_lots_production_date ON lots(production_date);
CREATE INDEX idx_lots_lot_pack_barcode ON lots(lot_pack_barcode);
CREATE INDEX idx_lots_lot_packing ON lots(lot_packing);
CREATE INDEX idx_form_config_type_active ON form_config(form_type, is_active);
CREATE INDEX idx_dimension_inspections_status ON dimension_inspections(status);
CREATE INDEX idx_packing_inspections_status ON packing_inspections(status);
CREATE INDEX idx_dimension_inspection_values_inspection ON dimension_inspection_values(inspection_id);
