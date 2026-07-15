-- BrakeCheck seed data
-- Seed data means default data that should exist when installing the system.

USE brakecheck;

-- Default sample count rules from the project summary.
-- We use INSERT IGNORE so running this file more than once will not duplicate rows
-- if the same primary key already exists.
INSERT IGNORE INTO sampling_rules (id, qty_min, qty_max, sample_count)
VALUES
  (1, 2, 100, 2),
  (2, 101, 500, 3),
  (3, 501, 1200, 5),
  (4, 1201, NULL, 8);

-- Starter packing inspection topics.
-- These match Module 6 and can be edited later from Module 12.
INSERT IGNORE INTO form_config (
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
  (205, 'packing', 'สรุปผลการตรวจบรรจุ', 1, 0, 'pass_fail', 'all', 5, 'ลงชื่อผู้ตรวจ + วันที่อัตโนมัติ');

-- Starter dimension inspection topics.
-- These unlock Step 8.4 measurement input before the full System Settings page.
-- Leaders can edit, disable, or reorder them later from Step 12.
INSERT IGNORE INTO form_config (
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
  (101, 'dimension', 'ความกว้าง', 2, 2, 'number', 'first', 1, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (102, 'dimension', 'ความยาว', 1, 1, 'number', 'first', 2, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (103, 'dimension', 'ความหนา', 3, 2, 'number', 'all', 3, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (104, 'dimension', 'ความหนารูยึดรีเวท', 2, 2, 'number', 'all', 4, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (105, 'dimension', 'ขนาดรูเจาะ/รูคว้าน', 2, 1, 'number', 'first', 5, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (106, 'dimension', 'ตำแหน่งรูเจาะ/รูคว้าน', 1, 0, 'pass_fail', 'all', 6, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (107, 'dimension', 'โค้ง', 1, 0, 'pass_fail', 'all', 7, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (108, 'dimension', 'สภาพทั่วไป', 1, 0, 'pass_fail', 'all', 8, 'ค่าเริ่มต้นสำหรับ Step 8.4'),
  (109, 'dimension', 'สรุปผลการตรวจ', 1, 0, 'pass_fail', 'all', 9, 'ค่าเริ่มต้นสำหรับ Step 8.4');

UPDATE form_config
SET rule_key = 'hole_inspection'
WHERE form_type = 'dimension'
  AND topic_name LIKE CONCAT('%', CONVERT(UNHEX('E0B8A3E0B8B9E0B980E0B888E0B8B2E0B8B02FE0B8A3E0B8B9E0B884E0B8A7E0B989E0B8B2E0B899') USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%');
