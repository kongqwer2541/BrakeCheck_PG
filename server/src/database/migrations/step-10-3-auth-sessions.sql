-- Step 10.3 Session revocation
-- Backup database before running this migration on a real factory database.
-- This migration adds a new table and does not modify existing QC records.

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
