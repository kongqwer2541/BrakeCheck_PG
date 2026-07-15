-- Step 12.3: Sampling Rules + Instrument Prefix settings
-- Safe migration: creates a new settings table and seeds existing prefixes.
-- Backup database before running this migration on the real factory database.

CREATE TABLE IF NOT EXISTS dimension_instrument_prefixes (
  slot_no TINYINT NOT NULL PRIMARY KEY,
  prefix VARCHAR(20) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_dimension_instrument_prefixes_slot CHECK (slot_no BETWEEN 1 AND 5),
  CONSTRAINT chk_dimension_instrument_prefixes_prefix CHECK (prefix REGEXP '^A-[0-9]{2}-$')
);

INSERT INTO dimension_instrument_prefixes (slot_no, prefix)
VALUES
  (1, 'A-01-'),
  (2, 'A-01-'),
  (3, 'A-07-'),
  (4, 'A-01-'),
  (5, 'A-01-')
ON DUPLICATE KEY UPDATE prefix = prefix;
