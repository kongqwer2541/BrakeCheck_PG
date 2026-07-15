-- Step 10.1 Approved Workflow
-- Adds audit action names for approval, cancel approval, send back, and NG review.
-- Backup the database before running this migration on real production data.

ALTER TABLE lot_audit_logs
  MODIFY action ENUM(
    'edit',
    'void',
    'approve',
    'cancel_approve',
    'send_back',
    'review_ng'
  ) NOT NULL;
