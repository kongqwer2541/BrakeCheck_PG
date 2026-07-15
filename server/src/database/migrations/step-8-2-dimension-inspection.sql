-- Step 8.2 migration: Dimension inspection database tables
-- Safe to run more than once.

USE brakecheck;

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
  INDEX idx_dimension_inspections_status (status),
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
  INDEX idx_dimension_inspection_values_inspection (inspection_id),
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
