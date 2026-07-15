# Final IT System Report: BrakeCheck

เอกสารนี้เป็นรายงานโครงสร้างระบบ BrakeCheck สำหรับฝ่าย IT ใช้อ่านภาพรวมระบบก่อนติดตั้ง ดูแล สำรองข้อมูล หรือประเมินความปลอดภัย

วันที่จัดทำครั้งแรก: 2026-07-01

วันที่ตรวจสอบล่าสุด: 2026-07-11

Revision นี้อ้างอิงโค้ดบน `master` ถึง commit `2dc643f` โดยเพิ่มข้อมูล session revocation, security hardening, โครงสร้าง helper ที่แยกใหม่ และพฤติกรรม Import Excel ปัจจุบัน

ขอบเขตของรายงาน:

- อ้างอิงจากไฟล์โค้ดและเอกสารใน repository ปัจจุบันเท่านั้น
- ไม่อ่านหรือคัดลอกค่า `.env` จริง
- ไม่ใส่รหัสผ่านจริง token secret ไฟล์ backup จริง หรือข้อมูลโรงงานจริง
- ไม่แก้ logic ระบบ ไม่แก้ฐานข้อมูล และไม่เพิ่ม dependency

## 1. ภาพรวมระบบ

BrakeCheck เป็น web application สำหรับเจ้าหน้าที่ QC โรงงานผลิตผ้าเบรก ใช้แทนการจดบันทึกคุณภาพบนกระดาษ โดยเก็บข้อมูล Lot, การนำเข้า Excel, การตรวจมิติ, การตรวจบรรจุ, การอนุมัติ, ประวัติการแก้ไข และรายงานไว้ในระบบเดียว

กลุ่มผู้ใช้งานหลัก:

- `head`: หัวหน้า/ผู้จัดการ มีสิทธิ์จัดการผู้ใช้ อนุมัติ แก้ไข ตั้งค่าระบบ และส่งออกรายงาน
- `assistant`: ผู้ช่วยหัวหน้า มีสิทธิ์นำเข้า ตรวจ อนุมัติ ตั้งค่าบางส่วน และส่งออกรายงาน
- `officer`: เจ้าหน้าที่ QC ใช้ดู Dashboard, ยิงบาร์โค้ด, ตรวจ QC, ดู Results และ History

งาน QC ที่ระบบรองรับ:

- Import Excel จากแผนการผลิต
- ค้นหา Lot ด้วย Lot หรือ Lot Pack
- ตรวจมิติ
- ตรวจบรรจุ/สติกเกอร์
- แนบไฟล์หลักฐานกับ Lot
- อนุมัติ ยกเลิกอนุมัติ ส่งกลับแก้ไข รับทราบ NG
- ดูประวัติและผลตรวจย้อนหลัง
- Export รายงานราย Lot และ Export Dimension History

Local-first หมายถึง ระบบออกแบบให้ทำงานบนเครื่องแม่ในบริษัทหรือเครือข่ายภายในเป็นหลัก ไม่ต้องพึ่ง cloud หรือบริการเสียเงินรายเดือน เครื่องลูกเปิดใช้งานผ่าน Chrome โดยเข้า URL ของเครื่องแม่

## 2. เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | หน้าที่ |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript | สร้างหน้าจอที่เปิดผ่าน Chrome |
| Backend | Node.js, Express | เปิด web server และ API |
| Database | MySQL | เก็บข้อมูลผู้ใช้ Lot ผลตรวจ audit และ settings |
| File storage | local folder `storage/` | เก็บไฟล์ upload/export/attachment runtime |
| Development tools | VS Code, Git, GitHub, Chrome | พัฒนา ตรวจ version และทดสอบ |
| Windows helper | `.bat`, PowerShell | ปุ่มเปิด server ตรวจระบบ backup และตั้ง task |

Dependency หลักจาก `server/package.json` และ license จาก `server/package-lock.json`:

| Dependency | Version ใน lock | License | ใช้ทำอะไร |
| --- | --- | --- | --- |
| `express` | 4.22.2 | MIT | สร้าง HTTP server และ API routes |
| `mysql2` | 3.22.4 | MIT | เชื่อมต่อ MySQL แบบ promise |
| `dotenv` | 16.6.1 | BSD-2-Clause | อ่านค่า config จาก `.env` |
| `cors` | 2.8.6 | MIT | จำกัด origin ที่ browser เรียก API ได้ |
| `bcrypt` | 6.0.0 | MIT | hash และตรวจรหัสผ่าน |
| `jsonwebtoken` | 9.0.3 | MIT | สร้าง/ตรวจ login token |
| `exceljs` | 4.4.0 | MIT | อ่าน Excel และสร้าง Excel export |
| `multer` | 2.2.0 | MIT | รับไฟล์ upload เช่น Excel และ attachment |
| `pdfkit` | 0.15.2 | MIT | สร้าง PDF report |
| `nodemon` | 3.1.14 | MIT | ช่วยรัน server ระหว่างพัฒนา |

หมายเหตุด้านค่าใช้จ่าย/license:

- จากไฟล์ package ที่ตรวจพบ dependency หลักเป็น open-source license ที่ไม่ระบุค่าใช้จ่ายรายเดือน
- root package ระบุ `"license": "UNLICENSED"` หมายถึงตัวโปรเจกต์ BrakeCheck เองยังไม่ได้ประกาศ license สำหรับเผยแพร่ภายนอก
- ไม่พบ dependency สำหรับ cloud database, paid hosting, frontend framework, TypeScript, Tailwind หรือ Next.js

## 3. โครงสร้างโฟลเดอร์และไฟล์สำคัญ

| Path | หน้าที่ |
| --- | --- |
| `client/` | frontend static files ที่ browser เปิดใช้งาน |
| `client/src/app.js` | ตัวคุม flow หลักของ frontend เช่น login, navigation, load data |
| `client/src/app.routes.js` | mapping ชื่อหน้าไปยัง action/queue ที่ frontend ใช้นำทาง |
| `client/src/pages/` | render/bind ของหน้าเว็บแต่ละหน้า |
| `client/src/services/` | ฟังก์ชันเรียก backend API จาก frontend |
| `client/src/flows/` | helper ควบคุมลำดับงาน Export Dimension ที่แยกออกจาก `app.js` |
| `client/src/config/app.config.js` | permission ของหน้าเว็บและข้อความกลาง |
| `client/src/components/main-layout.js` | sidebar, topbar, menu หลัก |
| `client/src/styles/main.css` | CSS หลักของระบบ |
| `client/src/styles/export-dimension.css` | CSS เฉพาะหน้า Export Dimension |
| `server/` | backend Node.js/Express |
| `server/src/app.js` | สร้าง Express app, static frontend, mount API routes |
| `server/src/index.js` | จุด start server |
| `server/src/routes/` | ประกาศ API endpoint และ role guard |
| `server/src/controllers/` | รับ request แล้วเรียก service |
| `server/src/services/` | business logic และ SQL query |
| `server/src/services/auth-session.service.js` | สร้าง ตรวจ และเพิกถอน login session รวมถึงรายงานสถานะ retention |
| `server/src/services/report-export-*.js` | helper สำหรับ validation, layout และ section ของ Excel/PDF report |
| `server/src/services/dimension-inspection-validation.js` | validation helper ของการตรวจมิติ |
| `server/src/middlewares/` | auth, role, error handling |
| `server/src/config/env.js` | อ่านค่า `.env` จาก root project |
| `server/src/config/database.js` | สร้าง MySQL connection pool |
| `server/src/database/schema.sql` | schema หลักของฐานข้อมูล |
| `server/src/database/migrations/` | migration SQL ที่เพิ่ม/ปรับ schema ในแต่ละ step |
| `scripts/` | Windows helper scripts |
| `docs/` | เอกสารติดตั้ง backup migration test และ project plan |
| `docs/go-live-checklist.md` | checklist ก่อนเปิดใช้งานจริงสำหรับ IT |
| `.agents/` | skill/instruction สำหรับช่วยทำงานแบบปลอดภัยกับโปรเจกต์นี้ |
| `.env.example` | ตัวอย่าง config ที่ปลอดภัย ห้ามแทนที่ด้วยค่าจริงใน Git |
| `.gitignore` | กัน `.env`, `backups/`, `*.sql`, runtime storage และ log ไม่ให้ commit |

## 4. สถาปัตยกรรมระบบ

BrakeCheck ใช้สถาปัตยกรรมแบบง่ายสำหรับเครื่อง Windows ภายในบริษัท:

```text
QC user / IT user
  -> Chrome browser
  -> Frontend HTML/CSS/JavaScript in client/
  -> Express API in server/src/routes/
  -> Service layer in server/src/services/
  -> MySQL database
  -> storage/attachments for uploaded files
```

Flow แบบเข้าใจง่าย:

1. ผู้ใช้เปิด Chrome ไปที่ `http://localhost:3000/` หรือ `http://<server-ip>:3000/`
2. Express เสิร์ฟไฟล์ frontend จาก `client/`
3. Frontend เรียก API ใต้ `/api/...`
4. Backend ตรวจ login token และ role ก่อนทำงานสำคัญ
5. Service layer อ่าน/เขียน MySQL และบางส่วนอ่าน/เขียนไฟล์ใน `storage/`
6. Backend ส่ง JSON หรือไฟล์ export กลับให้ browser

## 5. การติดตั้งและการใช้งานจริง

แนวทางที่แนะนำ:

- ใช้เครื่องแม่ 1 เครื่องสำหรับเปิด server และเก็บ MySQL
- เครื่องลูกไม่ต้องติดตั้ง Node.js/MySQL/Git แค่มี Chrome และอยู่ใน network เดียวกัน
- เครื่องแม่เปิดระบบผ่าน `scripts/start-server.bat` หรือ `npm start`
- เครื่องลูกเปิดผ่าน `http://<server-ip>:3000/`

URL สำคัญ:

| URL | ใช้ทำอะไร |
| --- | --- |
| `http://localhost:3000/` | เปิดหน้าเว็บจากเครื่องแม่ |
| `http://<server-ip>:3000/` | เปิดหน้าเว็บจากเครื่องลูก |
| `http://localhost:3000/api/health` | ตรวจว่า API พร้อม |
| `http://localhost:3000/api/database/health` | ตรวจ database และตารางที่จำเป็น ต้อง login ด้วย role `head` หรือ `assistant` |

ไฟล์ `.env` ใช้เก็บค่า config จริง เช่น port, CORS, database, password และ `SESSION_SECRET` ตัวอย่างรูปแบบที่ปลอดภัย:

```text
APP_PORT=3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.x.x:3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=brakecheck
DB_USER=brakecheck_app
DB_PASSWORD=********
SESSION_SECRET=********************************
```

ข้อควรระวัง:

- ห้ามส่ง `.env` จริงให้คนที่ไม่เกี่ยวข้อง
- ห้าม commit `.env`
- `SESSION_SECRET` ต้องยาวอย่างน้อย 32 ตัวอักษร และไม่ใช้ placeholder
- ควรให้ IT สร้าง MySQL user เฉพาะระบบ เช่น `brakecheck_app` ที่มีสิทธิ์เท่าที่จำเป็น แทนการใช้ `root` ใน production

## 6. ฐานข้อมูล

ชื่อฐานข้อมูลจาก `.env.example` และ `schema.sql`: `brakecheck`

Primary Key (PK) คือคอลัมน์หลักที่ใช้ระบุ 1 record ในตารางนั้น Foreign Key (FK) คือคอลัมน์ที่ผูกความสัมพันธ์ไปยังตารางอื่น

### 6.1 ตารางทั้งหมด

| กลุ่ม | ตาราง |
| --- | --- |
| User/Auth | `users`, `auth_sessions`, `user_audit_logs` |
| Import/Lot หลัก | `excel_import_batches`, `lots` |
| Audit/History/Status | `lot_audit_logs`, `system_setting_audit_logs` |
| Attachment | `lot_attachments` |
| Settings/Form | `sampling_rules`, `dimension_instrument_prefixes`, `form_config` |
| QC Inspection | `dimension_inspections`, `packing_inspections`, `dimension_inspection_values` |

### 6.2 รายละเอียดตารางและคอลัมน์

#### `users`

เก็บผู้ใช้ที่ login เข้าระบบ

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `employee_code` | `VARCHAR(20)` | UNIQUE, required |
| `password_hash` | `VARCHAR(255)` | required, เก็บ hash ไม่ใช่ password จริง |
| `full_name` | `VARCHAR(100)` | required |
| `position` | `VARCHAR(100)` | required |
| `role` | `ENUM('head','assistant','officer')` | default `officer` |
| `status` | `ENUM('active','suspended')` | default `active` |
| `must_change_password` | `BOOLEAN` | default `TRUE` |
| `failed_login_count` | `TINYINT` | default `0` |
| `locked_until` | `DATETIME` | nullable |
| `created_at` | `DATETIME` | default current timestamp |
| `updated_at` | `DATETIME` | auto update |

#### `auth_sessions`

เก็บ login session เพื่อให้ Logout หรือการเปลี่ยนรหัสผ่านของผู้ใช้สามารถเพิกถอน token ที่ออกไปแล้วได้ทันที โดยเก็บแถวที่ถูกเพิกถอนไว้เพื่อการตรวจสอบด้านความปลอดภัย

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `BIGINT AUTO_INCREMENT` | PK |
| `token_id` | `CHAR(36)` | UNIQUE, required, รหัสเฉพาะของ token |
| `user_id` | `INT` | nullable, FK -> `users.id` |
| `expires_at` | `DATETIME` | required, เวลาที่ session หมดอายุ |
| `revoked_at` | `DATETIME` | nullable, เวลาที่เพิกถอน session |
| `revoke_reason` | `VARCHAR(40)` | nullable, เหตุผลที่เพิกถอน เช่น `logout` หรือ `password_change` |
| `created_at` | `DATETIME` | default current timestamp |

Index/Unique: `token_id`, `idx_auth_sessions_user_active`

#### `user_audit_logs`

เก็บประวัติการจัดการผู้ใช้

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `actor_user_id` | `INT` | FK -> `users.id`, ผู้ทำรายการ |
| `target_user_id` | `INT` | FK -> `users.id`, ผู้ถูกแก้ไข |
| `action` | `ENUM('create_user','update_user','reset_password')` | required |
| `detail` | `TEXT` | nullable |
| `created_at` | `DATETIME` | default current timestamp |

#### `excel_import_batches`

เก็บประวัติการ import Excel แต่ละครั้ง

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `original_file_name` | `VARCHAR(255)` | required |
| `file_hash` | `CHAR(64)` | required |
| `file_size` | `INT` | required |
| `sheet_name` | `VARCHAR(100)` | default `DATA` |
| `production_dates` | `JSON` | nullable |
| `total_rows` | `INT` | default `0` |
| `imported_rows` | `INT` | default `0` |
| `skipped_rows` | `INT` | default `0` |
| `uploaded_by` | `INT` | FK -> `users.id` |
| `uploaded_at` | `DATETIME` | default current timestamp |

#### `lots`

ตารางข้อมูลหลักของ Lot ใช้ผูกกับงาน QC

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `lot_number` | `VARCHAR(20)` | UNIQUE, มาจาก Excel Column A |
| `lot_pack_barcode` | `VARCHAR(50)` | มาจาก Column R, ซ้ำได้ |
| `lot_packing` | `VARCHAR(50)` | มาจาก Column X, ใช้ `-` เมื่อว่าง |
| `model_name` | `VARCHAR(200)` | nullable |
| `dimension` | `VARCHAR(100)` | nullable |
| `aci_grade` | `VARCHAR(20)` | nullable |
| `code` | `VARCHAR(20)` | nullable |
| `purchase_order` | `VARCHAR(50)` | nullable |
| `drill_size` | `DECIMAL(6,2)` | nullable |
| `bore_size` | `DECIMAL(6,2)` | nullable |
| `rivet_no` | `VARCHAR(50)` | nullable |
| `production_date` | `DATE` | nullable, มาจาก Column T |
| `quantity` | `INT` | default `0` |
| `sample_count` | `INT` | default `0` |
| `remark1` | `TEXT` | nullable |
| `remark2` | `TEXT` | nullable |
| `remark3` | `TEXT` | nullable |
| `manual_reason` | `TEXT` | nullable |
| `status` | `ENUM('pending','temp','waiting_pack','waiting_approve','need_fix','approved','ng','void')` | default `pending` |
| `imported_by` | `INT` | FK -> `users.id` |
| `import_batch_id` | `INT` | FK -> `excel_import_batches.id` |
| `import_source` | `ENUM('excel','manual')` | default `excel` |
| `voided_by` | `INT` | FK -> `users.id` |
| `voided_at` | `DATETIME` | nullable |
| `void_reason` | `TEXT` | nullable |
| `created_at` | `DATETIME` | default current timestamp |
| `updated_at` | `DATETIME` | auto update |

Indexes: `idx_lots_status`, `idx_lots_model_name`, `idx_lots_production_date`, `idx_lots_lot_pack_barcode`, `idx_lots_lot_packing`

#### `lot_audit_logs`

เก็บประวัติการแก้ไขสถานะ/ข้อมูล Lot

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `lot_id` | `INT` | FK -> `lots.id`, `ON DELETE RESTRICT` |
| `action` | `ENUM('edit','void','approve','cancel_approve','send_back','review_ng','confirm_ng','upload_attachment','delete_attachment')` | required |
| `reason` | `TEXT` | required |
| `before_data` | `JSON` | nullable |
| `after_data` | `JSON` | nullable |
| `changed_by` | `INT` | FK -> `users.id` |
| `actor_name_snapshot` | `VARCHAR(200)` | nullable |
| `actor_position_snapshot` | `VARCHAR(100)` | nullable |
| `created_at` | `DATETIME` | default current timestamp |

#### `lot_attachments`

เก็บ metadata ของไฟล์แนบ ส่วนไฟล์จริงอยู่ใน `storage/attachments`

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `lot_id` | `INT` | FK -> `lots.id`, `ON DELETE RESTRICT` |
| `original_name` | `VARCHAR(255)` | required |
| `stored_name` | `VARCHAR(255)` | UNIQUE |
| `mime_type` | `VARCHAR(100)` | required |
| `file_size` | `INT` | required |
| `uploaded_by` | `INT` | FK -> `users.id` |
| `uploaded_at` | `DATETIME` | default current timestamp |
| `deleted_by` | `INT` | FK -> `users.id` |
| `deleted_at` | `DATETIME` | nullable, ใช้ soft-delete |

Index/Unique: `uq_lot_attachments_stored_name`, `idx_lot_attachments_lot_active`

#### `sampling_rules`

เก็บกฎจำนวนชิ้นสุ่มตรวจ

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `qty_min` | `INT` | required, `>= 0` |
| `qty_max` | `INT` | nullable, ต้อง `>= qty_min` |
| `sample_count` | `INT` | required, `> 0` |
| `updated_by` | `INT` | FK -> `users.id` |
| `updated_at` | `DATETIME` | auto update |

#### `dimension_instrument_prefixes`

เก็บ prefix ของรหัสเครื่องมือวัด 5 ช่อง

| Column | Type | Key/Rule |
| --- | --- | --- |
| `slot_no` | `TINYINT` | PK, 1-5 |
| `prefix` | `VARCHAR(20)` | format `A-00-` |
| `updated_at` | `DATETIME` | auto update |

#### `form_config`

เก็บหัวข้อฟอร์มตรวจแบบ dynamic สำหรับมิติและบรรจุ

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `form_type` | `ENUM('dimension','packing')` | required |
| `topic_name` | `VARCHAR(200)` | required |
| `input_count` | `TINYINT` | default `1`, `> 0` |
| `decimal_places` | `TINYINT` | default `0`, 0-3 |
| `input_type` | `ENUM('number','pass_fail')` | required |
| `measure_pieces` | `VARCHAR(50)` | default `all` |
| `rule_key` | `VARCHAR(80)` | nullable |
| `display_order` | `TINYINT` | default `1` |
| `remark` | `TEXT` | nullable |
| `is_active` | `BOOLEAN` | default `TRUE` |
| `updated_by` | `INT` | FK -> `users.id` |
| `updated_at` | `DATETIME` | auto update |

Index: `idx_form_config_type_active`

#### `system_setting_audit_logs`

เก็บ audit ของ System Settings

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `setting_area` | `VARCHAR(80)` | required |
| `action` | `VARCHAR(80)` | required |
| `target_type` | `VARCHAR(80)` | nullable |
| `target_id` | `INT` | nullable |
| `reason` | `TEXT` | nullable |
| `before_data` | `JSON` | nullable |
| `after_data` | `JSON` | nullable |
| `changed_by` | `INT` | FK -> `users.id` |
| `actor_name_snapshot` | `VARCHAR(200)` | nullable |
| `actor_position_snapshot` | `VARCHAR(100)` | nullable |
| `created_at` | `DATETIME` | default current timestamp |

Index: `idx_system_setting_audit_logs_area_created`

#### `dimension_inspections`

เก็บหัวใบตรวจมิติ 1 record ต่อ Lot

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `lot_id` | `INT` | UNIQUE, FK -> `lots.id` |
| `status` | `ENUM('draft','completed')` | default `draft` |
| `inspection_date` | `DATE` | nullable |
| `shift` | `ENUM('1','2')` | nullable |
| `instrument_codes` | `JSON` | nullable |
| `rivet_no` | `VARCHAR(50)` | nullable |
| `production_code` | `VARCHAR(50)` | nullable |
| `brake_type` | `ENUM('normal','taper','sheet')` | nullable |
| `brake_model` | `ENUM('drilled_bored','no_hole')` | nullable |
| `rivet_hole_thickness` | `DECIMAL(3,1)` | nullable |
| `sample_count` | `INT` | nullable, `> 0` |
| `form_config_snapshot` | `JSON` | snapshot หัวข้อฟอร์มตอน complete |
| `pieces_data` | `JSON` | ค่าตรวจจริง |
| `created_by` | `INT` | FK -> `users.id` |
| `updated_by` | `INT` | FK -> `users.id` |
| `completed_by` | `INT` | FK -> `users.id` |
| `completed_at` | `DATETIME` | nullable |
| `created_at` | `DATETIME` | default current timestamp |
| `updated_at` | `DATETIME` | auto update |

Index/Unique: `uq_dimension_inspections_lot`, `idx_dimension_inspections_status`

#### `packing_inspections`

เก็บหัวใบตรวจบรรจุ 1 record ต่อ Lot

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `lot_id` | `INT` | UNIQUE, FK -> `lots.id` |
| `status` | `ENUM('draft','completed')` | default `draft` |
| `inspection_date` | `DATE` | nullable |
| `form_config_snapshot` | `JSON` | snapshot หัวข้อฟอร์มตอน complete |
| `results_data` | `JSON` | ค่าตรวจบรรจุ |
| `created_by` | `INT` | FK -> `users.id` |
| `updated_by` | `INT` | FK -> `users.id` |
| `completed_by` | `INT` | FK -> `users.id` |
| `completed_at` | `DATETIME` | nullable |
| `created_at` | `DATETIME` | default current timestamp |
| `updated_at` | `DATETIME` | auto update |

Index/Unique: `uq_packing_inspections_lot`, `idx_packing_inspections_status`

#### `dimension_inspection_values`

ตารางเตรียมสำหรับเก็บค่าตรวจมิติแบบละเอียดรายช่อง

| Column | Type | Key/Rule |
| --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | PK |
| `inspection_id` | `INT` | FK -> `dimension_inspections.id`, `ON DELETE CASCADE` |
| `topic_config_id` | `INT` | FK -> `form_config.id` |
| `topic_name` | `VARCHAR(200)` | required |
| `piece_no` | `INT` | `> 0` |
| `input_index` | `TINYINT` | `> 0` |
| `numeric_value` | `DECIMAL(12,3)` | nullable |
| `pass_fail_value` | `ENUM('pass','fail')` | nullable |
| `raw_value` | `VARCHAR(100)` | nullable |
| `created_at` | `DATETIME` | default current timestamp |

Index: `idx_dimension_inspection_values_inspection`

### 6.3 Constraint และ Index สำหรับ IT/DBA

ส่วนนี้สรุปชื่อ constraint/index จาก `server/src/database/schema.sql` เพื่อให้ฝ่าย IT หรือ DBA ใช้ตรวจ schema จริงได้ง่ายขึ้น

| ตาราง | ชื่อ | ประเภท / ความหมาย |
| --- | --- | --- |
| `auth_sessions` | `token_id` | Unique index: token แต่ละชุดมีรหัส session ไม่ซ้ำกัน |
| `auth_sessions` | `fk_auth_sessions_user` | FK: `user_id` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `auth_sessions` | `idx_auth_sessions_user_active` | Index สำหรับตรวจ session ของผู้ใช้ตามสถานะเพิกถอนและวันหมดอายุ |
| `user_audit_logs` | `fk_user_audit_actor` | FK: `actor_user_id` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `user_audit_logs` | `fk_user_audit_target` | FK: `target_user_id` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `excel_import_batches` | `fk_excel_import_batches_uploaded_by` | FK: `uploaded_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lots` | `fk_lots_imported_by` | FK: `imported_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lots` | `fk_lots_import_batch` | FK: `import_batch_id` -> `excel_import_batches.id`, ถ้า import batch ถูกลบให้ `SET NULL` |
| `lots` | `fk_lots_voided_by` | FK: `voided_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lots` | `idx_lots_status` | Index สำหรับค้นตาม `status` |
| `lots` | `idx_lots_model_name` | Index สำหรับค้นตาม `model_name` |
| `lots` | `idx_lots_production_date` | Index สำหรับค้นตาม `production_date` |
| `lots` | `idx_lots_lot_pack_barcode` | Index สำหรับค้น/ยิงบาร์โค้ด `lot_pack_barcode` |
| `lots` | `idx_lots_lot_packing` | Index สำหรับค้น `lot_packing` |
| `lot_audit_logs` | `fk_lot_audit_logs_lot` | FK: `lot_id` -> `lots.id`, ใช้ `ON DELETE RESTRICT` |
| `lot_audit_logs` | `fk_lot_audit_logs_changed_by` | FK: `changed_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lot_attachments` | `fk_lot_attachments_lot` | FK: `lot_id` -> `lots.id`, ใช้ `ON DELETE RESTRICT` |
| `lot_attachments` | `fk_lot_attachments_uploaded_by` | FK: `uploaded_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lot_attachments` | `fk_lot_attachments_deleted_by` | FK: `deleted_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `lot_attachments` | `uq_lot_attachments_stored_name` | Unique: กันชื่อไฟล์ที่เก็บจริงซ้ำกัน |
| `lot_attachments` | `idx_lot_attachments_lot_active` | Index สำหรับหา attachment ที่ยังไม่ถูก soft-delete |
| `sampling_rules` | `fk_sampling_rules_updated_by` | FK: `updated_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `sampling_rules` | `chk_sampling_qty_min` | CHECK: `qty_min >= 0` |
| `sampling_rules` | `chk_sampling_qty_max` | CHECK: `qty_max` ว่างได้ หรือมากกว่า/เท่ากับ `qty_min` |
| `sampling_rules` | `chk_sampling_sample_count` | CHECK: `sample_count > 0` |
| `dimension_instrument_prefixes` | `chk_dimension_instrument_prefixes_slot` | CHECK: `slot_no` ต้องอยู่ระหว่าง 1-5 |
| `dimension_instrument_prefixes` | `chk_dimension_instrument_prefixes_prefix` | CHECK: `prefix` ต้องอยู่ในรูปแบบ `A-00-` |
| `form_config` | `fk_form_config_updated_by` | FK: `updated_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `form_config` | `chk_form_input_count` | CHECK: `input_count > 0` |
| `form_config` | `chk_form_decimal_places` | CHECK: `decimal_places` อยู่ระหว่าง 0-3 |
| `form_config` | `idx_form_config_type_active` | Index สำหรับโหลดหัวข้อฟอร์มตาม `form_type` และ `is_active` |
| `system_setting_audit_logs` | `fk_system_setting_audit_logs_changed_by` | FK: `changed_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `system_setting_audit_logs` | `idx_system_setting_audit_logs_area_created` | Index สำหรับดู history ตาม setting area และเวลา |
| `dimension_inspections` | `uq_dimension_inspections_lot` | Unique: 1 Lot มีใบตรวจมิติได้ 1 record |
| `dimension_inspections` | `fk_dimension_inspections_lot` | FK: `lot_id` -> `lots.id`, ใช้ `ON DELETE RESTRICT` |
| `dimension_inspections` | `fk_dimension_inspections_created_by` | FK: `created_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `dimension_inspections` | `fk_dimension_inspections_updated_by` | FK: `updated_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `dimension_inspections` | `fk_dimension_inspections_completed_by` | FK: `completed_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `dimension_inspections` | `chk_dimension_sample_count` | CHECK: `sample_count` ว่างได้ หรือมากกว่า 0 |
| `dimension_inspections` | `idx_dimension_inspections_status` | Index สำหรับค้นตามสถานะใบตรวจมิติ |
| `packing_inspections` | `uq_packing_inspections_lot` | Unique: 1 Lot มีใบตรวจบรรจุได้ 1 record |
| `packing_inspections` | `fk_packing_inspections_lot` | FK: `lot_id` -> `lots.id`, ใช้ `ON DELETE RESTRICT` |
| `packing_inspections` | `fk_packing_inspections_created_by` | FK: `created_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `packing_inspections` | `fk_packing_inspections_updated_by` | FK: `updated_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `packing_inspections` | `fk_packing_inspections_completed_by` | FK: `completed_by` -> `users.id`, ถ้าผู้ใช้ถูกลบให้ `SET NULL` |
| `packing_inspections` | `idx_packing_inspections_status` | Index สำหรับค้นตามสถานะใบตรวจบรรจุ |
| `dimension_inspection_values` | `fk_dimension_values_inspection` | FK: `inspection_id` -> `dimension_inspections.id`, ใช้ `ON DELETE CASCADE` |
| `dimension_inspection_values` | `fk_dimension_values_topic_config` | FK: `topic_config_id` -> `form_config.id`, ถ้าหัวข้อถูกลบให้ `SET NULL` |
| `dimension_inspection_values` | `chk_dimension_values_piece_no` | CHECK: `piece_no > 0` |
| `dimension_inspection_values` | `chk_dimension_values_input_index` | CHECK: `input_index > 0` |
| `dimension_inspection_values` | `idx_dimension_inspection_values_inspection` | Index สำหรับค้นค่าตรวจตาม `inspection_id` |

## 7. Business Rules / เงื่อนไขสำคัญของระบบ

Excel Import:

- อ่านเฉพาะ sheet `DATA`
- รองรับเฉพาะ `.xlsx` และ `.xlsm`
- จำกัดขนาดไฟล์ frontend ที่ 10 MB และ backend ใช้ `multer` จำกัด upload Excel 10 MB
- `DATA` ต้องมี header columns ที่ระบบคาดไว้
- Column A = `Lot` เป็น key หลักของระบบและต้อง unique
- Duplicate Lot ในไฟล์ Excel เป็น error
- Lot ที่ซ้ำกับข้อมูลในระบบจะถูกแจ้งเตือน/บล็อกการ save ตาม validation
- Column R = `Lot Pack` ใช้ยิงบาร์โค้ด ซ้ำได้
- ถ้า Lot Pack map ไปหลาย Lot ผู้ใช้ต้องเลือก Lot ที่ต้องการ
- Column X = `Lot ผลิต` ใช้กับ packing/sticker check ซ้ำได้ และใช้ `-` เมื่อว่าง
- Column T = `วันฝน` ใช้เป็น `production_date`
- ถ้า Column T มีวันที่ถูกต้อง ระบบใช้ค่านั้นโดยตรง
- ถ้า Column T ว่างหรือ Excel formula ไม่มี cached result ที่ถูกต้อง ระบบปัจจุบันจะลองอ่านวันที่จาก Lot Pack และแสดง warning
- ถ้าอ่าน fallback จาก Lot Pack ไม่ได้ หรือค่า Column T ไม่ถูกต้อง ระบบแจ้ง error และ block การ save
- IT/QC ควรยืนยันก่อน production ว่าอนุญาตให้บันทึกด้วยวันที่ fallback จาก Lot Pack หรือกำหนดให้ผู้ใช้แก้ Excel ก่อน save
- มี warning หากไฟล์มีหลาย production date หรือมีการใช้วันที่ fallback

Lot workflow:

- `pending`: รอตรวจมิติ
- `temp`: มี draft หรือข้อมูลระหว่างตรวจบางส่วน
- `waiting_pack`: ตรวจมิติเสร็จ รอตรวจบรรจุ
- `waiting_approve`: ตรวจครบ รออนุมัติ
- `need_fix`: ส่งกลับแก้ไข
- `approved`: อนุมัติแล้ว ต้อง lock ก่อนแก้
- `ng`: ไม่ผ่าน/รับทราบ NG ตาม workflow
- `void`: ยกเลิกใช้งานแบบไม่ hard-delete

Approved / Locked / Cancel approval:

- Lot ที่ approved แล้วถือเป็นข้อมูลที่ lock
- การแก้หลัง approved ต้องผ่าน cancel approval โดย role ที่มีสิทธิ์
- การ cancel approval, send back, review NG, confirm NG ต้องมี audit/history

Snapshot:

- `dimension_inspections.form_config_snapshot`
- `dimension_inspections.pieces_data`
- `packing_inspections.form_config_snapshot`
- `packing_inspections.results_data`
- จุดประสงค์คือให้ข้อมูล completed ไม่เปลี่ยนตาม settings ใหม่ย้อนหลัง

Audit history:

- `lot_audit_logs` เก็บการแก้ Lot, void, approve, cancel, send back, NG และ attachment action
- `user_audit_logs` เก็บการจัดการ user
- `system_setting_audit_logs` เก็บการเปลี่ยน settings

QC inspection ที่รองรับ:

- ตรวจมิติแบบ dynamic topics จาก `form_config`
- ตรวจบรรจุแบบ dynamic topics จาก `form_config`
- เครื่องมือวัด 5 ช่อง พร้อม prefix จาก `dimension_instrument_prefixes`
- sampling rules จาก `sampling_rules`
- attachment ต่อ Lot
- Results read-only สำหรับงานที่จบแล้ว

## 8. ฟังก์ชันการใช้งาน

### Login / Logout

- พบในโค้ดปัจจุบัน
- Login ด้วย `employeeCode` และ password
- Password ถูก hash ด้วย `bcrypt`
- หลัง login ได้ token จาก `jsonwebtoken` และสร้าง record ใน `auth_sessions`
- Frontend เก็บ token ใน `sessionStorage`
- Backend ตรวจทั้งความถูกต้องของ token และ session ที่ยัง active ในฐานข้อมูล
- Logout จะเพิกถอน session ฝั่ง server ทำให้ token เดิมใช้ต่อไม่ได้
- เมื่อผู้ใช้เปลี่ยน password ของตนเอง ระบบจะเพิกถอน session เดิมและให้ Login ใหม่
- Session หมดอายุ ถูกเพิกถอน หรือ token ไม่ถูกต้องจะตอบ 401 และกลับหน้า Login

### Dashboard

- พบในโค้ดปัจจุบัน
- แสดงสถิติและรายการ Lot
- รองรับ date range, status, search, pagination
- role ทุกกลุ่มเข้าได้

### Import Excel

- พบในโค้ดปัจจุบัน
- upload Excel เพื่อ preview ก่อน
- ตรวจ type, sheet, header, duplicate, date, quantity
- save ลง MySQL เมื่อผ่าน validation
- เฉพาะ `head`, `assistant`

### Preview Import

- พบในโค้ดปัจจุบัน
- เรียก `/api/excel/preview`
- แสดง summary, warnings, invalid columns, duplicate lots และตัวอย่าง rows

### Lot Search

- พบในหลายจุดของโค้ดปัจจุบัน
- ค้นหาใน Dashboard, Barcode/Lot Lookup, Approval Queue, Results, History
- ค้นด้วย Lot, Lot Pack, Lot ผลิต, model หรือข้อความที่เกี่ยวข้องตามแต่ละ API

### Barcode / Lot Pack Scan

- พบในโค้ดปัจจุบัน
- ใช้ `/api/lots/lookup/by-lot-pack`
- รองรับ scan code ที่อาจเป็น Lot Pack หรือ Lot
- ถ้าเจอหลาย Lot ให้เลือกก่อนเปิดตรวจ

### QC Inspection

- พบในโค้ดปัจจุบัน
- ตรวจมิติ: draft และ complete
- ตรวจบรรจุ: draft และ complete
- ตรวจ permission และสถานะ Lot ก่อน save
- complete แล้วเก็บ snapshot

### Approval

- พบในโค้ดปัจจุบัน
- คิวรออนุมัติ
- approve, cancel approval, send back, review NG, confirm NG
- บันทึก audit ทุก action สำคัญ

### User Management

- พบในโค้ดปัจจุบัน
- เฉพาะ `head`
- list/create/update/reset password
- บังคับเปลี่ยน password หลัง reset/create ตาม field `must_change_password`
- การ reset password โดย `head` ยังไม่เพิกถอน login session เดิมของผู้ใช้นั้นในโค้ดปัจจุบัน

### Reports

- พบในโค้ดปัจจุบัน
- Export ราย Lot เป็น Excel/PDF
- Export Dimension History เป็น Excel workbook
- Results เป็นหน้าดูงานที่จบแล้วแบบ read-only
- จำนวน attachment ใน Results นับเฉพาะไฟล์ที่ยังไม่ถูก soft-delete
- ถ้า metadata ของ attachment ยังอยู่แต่ไฟล์จริงบนเครื่องแม่หาย endpoint download จะตอบ 404 และแจ้งให้ติดต่อผู้ดูแลระบบ

### Backup / Restore

- พบเป็น Windows helper scripts และ docs
- Backup database อย่างเดียว: `scripts/backup-database.bat`
- Backup ทั้งระบบ: `scripts/backup-system.bat`
- Auto backup: `scripts/auto-backup-system.bat` และ `scripts/register-auto-backup-task.ps1`
- Restore ไม่มี auto restore workflow ต้องทำตาม `docs/backup-restore-guide.md`

### Windows Helper Buttons

- พบใน `scripts/`
- มีปุ่มเปิด server, ตรวจระบบ, backup, auto start, uninstall auto start, auto backup

| Script | ใช้ทำอะไร | ข้อควรระวัง |
| --- | --- | --- |
| `scripts/start-server.bat` | เปิด BrakeCheck server แบบ manual | ต้องอยู่ที่เครื่องแม่หรือเครื่องที่ตั้งค่าโปรเจกต์ไว้ครบ |
| `scripts/check-system.bat` | ตรวจความพร้อมพื้นฐานของระบบ | ใช้ตรวจหลังติดตั้ง/ก่อนส่งใช้งาน |
| `scripts/backup-database.bat` | สำรอง MySQL เป็นไฟล์ `.sql` ใน `backups/` | ไฟล์ backup มีข้อมูลจริง ห้าม commit |
| `scripts/backup-system.bat` | สำรอง database และ `storage/attachments` | เหมาะก่อน update หรือก่อนงานเสี่ยง |
| `scripts/auto-start-server.bat` | เปิด server จาก Windows Task Scheduler | ตรวจ log ถ้าเปิดเองหลัง login ไม่สำเร็จ |
| `scripts/install-auto-start.bat` | ติดตั้ง Auto Start task | ควรให้ IT ตรวจสิทธิ์ Task Scheduler |
| `scripts/uninstall-auto-start.bat` | ถอน Auto Start task | ใช้เมื่อต้องหยุดการเปิด server อัตโนมัติ |
| `scripts/auto-backup-database.bat` | สำรอง database สำหรับ auto backup | อ่านค่า database จาก `.env` และห้ามพิมพ์รหัสผ่านจริง |
| `scripts/auto-backup-system.bat` | สำรอง database และ attachments เป็นชุด auto backup | ไม่ทำ restore, ไม่รัน migration, ไม่ลบ backup เก่า |
| `scripts/register-auto-backup-task.ps1` | สร้าง/แก้/ลบ Windows Task Scheduler สำหรับ auto backup | ให้ IT กำหนดเวลาและสิทธิ์รัน task |

## 9. API และ Backend

ทุก endpoint ใต้ `/api` ส่ง JSON เป็นหลัก ยกเว้น endpoint download/export ที่ส่งไฟล์ ปัจจุบันพบ 52 endpoints เมื่อนับ `/api/health`

Auth rule:

- `Public`: ไม่ต้อง login
- `Auth`: ต้องมี Bearer token
- Role ระบุเป็น `head`, `assistant`, `officer`

| Method | Endpoint | Auth/Role | ใช้ทำอะไร | Input สำคัญ | Output สำคัญ / Error |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | Public | ตรวจ API | ไม่มี | `{ ok, message }` |
| POST | `/api/auth/login` | Public | Login | `employeeCode`, `password` | token/user, 400/401 |
| GET | `/api/auth/me` | Auth | ดู user ปัจจุบัน | Bearer token | user, 401 |
| POST | `/api/auth/logout` | Auth | เพิกถอน session ฝั่ง server | token | ok/message, token เดิมใช้ต่อไม่ได้ |
| POST | `/api/auth/change-password` | Auth | เปลี่ยน password และเพิกถอน session เดิม | `currentPassword`, `newPassword` | ok/message, validation, ต้อง Login ใหม่ |
| GET | `/api/auth/sessions/retention-status` | head | ตรวจจำนวน session หมดอายุ/ถูกเพิกถอนที่เก่าเกินเกณฑ์ | token | `retentionDays`, counts, `cleanupEnabled` |
| GET | `/api/dashboard` | head/assistant/officer | Dashboard stats/list | `date`, `startDate`, `endDate`, `status`, `search`, `page`, `pageSize` | stats/items/summary |
| GET | `/api/database/health` | head/assistant | ตรวจ MySQL และตารางที่ระบบต้องมี | token | database/version/required/found/missing tables, 401/403 |
| POST | `/api/excel/preview` | head/assistant | Preview Excel | multipart `excelFile` | sheet/summary/rows/warnings/errors |
| POST | `/api/excel/import` | head/assistant | Confirm save Excel | multipart `excelFile`, `confirmedProductionDates` | import summary, 400/409 |
| GET | `/api/export-dimension/preview` | head/assistant | Preview export dimension | model/date/topic filters | items/topics/summary |
| POST | `/api/export-dimension/excel` | head/assistant | Download Dimension History workbook | `lotIds`, `topicNames` | `.xlsx`, validation |
| GET | `/api/history/lots` | head/assistant/officer | Lot history | `date`, `status`, `search`, `page`, `pageSize` | items/summary |
| GET | `/api/history/imports` | head/assistant/officer | Import history | `date`, `search`, `page`, `pageSize` | items/summary |
| GET | `/api/history/audits` | head/assistant/officer | Audit history | `date`, `action`, `search`, `page`, `pageSize` | items/summary |
| GET | `/api/inspection-queues/:queueType` | head/assistant/officer | Queue ตรวจมิติ/บรรจุ | `queueType`, date/status/search/page | queue items/stats |
| GET | `/api/lots/lookup/by-lot-pack` | head/assistant/officer | ค้น Lot จาก scan code | `lotPackBarcode` | lots[] |
| GET | `/api/lots/approval-queue` | head/assistant | คิวอนุมัติ | `tab`, `date`, `search`, `page`, `pageSize` | items/summary |
| POST | `/api/lots/manual` | head/assistant | เพิ่ม Manual Lot | lot fields, reason | lot/message |
| GET | `/api/lots/:lotNumber/attachments` | head/assistant/officer | list attachment | `lotNumber` | attachments[] |
| POST | `/api/lots/:lotNumber/attachments` | head/assistant/officer | upload attachment | multipart `attachmentFile` | attachments[], max 5 MB |
| GET | `/api/lots/:lotNumber/attachments/:attachmentId/download` | head/assistant/officer | download attachment | ids | file, 404/403 |
| DELETE | `/api/lots/:lotNumber/attachments/:attachmentId` | head/assistant | soft-delete attachment | ids | attachments[], audit |
| GET | `/api/lots/:lotNumber/dimension-inspection` | head/assistant/officer | โหลดฟอร์มตรวจมิติ | `lotNumber` | lot/form/inspection |
| POST | `/api/lots/:lotNumber/dimension-inspection/draft` | head/assistant/officer | save draft มิติ | inspection values | draft result |
| POST | `/api/lots/:lotNumber/dimension-inspection/complete` | head/assistant/officer | complete มิติ | required inspection values | completed/snapshot/status |
| GET | `/api/lots/:lotNumber/packing-inspection` | head/assistant/officer | โหลดฟอร์มตรวจบรรจุ | `lotNumber` | lot/form/inspection |
| POST | `/api/lots/:lotNumber/packing-inspection/draft` | head/assistant/officer | save draft บรรจุ | inspection values | draft result |
| POST | `/api/lots/:lotNumber/packing-inspection/complete` | head/assistant/officer | complete บรรจุ | required inspection values | completed/status |
| GET | `/api/lots/:lotNumber` | head/assistant | รายละเอียด Lot เพื่อแก้ไข | `lotNumber` | lot |
| PUT | `/api/lots/:lotNumber` | head/assistant | แก้ Lot | lot fields, `editReason` | lot/audit |
| POST | `/api/lots/:lotNumber/void` | head/assistant | Void Lot | `reason` | status `void`, audit |
| POST | `/api/lots/:lotNumber/approve` | head/assistant | Approve Lot | optional reason | status `approved`, audit |
| POST | `/api/lots/:lotNumber/cancel-approval` | head/assistant | Cancel approval | `reason` | unlock/status, audit |
| POST | `/api/lots/:lotNumber/send-back` | head/assistant | ส่งกลับแก้ไข | `reason` | status `need_fix`, audit |
| POST | `/api/lots/:lotNumber/review-ng` | head/assistant | ทบทวน NG | `reason` | audit/status |
| POST | `/api/lots/:lotNumber/confirm-ng` | head/assistant | รับทราบ NG | optional reason | status/evidence |
| GET | `/api/reports/export/lots` | head/assistant | list lot สำหรับ export report | `tab`, `date`, `search`, `page`, `pageSize` | items/summary |
| GET | `/api/reports/export/lots/:lotNumber/excel` | head/assistant | download Excel report | `lotNumber` | `.xlsx`, ต้อง report-ready |
| GET | `/api/reports/export/lots/:lotNumber/pdf` | head/assistant | download PDF report | `lotNumber` | `.pdf`, ต้อง font/report-ready |
| GET | `/api/results/lots` | head/assistant/officer | Results read-only | `tab`, `dateMode`, date range, search, page | items/counts |
| GET | `/api/settings` | head/assistant | โหลด system settings | token | topics/rules/prefixes/audit |
| POST | `/api/settings/topics` | head/assistant | เพิ่มหัวข้อฟอร์ม | topic values/reason | settings/audit |
| PATCH | `/api/settings/topics/batch-display` | head/assistant | แก้ display หลายหัวข้อ | `items` | settings/audit |
| PATCH | `/api/settings/topics/:topicId` | head/assistant | แก้ display/remark หัวข้อ | `topicId`, values | settings/audit |
| POST | `/api/settings/topics/:topicId/deactivate` | head/assistant | ปิดหัวข้อฟอร์ม | `reason` | settings/audit |
| PUT | `/api/settings/sampling-rules` | head/assistant | แก้ sampling rules | rules | settings/audit |
| PUT | `/api/settings/instrument-prefixes` | head/assistant | แก้ instrument prefixes | prefixes | settings/audit |
| GET | `/api/users` | head | list users | token | users[] |
| POST | `/api/users` | head | create user | employee/fullName/role/password | user/audit |
| PUT | `/api/users/:id` | head | update user | user fields | user/audit |
| POST | `/api/users/:id/reset-password` | head | reset password | `temporaryPassword` | user/audit |

Validation/error สำคัญ:

- 400: input ไม่ถูกต้อง เช่น Lot ว่าง, Excel ผิดชนิด, column ไม่ตรง, date ผิด
- 401: ไม่ login หรือ session/token หมดอายุ
- 403: role ไม่พอ
- 404: ไม่พบ API, Lot, attachment หรือข้อมูลที่ขอ
- 409: conflict เช่น production date ซ้ำต้องยืนยันก่อน save
- 413: request body ใหญ่เกิน `1mb`
- 500: server error ส่งข้อความกลาง ไม่ส่ง stack trace ให้ผู้ใช้

## 10. Frontend Pages

| Page file | หน้า/ฟังก์ชัน | Client service file | Role | API ที่เกี่ยวข้อง |
| --- | --- | --- | --- | --- |
| `login.page.js` | Login | `auth.api.js` | public | `/api/auth/login` |
| `change-password.page.js` | เปลี่ยน password | `auth.api.js` | Auth | `/api/auth/change-password` |
| `dashboard.page.js` | Dashboard | `dashboard.api.js`, `lots.api.js` | head/assistant/officer | `/api/dashboard`, lot actions จาก `/api/lots/...` |
| `approval-queue.page.js` | คิวอนุมัติ | `lots.api.js` | head/assistant | `/api/lots/approval-queue` |
| `inspection-queue.page.js` | คิวตรวจมิติ/บรรจุ | `inspection-queues.api.js` | head/assistant/officer | `/api/inspection-queues/:queueType` |
| `import-excel.page.js` | Import/Preview Excel | `excel.api.js` | head/assistant | `/api/excel/preview`, `/api/excel/import` |
| `manual-lot.page.js` | เพิ่ม Manual Lot | `lots.api.js` | head/assistant | `/api/lots/manual` |
| `lot-lookup.page.js` | ยิงบาร์โค้ด/ค้น Lot | `lots.api.js` | head/assistant/officer | `/api/lots/lookup/by-lot-pack` |
| `lot-inspection.page.js` | ตรวจมิติ/ตรวจบรรจุ/แนบไฟล์/approve panel | `lots.api.js` | head/assistant/officer ตาม action | `/api/lots/:lotNumber/...` |
| `lot-edit.page.js` | แก้ไข/Void Lot | `lots.api.js` | head/assistant | `/api/lots/:lotNumber`, `/void` |
| `history.page.js` | ประวัติ Lot/Import/Audit | `history.api.js` | head/assistant/officer | `/api/history/lots`, `/imports`, `/audits` |
| `export-report.page.js` | Export report ราย Lot | `reports.api.js` | head/assistant | `/api/reports/export/lots`, `/excel`, `/pdf` |
| `export-dimension.page.js` | Export Dimension History | `export-dimension.api.js` | head/assistant | `/api/export-dimension/preview`, `/excel` |
| `results.page.js` | Results read-only | `results.api.js` | head/assistant/officer | `/api/results/lots` |
| `system-settings.page.js` | ตั้งค่าฟอร์ม/sampling/prefix | `settings.api.js` | head/assistant | `/api/settings...` |
| `users.page.js` | จัดการผู้ใช้ | `users.api.js` | head | `/api/users...` |
| `home.page.js` | พบไฟล์ใน `client/src/pages/` | ไม่พบ service mapping | ไม่พบใน navigation ปัจจุบัน | ไม่พบ API mapping ใน `client/src/app.js` |

ไฟล์ CSS ที่เกี่ยวข้อง:

- หลัก: `client/src/styles/main.css`
- Export Dimension: `client/src/styles/export-dimension.css`
- มี style tests สำหรับ Dashboard และ Export Dimension

หมายเหตุ: endpoint `/api/auth/sessions/retention-status` เป็นเครื่องมือ backend สำหรับ `head` และยังไม่พบหน้า frontend เรียกใช้งานโดยตรง

## 11. Security

การ Login / Session:

- ใช้ `jsonwebtoken` สำหรับ token
- Frontend ส่ง token ผ่าน `Authorization: Bearer <token>`
- token มีรหัส session เฉพาะ และ Backend ตรวจ record ใน `auth_sessions` ผ่าน `requireAuth`
- Logout และการเปลี่ยนรหัสผ่านของผู้ใช้เพิกถอน session เดิมฝั่ง server
- การ reset password โดย `head` ยังไม่เพิกถอน session เดิม ต้องให้ IT/เจ้าของระบบพิจารณานโยบายก่อน production
- Session หมดอายุ ถูกเพิกถอน หรือ token ผิดจะตอบ 401
- เกณฑ์ตรวจ session เก่าคือ 180 วัน แต่ `cleanupEnabled=false` และไม่มีการลบอัตโนมัติ

Password:

- ใช้ `bcrypt` salt rounds 12
- เก็บเฉพาะ `password_hash`
- password ใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร

Role/Permission:

- ใช้ `requireRole`
- role หลักคือ `head`, `assistant`, `officer`
- page permission อยู่ใน `client/src/config/app.config.js`
- backend validate role ซ้ำอีกชั้น ห้ามเชื่อ frontend อย่างเดียว

การป้องกันข้อมูลลับ:

- `.env` ถูก ignore โดย Git
- `backups/`, `*.sql`, runtime `storage/uploads`, `storage/exports`, `storage/attachments` ถูก ignore
- `.env.example` ใช้ placeholder เท่านั้น
- รายงานนี้ไม่ใส่ password จริง, token, session secret, backup content หรือไฟล์แนบจริง

Backend validation:

- Excel ตรวจ type, sheet, columns, duplicate Lot, date, row count, quantity
- Lot workflow ตรวจ status/role ก่อนแก้หรือ approve
- Settings ตรวจ draft ก่อนเปลี่ยนหัวข้อที่กระทบฟอร์ม
- จำกัด JSON และ URL-encoded request body ที่ `1mb`; ถ้าเกินตอบ 413 ด้วยข้อความกลาง
- ส่ง security headers เพื่อช่วยลดความเสี่ยง MIME sniffing, iframe embedding และ browser permission ที่ไม่จำเป็น
- Error middleware ไม่ส่ง stack trace ให้ผู้ใช้

สิ่งที่ IT ควรตรวจเพิ่มก่อน production:

- ใช้ HTTPS หรือจำกัด network ภายในถ้า policy บริษัทต้องการ
- ตั้ง firewall ให้เปิดเฉพาะ port ที่จำเป็น เช่น `3000`
- ใช้ MySQL user เฉพาะระบบ ไม่ใช้ `root`
- ตั้ง `SESSION_SECRET` ใหม่ที่ strong
- ตั้ง backup storage ที่อยู่นอก repo
- จำกัดสิทธิ์ folder `storage/` และ `backups/`
- ตรวจ policy retention ของ backup
- ตรวจจำนวน `auth_sessions` เก่าและกำหนด retention/cleanup policy ก่อนทำเครื่องมือลบข้อมูล โดยระบบยังไม่ลบให้อัตโนมัติ
- ตรวจเครื่องแม่ให้มี UPS หรือแนวทางกู้คืนเมื่อไฟดับ

## 12. Backup / Restore / Update

Backup:

- `scripts/backup-database.bat`: สำรองเฉพาะ MySQL เป็น `.sql`
- `scripts/backup-system.bat`: สำรอง MySQL และ `storage/attachments` เหมาะสำหรับก่อน update หรือก่อนงานเสี่ยง
- `scripts/auto-backup-database.bat`: auto backup เฉพาะ database
- `scripts/auto-backup-system.bat`: auto backup ทั้ง database และ attachments
- `scripts/register-auto-backup-task.ps1`: สร้าง/แก้/ลบ Windows Task Scheduler สำหรับ auto backup

Restore:

- ไม่มี automatic restore workflow
- ต้อง restore เข้า test database ก่อน
- ต้องตรวจ Login, Lot, Import history, Audit/History, Report/Export และ attachment ก่อนแตะ database จริง
- ห้าม restore ทับ database จริงทันที
- ห้ามใส่ password จริงลงคำสั่งหรือเอกสาร

Update:

- ก่อน update ต้อง backup ทั้ง database และ attachments
- ตรวจว่าอยู่เครื่อง/database ที่ถูกต้อง
- ถ้ามี migration ต้องอ่าน migration ก่อนและ backup ก่อน
- ห้าม run destructive SQL กับฐานข้อมูลจริง
- หลัง update ตรวจ `/api/health`, `/api/database/health`, Login และ workflow สำคัญ

ห้าม commit:

- `.env`
- `backups/`
- `*.sql` ยกเว้น schema/migration ใต้ `server/src/database/`
- backup `.zip`
- log
- runtime storage ที่มีข้อมูลโรงงานจริง

## 13. Deployment สำหรับบริษัท

แนวทางแนะนำ:

- ใช้เครื่องแม่ 1 เครื่อง
- เครื่องแม่ติดตั้ง Node.js, MySQL, Chrome, Git, VS Code
- เครื่องลูกใช้ Chrome และอยู่ network เดียวกับเครื่องแม่
- เครื่องลูกเข้าผ่าน `http://<server-ip>:3000/`
- ควรให้ IT กำหนด static IP หรือ DHCP reservation ให้เครื่องแม่
- ตั้ง CORS ใน `.env` ให้ตรงกับ URL/IP จริง

Firewall / Network / IP:

- ต้องอนุญาตให้เครื่องลูกเข้า port `3000` ของเครื่องแม่
- ไม่ควรปิด firewall เองโดยไม่มี IT
- ถ้า IP เครื่องแม่เปลี่ยน URL ของเครื่องลูกจะเปลี่ยนตาม
- MySQL ไม่ควรเปิดให้เครื่องลูกต่อโดยตรงถ้าไม่จำเป็น

สิ่งที่ต้องคุยกับ IT:

- เครื่องไหนเป็นเครื่องแม่
- ใครดูแลเครื่องแม่
- จะใช้ IP แบบคงที่หรือไม่
- เปิด firewall port `3000` อย่างไร
- MySQL user/password เก็บที่ไหนและใครรับผิดชอบ
- backup เก็บที่ไหน นานเท่าไร ใครตรวจ
- ถ้าเครื่องแม่เสียจะ restore จาก backup อย่างไร

ข้อจำกัดของระบบ Local:

- ถ้าเครื่องแม่ปิด เครื่องลูกใช้งานไม่ได้
- ถ้า backup อยู่เฉพาะเครื่องแม่และเครื่องเสีย อาจกู้คืนยาก
- ถ้า network ภายในล่ม เครื่องลูกเข้าไม่ได้
- ต้องมีคนรับผิดชอบ update, backup, restore และ security policy

## 14. Testing Checklist

ควรทดสอบก่อนส่งใช้งานจริง:

- เปิด `http://localhost:3000/` บนเครื่องแม่
- เปิด `http://localhost:3000/api/health`
- Login แล้วเปิด `http://localhost:3000/api/database/health`
- Login ด้วย role `head`, `assistant`, `officer`
- ทดสอบ session หมดอายุหรือ token ไม่ถูกต้องกลับ Login
- Logout แล้ว token เดิมต้องใช้เรียก API ไม่ได้
- เปลี่ยน password ของตนเองแล้ว session เดิมต้องใช้ไม่ได้และผู้ใช้ต้อง Login ใหม่
- ทดสอบและบันทึกข้อจำกัดว่า reset password โดย `head` ปัจจุบันยังไม่เพิกถอน session เดิม
- `head` เรียก `/api/auth/sessions/retention-status` ได้ และ role อื่นต้องถูกปฏิเสธ
- `head`/`assistant` เรียก `/api/database/health` ได้ ส่วน `officer` ต้องได้ 403
- ตรวจว่า Database Health รายงาน required/found/missing tables ครบ 14 ตาราง
- ตรวจ security headers และ request body เกิน `1mb` ต้องได้ 413
- Import Excel `.xlsx` หรือ `.xlsm` ที่มี sheet `DATA`
- Import Excel ที่ไม่มี sheet `DATA` ต้อง error
- Import Excel ที่ Lot ซ้ำในไฟล์ต้อง error
- Import Excel ที่ Lot ซ้ำกับระบบต้องแจ้งตาม flow
- ทดสอบ Column A, R, X, T ตาม business rule
- ทดสอบ Column T ว่าง/สูตรไม่มี cached result แล้วตรวจ warning และ fallback จาก Lot Pack
- ทดสอบ Column T ผิดและ fallback ไม่ได้ ต้อง block การ save
- ยิง Lot Pack ที่เจอ 1 Lot
- ยิง Lot Pack ที่เจอหลาย Lot แล้วเลือก Lot
- บันทึก draft และ complete ตรวจมิติ
- บันทึก draft และ complete ตรวจบรรจุ
- Upload/download/delete attachment ตาม role
- Approve, cancel approval, send back, review NG, confirm NG
- ตรวจ History และ Audit
- Export Excel/PDF report
- Export Dimension History
- เปิด Results แล้วตรวจว่า read-only
- ตรวจ permission เช่น `officer` เข้า Users/Settings/Export ไม่ได้
- เปิดจากเครื่องลูกผ่าน `http://<server-ip>:3000/`
- ทดสอบ `scripts/check-system.bat`
- ทดสอบ `scripts/backup-system.bat`
- ตรวจว่า backup ได้ทั้ง `.sql` และ attachment `.zip`

## 15. ความเสี่ยงและข้อเสนอแนะสำหรับ IT

จุดที่ควรระวัง:

- `.env` มี database password และ session secret
- `backups/` และ `.sql` มีข้อมูล QC จริง
- `storage/attachments` มีไฟล์แนบจริงของโรงงาน
- ถ้าใช้ MySQL `root` ใน production ความเสี่ยงสูง
- ถ้าไม่มี backup นอกเครื่องแม่ เมื่อเครื่องเสียอาจกู้คืนไม่ครบ
- ถ้า firewall เปิดกว้างเกินไป อาจมีเครื่องที่ไม่เกี่ยวข้องเข้าถึงระบบ
- ถ้าเปลี่ยน settings หลังมี completed inspection ต้องเคารพ snapshot เดิม
- ถ้าแก้ database โดยไม่ใช้ migration/backup อาจกระทบข้อมูลย้อนหลัง
- ตาราง `auth_sessions` อาจโตขึ้นตามจำนวนการ Login เพราะยังไม่มี automatic cleanup; ต้องกำหนด retention ก่อนลบข้อมูลเก่า
- การ reset password โดย `head` ยังไม่เพิกถอน session เดิม อาจไม่ตรงกับ security policy ของบริษัท

สิ่งที่ควรตรวจสอบก่อน production:

- ตั้ง `.env` จริงให้ครบและปลอดภัย
- ตั้ง MySQL user เฉพาะระบบ
- ตั้ง `SESSION_SECRET` ใหม่
- ติดตั้ง MySQL service ให้ start อัตโนมัติ
- ตรวจ Windows Task Scheduler ถ้าใช้ auto start/auto backup
- ทดสอบ restore กับ test database
- กำหนด backup retention และที่เก็บ backup นอก repo
- ตรวจสิทธิ์ folder project, `storage/`, `backups/`
- ทดสอบเครื่องลูกอย่างน้อย 1 เครื่อง

แนวทางดูแลระยะยาว:

- Backup ก่อน update, migration, bulk import, restore ทุกครั้ง
- เก็บคู่มือ restore ให้ IT และหัวหน้างานเข้าถึงได้
- ตรวจ backup log เป็นประจำ
- ตรวจสถานะ session เก่าและทบทวน retention policy เป็นระยะ
- Review dependency เป็นระยะ
- หลีกเลี่ยงเพิ่ม cloud/paid service ถ้าไม่ได้อนุมัติ
- เก็บประวัติการเปลี่ยน schema ผ่าน migration เท่านั้น

## 16. ภาคผนวก

### 16.1 รายการไฟล์สำคัญที่ใช้ทำรายงาน

- `AGENTS.md`
- `README.md`
- `docs/project-plan.md`
- `docs/deployment-guide.md`
- `docs/backup-restore-guide.md`
- `docs/database-migration-guide.md`
- `docs/auto-backup-guide.md`
- `docs/go-live-checklist.md`
- `docs/windows-button-guide.md`
- `.env.example`
- `.gitignore`
- `package.json`
- `server/package.json`
- `server/package-lock.json`
- `server/src/app.js`
- `server/src/config/env.js`
- `server/src/config/database.js`
- `server/src/database/schema.sql`
- `server/src/database/migrations/`
- `server/src/routes/`
- `server/src/controllers/`
- `server/src/services/`
- `server/src/services/auth-session.service.js`
- `server/src/services/report-export-*.js`
- `server/src/services/dimension-inspection-validation.js`
- `server/src/middlewares/`
- `server/src/utils/password.js`
- `server/src/utils/excel-reader.js`
- `client/src/app.js`
- `client/src/app.routes.js`
- `client/src/config/app.config.js`
- `client/src/components/main-layout.js`
- `client/src/flows/`
- `client/src/pages/`
- `client/src/services/`
- `client/src/styles/main.css`
- `client/src/styles/export-dimension.css`
- `scripts/`

### 16.2 คำสั่งที่ใช้รันระบบ

```powershell
npm start
```

หรือ:

```powershell
cd server
npm start
```

หรือเปิดด้วย Windows helper:

```text
scripts/start-server.bat
```

### 16.3 คำสั่งตรวจระบบ

```text
scripts/check-system.bat
```

เปิด health check:

```text
http://localhost:3000/api/health
http://localhost:3000/api/database/health
```

### 16.4 คำสั่งตรวจ syntax

```powershell
Get-ChildItem -Path client/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Path server/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

### 16.5 คำศัพท์เทคนิคสั้น ๆ

| คำ | ความหมาย |
| --- | --- |
| Frontend | ส่วนหน้าจอที่ผู้ใช้เห็นใน Chrome |
| Backend | ส่วน server ที่รับ API และคุยกับ database |
| API | ช่องทางที่ frontend เรียก backend |
| Database | ที่เก็บข้อมูลถาวร |
| Table | ตารางใน database คล้าย sheet ใน Excel |
| Column | ช่องข้อมูลใน table |
| Primary Key | ค่าหลักที่ระบุ 1 record |
| Foreign Key | ค่าที่ผูกไปยัง record ใน table อื่น |
| Index | ตัวช่วยให้ database ค้นหาเร็วขึ้น |
| Migration | ไฟล์ SQL สำหรับเปลี่ยนโครงสร้างฐานข้อมูล |
| Hash password | การแปลง password เป็นค่าเข้ารหัสทางเดียว |
| Token | หลักฐาน login ที่ browser ส่งให้ server |
| CORS | กติกาว่า browser จาก URL ไหนเรียก API ได้ |
| Backup | สำรองข้อมูลไว้กันหาย |
| Restore | กู้ข้อมูลจาก backup กลับเข้า database |
| Snapshot | สำเนาข้อมูล ณ ตอนที่ตรวจเสร็จ เพื่อไม่ให้เปลี่ยนย้อนหลัง |
| Audit log | ประวัติว่าใครทำอะไร เมื่อไร |

### 16.6 สิ่งที่ตรวจไม่พบจากโค้ดปัจจุบัน

- ไม่พบระบบ restore อัตโนมัติ และไม่ควรทำอัตโนมัติโดยไม่อนุมัติ
- ไม่พบ cloud database หรือ paid hosting
- ไม่พบ frontend framework เช่น React, Next.js, Tailwind หรือ TypeScript
- ไม่พบการคำนวณ CP/CPK ในระบบ จากเอกสาร Step 14 ให้ export ไปวิเคราะห์ภายนอก
- พบ `home.page.js` แต่ไม่พบว่าใช้เป็นหน้าใน navigation ปัจจุบันของ `client/src/app.js`
- ไม่พบ automatic cleanup ของ `auth_sessions`; พบเฉพาะ endpoint สำหรับตรวจจำนวน session เก่าและ `cleanupEnabled=false`
- ไม่พบการเพิกถอน session เดิมเมื่อ `head` reset password ให้ผู้ใช้
- ไม่ตรวจข้อมูลจริงใน database, `.env`, `backups/`, หรือ `storage/attachments`
