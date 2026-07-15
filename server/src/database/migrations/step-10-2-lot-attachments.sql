-- Step 10.2 Lot attachments
-- Adds file attachment metadata tied to Lot records.
-- Backup the database before running this migration on real production data.

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

ALTER TABLE lot_audit_logs
  MODIFY action ENUM(
    'edit',
    'void',
    'approve',
    'cancel_approve',
    'send_back',
    'review_ng',
    'confirm_ng',
    'upload_attachment',
    'delete_attachment'
  ) NOT NULL;
