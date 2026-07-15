-- Step 10.1.1 NG acknowledgement
-- Adds audit action name for acknowledging confirmed NG work.
-- Backup the database before running this migration on real production data.

ALTER TABLE lot_audit_logs
  MODIFY action ENUM(
    'edit',
    'void',
    'approve',
    'cancel_approve',
    'send_back',
    'review_ng',
    'confirm_ng'
  ) NOT NULL;
