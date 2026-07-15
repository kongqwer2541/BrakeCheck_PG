-- Step 8.4.1 migration: default dimension form config
-- Safe to run more than once.
-- Adds starter topics only when the same dimension topic name does not exist.

USE brakecheck;

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ความกว้าง', 2, 2, 'number', 'first', 1, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ความกว้าง'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ความยาว', 1, 1, 'number', 'first', 2, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ความยาว'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ความหนา', 3, 2, 'number', 'all', 3, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ความหนา'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ความหนารูยึดรีเวท', 2, 2, 'number', 'all', 4, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ความหนารูยึดรีเวท'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ขนาดรูเจาะ/รูคว้าน', 2, 1, 'number', 'first', 5, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ขนาดรูเจาะ/รูคว้าน'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'ตำแหน่งรูเจาะ/รูคว้าน', 1, 0, 'pass_fail', 'all', 6, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'ตำแหน่งรูเจาะ/รูคว้าน'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'โค้ง', 1, 0, 'pass_fail', 'all', 7, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'โค้ง'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'สภาพทั่วไป', 1, 0, 'pass_fail', 'all', 8, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'สภาพทั่วไป'
);

INSERT INTO form_config (
  form_type,
  topic_name,
  input_count,
  decimal_places,
  input_type,
  measure_pieces,
  display_order,
  remark
)
SELECT 'dimension', 'สรุปผลการตรวจ', 1, 0, 'pass_fail', 'all', 9, 'ค่าเริ่มต้นสำหรับ Step 8.4'
WHERE NOT EXISTS (
  SELECT 1 FROM form_config WHERE form_type = 'dimension' AND topic_name = 'สรุปผลการตรวจ'
);

UPDATE form_config
SET measure_pieces = 'first'
WHERE form_type = 'dimension'
  AND topic_name IN ('ความกว้าง', 'ความยาว', 'ขนาดรูเจาะ/รูคว้าน')
  AND remark = 'ค่าเริ่มต้นสำหรับ Step 8.4';

UPDATE form_config
SET input_count = 1
WHERE form_type = 'dimension'
  AND topic_name = 'ตำแหน่งรูเจาะ/รูคว้าน'
  AND remark = 'ค่าเริ่มต้นสำหรับ Step 8.4';
