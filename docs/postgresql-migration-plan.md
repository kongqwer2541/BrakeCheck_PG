# BrakeCheck PostgreSQL Migration Plan

เอกสารนี้เป็นแผนย้าย BrakeCheck จาก MySQL ไป PostgreSQL 17 สำหรับโปรเจกต์ `BrakeCheck_PG`

สถานะเอกสาร: Draft สำหรับให้ผู้ใช้/IT ตรวจและอนุมัติก่อนเริ่มแก้โค้ดจริง

วันที่จัดทำ: 2026-07-15

ขอบเขตความปลอดภัยของเอกสารนี้:

- เป็นเอกสารแผนงานเท่านั้น
- ยังไม่ติดตั้ง dependency ใหม่
- ยังไม่สร้าง table
- ยังไม่รัน schema หรือ migration
- ยังไม่ย้ายข้อมูลจริง
- ยังไม่เชื่อมต่อหรือแก้ไขฐานข้อมูล MySQL เดิม
- ไม่ใส่ password, token, secret, ค่า `.env` จริง, backup จริง หรือข้อมูลโรงงานจริง

## 1. เป้าหมายและขอบเขต

เป้าหมายหลักคือย้ายระบบ BrakeCheck จาก MySQL ไป PostgreSQL 17 โดยให้ผู้ใช้ QC ใช้งานหน้าตาและ workflow เดิมให้มากที่สุด

สิ่งที่ต้องรักษา:

- Frontend เดิม: HTML, CSS, JavaScript
- Backend เดิม: Node.js และ Express
- API input/output เดิมให้มากที่สุด
- Business Rules เดิมทั้งหมด
- Role เดิม: `head`, `assistant`, `officer`
- การทำงานแบบ local-first บน Windows
- เครื่องลูกใช้ Chrome เรียก Node.js API เท่านั้น
- เครื่องลูกไม่เชื่อมต่อ PostgreSQL โดยตรง
- MySQL project เดิมที่ `C:\Users\KONG\Documents\BrakeCheck` ต้องยังเก็บไว้เป็นระบบสำรอง

ขอบเขตแรกของงาน:

- ใช้ฐานข้อมูล PostgreSQL ว่างชื่อ `brakecheck_pg`
- ใช้ test data เท่านั้นในช่วงแรก
- ทำงานแบบทีละ phase และต้องรออนุมัติก่อนข้าม phase

## 2. สิ่งที่ไม่อยู่ในขอบเขต

สิ่งต่อไปนี้ยังไม่ทำในช่วงแรก:

- ไม่ย้ายข้อมูลจริงจาก MySQL
- ไม่ทำ dual-write ระหว่าง MySQL และ PostgreSQL
- ไม่แตะฐานข้อมูล MySQL เดิม
- ไม่แก้ project MySQL เดิม
- ไม่ใช้ cloud database
- ไม่ใช้ managed PostgreSQL
- ไม่ใช้ paid hosting
- ไม่เพิ่ม ORM เช่น Prisma, Sequelize หรือ TypeORM
- ไม่เปลี่ยน frontend framework
- ไม่เปลี่ยน UI/UX ใหญ่
- ไม่เพิ่มระบบ restore อัตโนมัติ
- ไม่ hard-delete production records

## 3. สถานะระบบ MySQL เดิม

จากการสำรวจ `BrakeCheck_PG` ปัจจุบัน โค้ดยังเป็นฐาน MySQL เดิมเกือบทั้งหมด

รายการสำคัญ:

- `server/package.json` ยังใช้ dependency `mysql2`
- `server/src/config/database.js` สร้าง MySQL connection pool ด้วย `mysql2/promise`
- `server/src/config/env.js` ยัง default เป็น `DB_PORT=3306`, `DB_NAME=brakecheck`, `DB_USER=root`
- `server/src/database/schema.sql` เป็น MySQL schema
- `server/src/database/seed.sql` ใช้ MySQL syntax เช่น `INSERT IGNORE`
- `server/src/database/migrations/` เป็น MySQL migration เดิม
- service layer ใช้ SQL placeholder แบบ `?`
- service layer ใช้ MySQL result shape เช่น `insertId` และ `affectedRows`
- service layer ใช้ MySQL error code เช่น `ER_DUP_ENTRY`, `ER_NO_SUCH_TABLE`, `ER_BAD_FIELD_ERROR`
- backup scripts ใช้ `mysqldump`
- docs หลายไฟล์ยังอธิบาย MySQL

จำนวน table ที่พบใน `server/src/database/schema.sql`: 14 tables

ตารางหลักที่พบ:

- `users`
- `auth_sessions`
- `user_audit_logs`
- `excel_import_batches`
- `lots`
- `lot_audit_logs`
- `lot_attachments`
- `sampling_rules`
- `dimension_instrument_prefixes`
- `form_config`
- `system_setting_audit_logs`
- `dimension_inspections`
- `packing_inspections`
- `dimension_inspection_values`

หมายเหตุ: `docs/project-plan.md` ยังไม่พบใน `BrakeCheck_PG` แม้ถูกระบุในรายการสำรวจ จึงต้องให้ผู้ใช้ยืนยันว่าจะสร้างใหม่หรือนำเข้าจากแหล่งอื่น

## 4. สถานะ PostgreSQL ปัจจุบัน

ข้อมูลจากผู้ใช้:

- PostgreSQL 17 ติดตั้งแล้ว
- Host: `localhost`
- Port: `5432`
- Database: `brakecheck_pg`
- Application user: `brakecheck_app`
- `brakecheck_app` ไม่ใช่ Superuser
- ทดสอบ login เข้า `brakecheck_pg` สำเร็จแล้ว
- Database ยังว่างและยังไม่มี table

ข้อห้าม:

- ห้ามขอหรือแสดง PostgreSQL password ในแชต
- ห้ามอ่านหรือพิมพ์ค่า `.env` จริง
- ห้ามรัน schema/migration จนกว่าผู้ใช้อนุมัติ
- ห้ามสร้าง table ในรอบวางแผน

## 5. Target Architecture

สถาปัตยกรรมเป้าหมาย:

```text
Chrome client
  -> Frontend static files from Node.js/Express
  -> API under /api/*
  -> Node.js/Express backend
  -> PostgreSQL 17 on localhost/server PC
  -> Local storage folders for uploads/exports/attachments
```

หลักการ:

- เครื่องแม่เปิด Node.js server และ PostgreSQL
- เครื่องลูกเปิดเว็บผ่าน Chrome
- เครื่องลูกเรียก API ผ่าน HTTP เท่านั้น
- เครื่องลูกไม่ต่อ database โดยตรง
- PostgreSQL user ของ app มีสิทธิ์เท่าที่จำเป็น
- config จริงอยู่ใน `.env` เท่านั้น
- backup database ใช้ `pg_dump`
- restore ใช้ `psql` หรือ `pg_restore` ตามรูปแบบ backup ที่เลือก

## 6. รายการไฟล์ที่ผูกกับ MySQL

ไฟล์ dependency/config:

| ไฟล์ | สิ่งที่ผูกกับ MySQL | แนวทางเปลี่ยน |
| --- | --- | --- |
| `server/package.json` | dependency `mysql2` | เปลี่ยนเป็น `pg` หลังอนุมัติ |
| `server/package-lock.json` | lock dependency `mysql2` | regenerate หลังติดตั้ง `pg` |
| `.env.example` | ค่า DB เป็น MySQL เช่น port `3306` | เปลี่ยนตัวอย่างเป็น PostgreSQL port `5432` |
| `server/src/config/env.js` | default DB ยังเป็น MySQL | เปลี่ยน default ให้ตรง PostgreSQL |
| `server/src/config/database.js` | `mysql2/promise` pool | เปลี่ยนเป็น `pg` Pool |

ไฟล์ database:

| ไฟล์/โฟลเดอร์ | สิ่งที่ผูกกับ MySQL | แนวทางเปลี่ยน |
| --- | --- | --- |
| `server/src/database/schema.sql` | MySQL schema | สร้าง PostgreSQL schema สำหรับฐานว่าง |
| `server/src/database/seed.sql` | `INSERT IGNORE` | ใช้ `ON CONFLICT DO NOTHING` |
| `server/src/database/migrations/` | MySQL migration syntax | แยกชุด migration PostgreSQL หรือสร้าง baseline schema ใหม่ |

ไฟล์ backend services ที่ใช้ SQL โดยตรง:

- `server/src/scripts/create-admin.js`
- `server/src/services/auth.service.js`
- `server/src/services/auth-session.service.js`
- `server/src/services/database.service.js`
- `server/src/services/dashboard.service.js`
- `server/src/services/dimension-inspection.service.js`
- `server/src/services/excel.service.js`
- `server/src/services/export-dimension.service.js`
- `server/src/services/history.service.js`
- `server/src/services/inspection-queue.service.js`
- `server/src/services/lot-approval-evidence.service.js`
- `server/src/services/lot-attachment.service.js`
- `server/src/services/lot.service.js`
- `server/src/services/packing-inspection.service.js`
- `server/src/services/report-export.service.js`
- `server/src/services/results.service.js`
- `server/src/services/settings.service.js`
- `server/src/services/user.service.js`

ไฟล์ tests ที่ต้องปรับตาม result shape/error code ใหม่:

- `server/src/services/*.test.js`
- `server/src/routes/*.test.js`
- `server/src/scripts/create-admin.test.js`
- `server/src/config/env.test.js`

ไฟล์ scripts/docs:

| ไฟล์/โฟลเดอร์ | สิ่งที่ต้องเปลี่ยน |
| --- | --- |
| `scripts/backup-database.bat` | เปลี่ยน `mysqldump` เป็น `pg_dump` |
| `scripts/auto-backup-database.bat` | เปลี่ยนเป็น PostgreSQL backup |
| `scripts/backup-system.bat` | ปรับคำอธิบาย database backup |
| `scripts/auto-backup-system.bat` | ปรับคำอธิบาย database backup |
| `scripts/check-system.bat` | เปลี่ยนข้อความ MySQL เป็น PostgreSQL |
| `docs/backup-restore-guide.md` | เพิ่ม/เปลี่ยนขั้นตอน PostgreSQL |
| `docs/deployment-guide.md` | เปลี่ยน setup database |
| `docs/go-live-checklist.md` | เปลี่ยน checklist MySQL เป็น PostgreSQL |
| `docs/it-system-report.md` | อัปเดตหลังระบบ PostgreSQL เสร็จ |

## 7. ตารางเปรียบเทียบ MySQL กับ PostgreSQL

| MySQL ปัจจุบัน | PostgreSQL ที่เสนอ | หมายเหตุ |
| --- | --- | --- |
| `mysql2` | `pg` | ต้องอนุมัติก่อนติดตั้ง |
| `createPool` จาก `mysql2/promise` | `Pool` จาก `pg` | ต้องปรับ result shape |
| Placeholder `?` | `$1`, `$2`, `$3` | ต้องแก้ทุก query |
| `AUTO_INCREMENT` | `GENERATED BY DEFAULT AS IDENTITY` | ใช้กับ primary key ใหม่ |
| `BIGINT AUTO_INCREMENT` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | ใช้กับ `auth_sessions.id` |
| `ENUM(...)` | `TEXT/VARCHAR + CHECK` หรือ PostgreSQL enum type | แนะนำ CHECK เพื่อแก้ง่ายกว่าในอนาคต |
| `TINYINT` | `SMALLINT` | PostgreSQL ไม่มี `TINYINT` |
| `DATETIME` | `TIMESTAMP WITHOUT TIME ZONE` | ต้องยืนยัน timezone policy |
| `DATE` | `DATE` | ใช้ต่อได้ |
| `JSON` | `JSONB` | เหมาะกับ query และ index ใน PostgreSQL |
| `BOOLEAN` | `BOOLEAN` | ใช้ต่อได้ |
| `ON UPDATE CURRENT_TIMESTAMP` | trigger หรือ update ผ่าน service | ต้องเลือกแนวทางเดียว |
| `INSERT IGNORE` | `ON CONFLICT DO NOTHING` | ใช้กับ seed/default data |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT (...) DO UPDATE` | ต้องระบุ unique key ชัดเจน |
| `VALUES(column)` | `EXCLUDED.column` | ใช้ใน `ON CONFLICT DO UPDATE` |
| `LAST_INSERT_ID()` | `RETURNING id` | PostgreSQL คืนค่าผ่าน rows |
| `result.insertId` | `rows[0].id` | ต้องปรับ service |
| `result.affectedRows` | `rowCount` | ต้องปรับ validation |
| `REGEXP` | `~` | ใช้ใน CHECK เช่น `prefix ~ '^A-[0-9]{2}-$'` |
| `GET_LOCK` / `RELEASE_LOCK` | advisory lock หรือ transaction lock | แนะนำ `pg_advisory_xact_lock` สำหรับ lock ชั่วคราวใน transaction |
| backtick รอบชื่อ column/table | ไม่ใช้ quote หรือใช้ double quote | แนะนำไม่ quote ถ้าชื่อเป็น snake_case |
| MySQL error `ER_DUP_ENTRY` | PostgreSQL SQLSTATE `23505` | duplicate key |
| MySQL error `ER_NO_SUCH_TABLE` | PostgreSQL SQLSTATE `42P01` | undefined table |
| `mysqldump` | `pg_dump` | backup PostgreSQL |
| `mysql.exe` restore | `psql` หรือ `pg_restore` | แล้วแต่ backup format |

## 8. แผนเปลี่ยน Dependency

Dependency ปัจจุบัน:

- `mysql2` ใช้เชื่อมต่อ MySQL

Dependency ที่เสนอ:

- `pg`

รายละเอียดก่อนอนุมัติ:

| รายการ | คำตอบ |
| --- | --- |
| ใช้ทำอะไร | เชื่อมต่อ Node.js/Express กับ PostgreSQL |
| ทำไมจำเป็น | Node.js ต้องมี driver เพื่อ query PostgreSQL |
| License | MIT ตาม metadata ของ package |
| ค่าใช้จ่าย | ไม่มีค่า license/package |
| ผลต่อความซับซ้อน | ต้องปรับ connection, query placeholder, result shape, error code |
| ทางเลือกไม่เพิ่ม dependency | ไม่มีทางที่เหมาะสม เพราะ Node.js ไม่มี PostgreSQL driver built-in |
| สิ่งที่ไม่ใช้ | ไม่ใช้ ORM เช่น Prisma, Sequelize, TypeORM |

ขั้นตอนในอนาคต:

1. ขออนุมัติจากผู้ใช้ก่อน
2. รัน `npm install pg` ใน `server/`
3. ตรวจ `server/package.json` และ `server/package-lock.json`
4. ยังไม่เชื่อมต่อ database จริงจนกว่าจะมี config และ test พร้อม

## 9. แผนเปลี่ยน Database Connection

ไฟล์หลัก:

- `server/src/config/env.js`
- `server/src/config/database.js`
- `.env.example`

แนวทาง:

- เปลี่ยน default port เป็น `5432`
- เปลี่ยน default database เป็น `brakecheck_pg`
- เปลี่ยน default user เป็น `brakecheck_app`
- ใช้ `.env` จริงเท่านั้นสำหรับ password
- ไม่ print password ใน log
- สร้าง `pg` Pool แทน MySQL pool
- สร้าง helper สำหรับ query ถ้าจำเป็น เพื่อค่อย ๆ แปลง `execute` pattern เดิม

สิ่งที่ต้องระวัง:

- `pg` คืนผลเป็น object เช่น `{ rows, rowCount }`
- MySQL เดิมคืน `[rows]` หรือ `[result]`
- ถ้าแปลงรวดเดียวทั้งระบบ ความเสี่ยงสูง ควรแบ่ง service เป็นกลุ่ม

## 10. แผนแปลง Schema และ Migration

แนวทางที่แนะนำสำหรับฐาน PostgreSQL ว่าง:

- สร้าง PostgreSQL baseline schema ใหม่จาก `server/src/database/schema.sql`
- ไม่พยายามรัน MySQL migration เก่าใน PostgreSQL
- เก็บ migration เก่าไว้เป็นประวัติของระบบ MySQL เดิม
- ใช้ test database `brakecheck_pg` ที่ว่างก่อน
- ยังไม่นำข้อมูลจริงเข้ามา

สิ่งที่ต้องแปลงใน schema:

- primary key identity
- enum/status fields
- timestamp fields
- JSON columns เป็น JSONB
- CHECK constraints
- unique constraints
- foreign keys
- indexes
- updated_at behavior

แนวทาง `updated_at`:

ตัวเลือก A: ให้ service set `updated_at = CURRENT_TIMESTAMP` ทุกครั้งที่ update

- ข้อดี: ง่าย, ไม่ต้อง trigger
- ข้อเสีย: ต้องตรวจทุก UPDATE ให้ครบ

ตัวเลือก B: ใช้ PostgreSQL trigger กลางสำหรับ `updated_at`

- ข้อดี: ใกล้กับ MySQL `ON UPDATE CURRENT_TIMESTAMP`
- ข้อเสีย: มี function/trigger เพิ่ม ต้องอธิบายให้มือใหม่เข้าใจ

คำแนะนำ: ใช้ตัวเลือก B ถ้าต้องการรักษาพฤติกรรมเดิมให้แน่นที่สุด แต่ต้องเขียน migration ให้สั้นและชัดเจน

ข้อควรระวังเรื่อง seed:

- ถ้า seed ระบุ `id` เอง ต้องตรวจ sequence/identity หลัง insert
- ถ้าไม่จำเป็น ควรปล่อยให้ PostgreSQL สร้าง id เอง

## 11. แผนแก้ SQL ใน Service

กลุ่มงาน SQL ที่ต้องแก้:

1. เปลี่ยน placeholder `?` เป็น `$1`, `$2`, `$3`
2. เปลี่ยน result จาก `[rows]` เป็น `rows`
3. เปลี่ยน `insertId` เป็น `RETURNING id`
4. เปลี่ยน `affectedRows` เป็น `rowCount`
5. เปลี่ยน `ON DUPLICATE KEY UPDATE` เป็น `ON CONFLICT`
6. เปลี่ยน `GET_LOCK` / `RELEASE_LOCK`
7. เปลี่ยน MySQL error code เป็น PostgreSQL SQLSTATE
8. ตรวจ date/time functions เช่น `NOW()`, `CURRENT_TIMESTAMP`, date cast
9. ตรวจ `LIMIT/OFFSET` และ parameter binding
10. ตรวจ queries ที่ใช้ `information_schema`

ลำดับแนะนำ:

- เริ่มจาก auth/session เพราะเป็นประตูเข้าใช้งาน
- ต่อด้วย health check
- ต่อด้วย users
- ต่อด้วย lots/import
- ต่อด้วย inspection
- ต่อด้วย approval/history/results/report/export
- ปิดท้าย settings เพราะมี lock และ upsert หลายจุด

## 12. แผนรักษา API และ Frontend

เป้าหมาย:

- Frontend ไม่ควรรู้ว่า backend เปลี่ยนจาก MySQL เป็น PostgreSQL
- API path เดิมควรอยู่เหมือนเดิม
- JSON response เดิมควรเหมือนเดิมให้มากที่สุด
- Error message ฝั่งผู้ใช้ควรยังอ่านง่ายเป็นภาษาไทย

สิ่งที่ต้องทดสอบ:

- Login
- Change Password
- Logout
- Import Excel preview/import
- Manual Lot
- Barcode lookup
- Dimension inspection
- Packing inspection
- Approval/Cancel Approval/Send Back/NG
- Attachment upload/download/delete
- Dashboard
- History
- Results
- Export Report
- Export Dimension
- System Settings

Frontend ที่คาดว่าไม่ควรเปลี่ยนมาก:

- `client/src/app.js`
- `client/src/app.routes.js`
- `client/src/pages/`
- `client/src/services/`

ถ้า API response ไม่เปลี่ยน frontend ควรแก้น้อยมากหรือไม่ต้องแก้

## 13. แผน Auth, Session และ Permission

สิ่งที่ต้องรักษา:

- password ต้อง hash
- login ต้องตรวจ `employee_code`, password, status, lock
- logout ต้อง revoke session
- change password ต้อง revoke session
- role guard ต้องยังแยก `head`, `assistant`, `officer`
- `/api/database/health` ต้องยังให้เฉพาะ `head` และ `assistant`
- reset password โดย `head` ต้องตรวจว่าจะ revoke session เดิมหรือไม่

ตารางที่เกี่ยวข้อง:

- `users`
- `auth_sessions`
- `user_audit_logs`

จุดเสี่ยง:

- token/session หมดอายุผิดเวลา
- SQLSTATE duplicate/constraint handling ผิด
- query เปลี่ยน result shape แล้ว auth ผ่านผิด
- reset password ไม่ revoke session ตาม policy ที่ต้องการ

## 14. แผน Backup/Restore ด้วย pg_dump และ psql

เป้าหมาย:

- เปลี่ยน backup database จาก MySQL เป็น PostgreSQL
- ยังคง backup attachments แยกเหมือนเดิม
- ยังไม่มี restore อัตโนมัติ
- restore ต้องทำกับ test database ก่อนเสมอ

เครื่องมือ:

- `pg_dump`: backup PostgreSQL
- `psql`: restore จาก plain SQL
- `pg_restore`: restore จาก custom format ถ้าเลือกใช้ `pg_dump -Fc`

แนวทางสำหรับมือใหม่:

- `backup-system.bat` ควร backup ทั้ง database และ `storage/attachments`
- database backup อย่างเดียวไม่พอถ้ามีไฟล์แนบ
- backup จริงควร copy ออกนอก repo หรือไปที่บริษัทกำหนด
- ห้าม commit backup, `.sql`, `.zip`, logs หรือข้อมูลจริง

สิ่งที่ต้องให้ IT ยืนยัน:

- PostgreSQL `bin` อยู่ใน PATH หรือไม่
- ต้องใช้ plain SQL หรือ custom format
- backup เก็บที่ไหน
- ใครตรวจ backup log
- retention เก็บกี่วัน
- restore ต้องได้รับอนุมัติจากใคร

## 15. แผน Windows Helper Scripts

ไฟล์ที่คาดว่าจะต้องแก้:

- `scripts/backup-database.bat`
- `scripts/auto-backup-database.bat`
- `scripts/backup-system.bat`
- `scripts/auto-backup-system.bat`
- `scripts/check-system.bat`
- `scripts/start-server.bat`
- `scripts/auto-start-server.bat`
- `scripts/register-auto-backup-task.ps1`

แนวทาง:

- เปลี่ยนข้อความ MySQL เป็น PostgreSQL
- เปลี่ยน `mysqldump` เป็น `pg_dump`
- ไม่ใส่ password ใน `.bat`
- อ่านค่า database จาก `.env`
- error ต้อง pause ให้ผู้ใช้เห็นข้อความ
- ไม่ให้ script restore หรือ migration อัตโนมัติ
- ไม่ให้ script ลบ backup เก่า จนกว่าจะมี retention rule ที่อนุมัติแล้ว

## 16. แผน Testing

Automated tests ที่ควรใช้:

- syntax check สำหรับ JS
- unit tests ของ services ที่ถูกแก้
- route tests สำหรับ auth/database
- frontend tests เฉพาะหน้าที่ response shape อาจกระทบ

Manual tests หลัก:

- `/api/health`
- `/api/database/health`
- Login/logout
- Change password
- Import Excel preview/import ด้วย test data
- Duplicate Lot ใน Excel ต้อง block
- Column T date invalid ต้อง block save
- Barcode lookup จาก Lot Pack
- Dimension inspection save/complete
- Packing inspection save/complete
- Approval lock
- Cancel Approval ก่อนแก้
- History/Audit
- Results read-only
- Export Report
- Export Dimension
- Backup script แบบ dry run หรือ test database

ห้ามทดสอบแบบ destructive กับข้อมูลจริง

## 17. UAT Checklist

UAT คือ User Acceptance Test หรือการให้ผู้ใช้/หัวหน้างานลองใช้งานว่าตรงกับ workflow จริงหรือไม่

Checklist:

- ผู้ใช้ `head` login ได้
- ผู้ใช้ `assistant` login ได้
- ผู้ใช้ `officer` login ได้
- role แต่ละกลุ่มเห็นเมนูถูกต้อง
- import Excel sheet `DATA` ได้
- `.xlsx` และ `.xlsm` ใช้ได้
- duplicate Column A `Lot` ถูก block
- Column R `Lot Pack` ซ้ำได้และเลือก Lot ได้เมื่อเจอหลาย Lot
- Column X `Lot ผลิต` ว่างแล้วใช้ `-`
- Column T date ผิดต้อง block save หรือเตือนตาม rule ที่อนุมัติ
- ตรวจมิติครบแล้วเก็บ snapshot
- ตรวจบรรจุครบแล้วเก็บ snapshot
- approved lot lock
- cancel approval ก่อนแก้
- audit history ครบ
- results page read-only
- export รายงานได้
- export dimension ใช้ completed snapshot
- backup database และ attachments ได้
- restore ซ้อมกับ test database ผ่าน

## 18. แผนย้ายข้อมูลจริงในอนาคต

ยังไม่ทำในช่วงแรก

เมื่อระบบ PostgreSQL ผ่าน test data และ UAT แล้ว ค่อยวางแผนย้ายข้อมูลจริงแยกต่างหาก

แนวทางในอนาคต:

1. Freeze ช่วงเวลาย้ายข้อมูล
2. Backup MySQL เดิมทั้ง database และ attachments
3. Export MySQL data
4. Transform data ให้เข้ากับ PostgreSQL schema
5. Import เข้า PostgreSQL test database
6. ตรวจ record count, key, audit, snapshot, attachments
7. ให้ผู้ใช้ทำ UAT
8. ทำ cutover เฉพาะเมื่อผ่าน
9. เก็บ MySQL เดิมเป็น fallback ตามระยะเวลาที่ตกลง

สิ่งที่ต้องระวัง:

- id mapping
- timestamp/timezone
- JSON compatibility
- enum/status value
- file attachment path
- audit trail
- completed snapshot

## 19. Cutover และ Rollback Plan

Cutover คือการเปลี่ยนระบบใช้งานจริงจาก MySQL เดิมไป PostgreSQL

หลักการ:

- ทำหลัง UAT ผ่านเท่านั้น
- มี backup ก่อน cutover
- มีเวลาหยุดระบบที่ผู้ใช้รับทราบ
- มีคนรับผิดชอบชัดเจน
- มี rollback path กลับไปใช้ MySQL เดิม

Rollback ที่เสนอ:

- ถ้า PostgreSQL ยังไม่ผ่าน UAT ให้ใช้ MySQL เดิมต่อ
- ถ้า cutover แล้วพบปัญหารุนแรง ให้หยุดใช้งาน PostgreSQL และกลับไปเปิดระบบ MySQL เดิม
- ห้าม sync ข้อมูลกลับไป MySQL แบบ manual ถ้าไม่มีแผนชัดเจน เพราะอาจทำให้ข้อมูลไม่ตรงกัน

ข้อห้าม:

- ไม่ dual-write
- ไม่ลบ MySQL เดิม
- ไม่ลบ backup
- ไม่แก้ข้อมูลจริงโดยไม่อนุมัติ

## 20. Security Risks

ความเสี่ยงสำคัญ:

| ความเสี่ยง | ผลกระทบ | แนวทางลดความเสี่ยง |
| --- | --- | --- |
| password/secret หลุด | เข้าระบบหรือ database ได้ | ห้ามพิมพ์ `.env` จริง, ใช้ placeholder |
| app user สิทธิ์สูงเกินไป | query ผิดอาจกระทบทั้ง DB | ใช้ `brakecheck_app` แบบ least privilege |
| SQL แปลงผิด | ข้อมูลผิดหรือ workflow พัง | test ทีละ service |
| session revoke ผิด | token เก่ายังใช้งานได้ | test logout/change password/reset password |
| backup ไม่ครบ attachments | restore แล้วไฟล์แนบหาย | backup database + `storage/attachments` |
| timezone ไม่ชัด | วันที่ผลิต/เวลาตรวจคลาดเคลื่อน | ให้ IT ยืนยัน timezone policy |
| error details หลุด | เห็น SQL/internal path | ใช้ error middleware เดิมและ test error response |
| restore ผิด database | ข้อมูลจริงเสียหาย | restore test database ก่อนเสมอ |

## 21. ตาราง Dependency/License/Cost

| รายการ | ใช้ทำอะไร | License | ค่าใช้จ่าย | หมายเหตุ |
| --- | --- | --- | --- | --- |
| Node.js | runtime backend | Open-source | ไม่มีค่า license | ใช้เดิม |
| Express | API server | MIT | ไม่มีค่า license | ใช้เดิม |
| PostgreSQL 17 | database | PostgreSQL License | ไม่มีค่า license | local-first |
| `pg` | PostgreSQL driver for Node.js | MIT | ไม่มีค่า license | ต้องอนุมัติก่อนติดตั้ง |
| `bcrypt` | password hash | MIT | ไม่มีค่า license | ใช้เดิม |
| `jsonwebtoken` | auth token | MIT | ไม่มีค่า license | ใช้เดิม |
| `exceljs` | อ่าน/เขียน Excel | MIT | ไม่มีค่า license | ใช้เดิม |
| `pdfkit` | export PDF | MIT | ไม่มีค่า license | ใช้เดิม |
| `multer` | upload file | MIT | ไม่มีค่า license | ใช้เดิม |
| `cors` | browser origin control | MIT | ไม่มีค่า license | ใช้เดิม |

สิ่งที่ไม่ใช้:

- Cloud database
- Managed PostgreSQL
- Paid hosting
- Subscription
- Paid license
- ORM ใหม่
- Frontend framework ใหม่

## 22. Open Questions และสิ่งที่ต้องให้ IT ยืนยัน

คำถามสำหรับผู้ใช้/IT:

1. ต้องการให้ `BrakeCheck_PG` เป็น Git repository ใหม่ชื่อ `BrakeCheck-PG` ตอนนี้เลยหรือไม่
2. จะสร้าง `docs/project-plan.md` ใหม่หรือคัดลอกจากเอกสารเดิม
3. ยืนยันว่า `brakecheck_pg` ยังเป็นฐานว่างและใช้สำหรับ test เท่านั้น
4. ยืนยันว่า `brakecheck_app` มีสิทธิ์อะไรบ้าง
5. จะอนุมัติ dependency `pg` หรือไม่
6. ต้องการใช้ timestamp แบบ local time หรือกำหนด timezone ชัดเจน
7. `updated_at` จะใช้ trigger หรือให้ service update เอง
8. enum/status จะใช้ PostgreSQL enum type หรือ `TEXT + CHECK`
9. backup format จะใช้ plain SQL หรือ custom format
10. PostgreSQL `bin` อยู่ใน PATH หรือไม่
11. ใครเป็นผู้ดูแล database password และ `.env`
12. ใครเป็นผู้ดูแล backup/restore
13. ต้องเก็บ backup นานกี่วัน
14. Cutover จะทำช่วงเวลาไหนเมื่อ UAT ผ่าน
15. MySQL เดิมต้องเก็บ fallback นานกี่เดือน

## 23. Checklist และสถานะแต่ละ Phase

สถานะรวม:

- Phase 0 ยังอยู่ในขั้นเอกสารแผน
- ยังไม่แก้โค้ด
- ยังไม่ติดตั้ง dependency
- ยังไม่สร้าง table
- ยังไม่รัน migration
- ยังไม่ย้ายข้อมูลจริง

### Phase 0: Audit และสร้างเอกสารแผน

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | สำรวจ MySQL touchpoints และสร้างแผน PostgreSQL |
| ไฟล์ที่จะเปลี่ยน | `docs/postgresql-migration-plan.md` |
| Database impact | ไม่มี |
| ความเสี่ยง | ต่ำ เป็น docs-only |
| ต้อง backup หรือไม่ | ไม่ต้อง เพราะไม่แตะ database |
| วิธีทดสอบ | ตรวจว่าเอกสารครบหัวข้อและไม่ใส่ secret |
| เงื่อนไขผ่าน | ผู้ใช้/IT อ่านแล้วอนุมัติ phase ถัดไป |
| Rollback | ลบหรือแก้เอกสาร |
| Cost/License | ไม่มี |
| Approval gate | ต้องอนุมัติก่อน Phase 1 |

### Phase 1: ปรับ Project Identity, AGENTS, README และ `.env.example`

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | ให้ project ใหม่สื่อชัดว่าเป็น PostgreSQL version |
| ไฟล์ที่จะเปลี่ยน | `AGENTS.md`, `README.md`, `.env.example`, docs ที่เกี่ยวข้อง |
| Database impact | ไม่มี |
| ความเสี่ยง | ต่ำ แต่ต้องไม่ใส่ secret |
| ต้อง backup หรือไม่ | ไม่ต้อง |
| วิธีทดสอบ | อ่าน diff, ตรวจไม่มี password, ตรวจคำว่า MySQL ที่ควรเหลือเฉพาะประวัติ |
| เงื่อนไขผ่าน | เอกสาร/setup สอดคล้อง PostgreSQL |
| Rollback | revert docs/config example |
| Cost/License | ไม่มี |
| Approval gate | ผู้ใช้อนุมัติให้เริ่ม Phase 1 แล้ว |

### Phase 2: เสนอและติดตั้ง `pg`

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | เพิ่ม PostgreSQL driver |
| ไฟล์ที่จะเปลี่ยน | `server/package.json`, `server/package-lock.json` |
| Database impact | ไม่มี |
| ความเสี่ยง | ต่ำถึงกลาง เพราะ dependency เปลี่ยน |
| ต้อง backup หรือไม่ | ไม่ต้อง |
| วิธีทดสอบ | `npm install`, ตรวจ package, syntax check |
| เงื่อนไขผ่าน | `pg` อยู่ใน dependency และไม่มี package แปลก |
| Rollback | remove `pg`, restore lockfile |
| Cost/License | `pg` MIT, ไม่มีค่า license |
| Approval gate | ต้องอนุมัติ dependency ก่อน |

### Phase 3: PostgreSQL Connection และ Health Check

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | ต่อ PostgreSQL ได้และ health check อ่าน table list ได้ |
| ไฟล์ที่จะเปลี่ยน | `server/src/config/env.js`, `server/src/config/database.js`, `server/src/services/database.service.js`, `server/src/controllers/database.controller.js`, tests |
| Database impact | อ่านอย่างเดียวถ้ายังไม่มี schema |
| ความเสี่ยง | กลาง เพราะเกี่ยวกับ connection |
| ต้อง backup หรือไม่ | ไม่ต้องถ้าใช้ฐานว่าง/test |
| วิธีทดสอบ | `/api/health`, `/api/database/health`, unit tests |
| เงื่อนไขผ่าน | ต่อ PostgreSQL ได้โดยไม่เผย secret |
| Rollback | กลับไป connection เดิมใน branch |
| Cost/License | ไม่มีเพิ่มหลัง Phase 2 |
| Approval gate | ต้องยืนยันฐานเป็น test/local |

### Phase 4: PostgreSQL Schema สำหรับฐานข้อมูลว่าง

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | สร้าง schema PostgreSQL จาก schema MySQL เดิม |
| ไฟล์ที่จะเปลี่ยน | `server/src/database/schema.sql`, อาจสร้าง migration baseline ใหม่ |
| Database impact | สร้าง table ใน PostgreSQL test database |
| ความเสี่ยง | สูงถ้ารันผิด database |
| ต้อง backup หรือไม่ | ต้องยืนยันว่าเป็นฐานว่าง/test ก่อน ถ้าไม่ว่างต้อง backup |
| วิธีทดสอบ | run schema กับ test DB, `/api/database/health` |
| เงื่อนไขผ่าน | 14 tables ครบและ constraints สำคัญครบ |
| Rollback | ใช้ test DB ใหม่ หรือ drop เฉพาะ test DB หลังยืนยัน |
| Cost/License | ไม่มี |
| Approval gate | ต้องอนุมัติ schema และ database target |

### Phase 5: แปลง SQL ใน Services

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | ให้ business logic ทำงานกับ PostgreSQL |
| ไฟล์ที่จะเปลี่ยน | `server/src/services/*.js`, `server/src/scripts/create-admin.js`, tests |
| Database impact | อ่าน/เขียน test data |
| ความเสี่ยง | สูง เพราะแตะ workflow หลัก |
| ต้อง backup หรือไม่ | ถ้าใช้ test DB ว่างไม่ต้อง, ถ้ามีข้อมูลทดสอบสำคัญควร backup |
| วิธีทดสอบ | unit tests + manual workflow ด้วย test data |
| เงื่อนไขผ่าน | import, lot, inspection, approval, results/export ทำงาน |
| Rollback | revert branch หรือใช้ service group ก่อนหน้า |
| Cost/License | ไม่มี |
| Approval gate | แยกอนุมัติเป็นกลุ่ม service |

### Phase 6: Auth, Session และ Permission

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | login/session/role ทำงานถูกต้อง |
| ไฟล์ที่จะเปลี่ยน | `auth.service.js`, `auth-session.service.js`, `user.service.js`, related tests |
| Database impact | เขียน users/session/audit ใน test DB |
| ความเสี่ยง | สูง เพราะเป็น security boundary |
| ต้อง backup หรือไม่ | test DB ไม่ต้อง, real DB ต้อง backup ก่อนเสมอ |
| วิธีทดสอบ | login/logout/change password/reset password/role 401/403 |
| เงื่อนไขผ่าน | token เก่าถูก revoke ตาม policy |
| Rollback | revert auth phase |
| Cost/License | ไม่มี |
| Approval gate | ต้องยืนยัน reset password session policy |

### Phase 7: Backup/Restore และ Windows Scripts

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | backup PostgreSQL และ attachments ได้ |
| ไฟล์ที่จะเปลี่ยน | `scripts/*.bat`, `scripts/*.ps1`, backup/deploy docs |
| Database impact | backup อ่านข้อมูล, restore ต้อง test DB เท่านั้น |
| ความเสี่ยง | สูงถ้าทำ restore ผิดฐาน |
| ต้อง backup หรือไม่ | ก่อน restore ต้องมี backup ปัจจุบัน |
| วิธีทดสอบ | backup test DB, restore เข้า test DB ใหม่ |
| เงื่อนไขผ่าน | ได้ database backup + attachments bundle |
| Rollback | กลับไป script ก่อนหน้าใน branch |
| Cost/License | ไม่มี |
| Approval gate | ต้องให้ IT ยืนยัน PATH/format/retention |

### Phase 8: Automated Tests และ Manual UAT

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | พิสูจน์ว่าระบบ PostgreSQL ทำงานครบ |
| ไฟล์ที่จะเปลี่ยน | tests และ docs checklist ถ้าจำเป็น |
| Database impact | test data เท่านั้น |
| ความเสี่ยง | กลาง |
| ต้อง backup หรือไม่ | ไม่ต้องถ้าเป็น test DB |
| วิธีทดสอบ | automated tests + manual checklist |
| เงื่อนไขผ่าน | tests ผ่านและ UAT ไม่มี blocker |
| Rollback | แก้เฉพาะ phase ที่ fail |
| Cost/License | ไม่มี |
| Approval gate | ต้องผู้ใช้/IT sign off |

### Phase 9: ทดลอง Migration ด้วย Test Data

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | ซ้อมย้ายข้อมูลโดยไม่ใช้ข้อมูลจริง |
| ไฟล์ที่จะเปลี่ยน | อาจมี script migration test เฉพาะหลังอนุมัติ |
| Database impact | เขียน test data |
| ความเสี่ยง | กลาง |
| ต้อง backup หรือไม่ | backup test DB ถ้าต้องเทียบผล |
| วิธีทดสอบ | compare count/key/audit/snapshot |
| เงื่อนไขผ่าน | test data ใช้งานครบ workflow |
| Rollback | recreate test DB |
| Cost/License | ไม่มี |
| Approval gate | ต้องอนุมัติก่อนใช้ข้อมูลจริง |

### Phase 10: วางแผน Production Cutover

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | เตรียมเปลี่ยนระบบจริงอย่างควบคุมได้ |
| ไฟล์ที่จะเปลี่ยน | cutover checklist/docs |
| Database impact | ยังไม่เขียนจริงจนกว่าจะ cutover |
| ความเสี่ยง | สูง |
| ต้อง backup หรือไม่ | ต้อง backup MySQL เดิมและ PostgreSQL ก่อน cutover |
| วิธีทดสอบ | dry run checklist |
| เงื่อนไขผ่าน | ผู้ใช้/IT อนุมัติเวลาและ rollback |
| Rollback | กลับไป MySQL เดิม |
| Cost/License | ไม่มี |
| Approval gate | ต้องมี explicit go-live approval |

### Phase 11: อัปเดต Final IT System Report หลังระบบเสร็จ

| รายการ | รายละเอียด |
| --- | --- |
| เป้าหมาย | ให้เอกสาร IT ตรงกับระบบ PostgreSQL จริง |
| ไฟล์ที่จะเปลี่ยน | `docs/it-system-report.md`, docs อื่นที่เกี่ยวข้อง |
| Database impact | ไม่มี |
| ความเสี่ยง | ต่ำ |
| ต้อง backup หรือไม่ | ไม่ต้อง |
| วิธีทดสอบ | ตรวจเอกสารกับ source truth ล่าสุด |
| เงื่อนไขผ่าน | docs ไม่อ้าง MySQL เป็นระบบหลักผิด ๆ |
| Rollback | revert docs |
| Cost/License | ไม่มี |
| Approval gate | ทำหลัง implementation ผ่าน |

## คำแนะนำลำดับถัดไป

หลังผู้ใช้/IT ตรวจเอกสารนี้แล้ว ขั้นถัดไปที่ปลอดภัยที่สุดคือ Phase 1 แบบ docs/config-example only:

- ปรับ `README.md`
- ปรับ `AGENTS.md`
- ปรับ `.env.example`
- ยังไม่ติดตั้ง `pg`
- ยังไม่แก้ connection
- ยังไม่สร้าง table

หากต้องเริ่ม Phase 2 ต้องขออนุมัติ dependency `pg` แยกอีกครั้งก่อนติดตั้ง
