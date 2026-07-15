# คู่มือ Backup และ Restore

คู่มือนี้ช่วยป้องกันข้อมูล QC หายก่อนอัปเดตระบบ แก้ฐานข้อมูล หรือ Import Excel จำนวนมาก

ไฟล์นี้เป็นแหล่งหลักของเรื่อง Backup และ Restore ทั้งหมด รวมถึง backup ที่สร้างจาก `scripts/backup-system.bat`, `scripts/auto-backup-system.bat`, หรือโฟลเดอร์ Auto Backup ที่มี `database.sql`, `attachments.zip`, และ `backup-info.txt`

ถ้าเอกสารอื่นพูดถึง Restore แบบสั้น ๆ ให้กลับมาอ่านขั้นตอนเต็มในไฟล์นี้ก่อนทำจริง

## เอกสารนี้ใช้เมื่อไหร่

ใช้ไฟล์นี้เมื่อต้อง Backup, Restore, ซ้อม Restore, หรือกู้ข้อมูลจากไฟล์ backup ที่มีอยู่แล้ว

ถ้าต้องติดตั้งระบบใหม่ ให้เริ่มจาก `docs/deployment-guide.md` ก่อน
ถ้าต้องใช้ปุ่ม backup แบบดับเบิลคลิก ให้ดู `docs/windows-button-guide.md` คู่กัน

## Backup คืออะไร

Backup คือการสำรองข้อมูลไว้เป็นไฟล์อีกชุดหนึ่ง เผื่อระบบเสีย แก้ผิด หรือต้องย้อนกลับไปก่อนเกิดปัญหา

สำหรับ BrakeCheck ข้อมูลสำคัญมี 2 ส่วน:

- MySQL: เก็บ Lot, ประวัติ Import, Audit, ใบตรวจ, สถานะงาน QC และข้อมูลไฟล์แนบ
- `storage/attachments`: เก็บไฟล์แนบจริง เช่น PDF หรือรูปภาพที่แนบกับ Lot

ถ้า Backup เฉพาะ MySQL ข้อมูลตรวจจะยังอยู่ แต่ไฟล์แนบจริงอาจหายได้ จึงควร Backup ทั้ง database และ `storage/attachments`

## Restore คืออะไร

Restore คือการนำไฟล์ Backup กลับเข้า database

ระบบ BrakeCheck อ่านข้อมูลจาก MySQL ตามค่า `DB_NAME` ในไฟล์ `.env` ไม่ได้อ่านไฟล์ backup โดยตรง ดังนั้นไฟล์ `.sql` และ `attachments.zip` เป็นเพียงไฟล์ต้นทางสำหรับกู้ข้อมูลกลับเข้า MySQL และโฟลเดอร์ไฟล์แนบ

ข้อควรระวัง: Restore อาจเขียนทับข้อมูลปัจจุบัน ทำให้ข้อมูลที่เพิ่มหลังเวลา Backup หายได้ จึงต้องตรวจให้แน่ใจก่อนว่าใช้ไฟล์ Backup ถูกตัวและ restore ไปยัง database ถูกตัว

## ทำไมข้อมูล QC สำคัญกว่าโค้ด

โค้ดสามารถดึงใหม่จาก GitHub ได้ แต่ข้อมูล QC เป็นบันทึกจริงของโรงงาน ถ้าหายอาจกระทบการตรวจสอบย้อนหลัง การอนุมัติ และรายงานคุณภาพ

ให้ถือว่าข้อมูล QC เป็นข้อมูล production แม้ระบบจะรันอยู่ในเครื่อง local

## ควร Backup ตอนไหน

ควร Backup ก่อนทำงานเหล่านี้:

- ก่อนอัปเดตระบบ
- ก่อน Import Excel จำนวนมาก
- ก่อนแก้ schema ฐานข้อมูล
- ก่อนรัน migration
- ก่อน bulk update หรือแก้ข้อมูลจำนวนมาก
- ก่อนทดสอบคำสั่งที่มีผลกับข้อมูลจริง
- ก่อน restore ข้อมูลชุดอื่น

## Backup ทั้งระบบแบบปุ่มกด

ถ้าต้องการ Backup ให้ครบทั้งข้อมูลตรวจและไฟล์แนบ ให้ใช้:

```text
scripts/backup-system.bat
```

ปุ่มนี้จะทำ 2 อย่าง:

1. Backup MySQL database เป็นไฟล์ `.sql`
2. Backup `storage/attachments` เป็นไฟล์ `.zip`

ไฟล์ backup ทั้งสองไฟล์จะอยู่ใน:

```text
backups/
```

หลัง Backup เสร็จ ควร copy ไฟล์ backup สำคัญออกไปเก็บนอก repo หรือที่เก็บที่บริษัทกำหนด

## Backup ก่อนอัปเดตระบบ

ก่อน pull/merge/อัปเดต version ใหม่ ควรทำ Backup ทั้งระบบก่อนเสมอ โดยเฉพาะถ้า update นั้นมี migration, เปลี่ยน logic การบันทึกข้อมูล หรือเกี่ยวกับไฟล์แนบ

Checklist:

- ตรวจว่าอยู่เครื่อง/database ไหน
- ยืนยันว่าเป็น database จริงหรือ test
- Backup ทั้งระบบด้วย `scripts/backup-system.bat`
- ตรวจว่าได้ทั้งไฟล์ `.sql` ของ database และไฟล์ `.zip` ของ attachments
- สำหรับ backup สำคัญหรือเก็บระยะยาว ให้ copy ไฟล์ออกไปนอก repo หรือที่เก็บที่บริษัทกำหนด
- จดเวลาและเหตุผลของ backup

## Backup ก่อน Import Excel จำนวนมาก

Import Excel อาจเพิ่ม Lot จำนวนมากและกระทบ Dashboard/History

ก่อน import จำนวนมาก:

- Backup database
- ตรวจไฟล์ Excel ว่าเป็น `.xlsx` หรือ `.xlsm`
- ตรวจว่ามี sheet `DATA`
- ตรวจ Column A `Lot` ว่าไม่ซ้ำ
- ทดสอบด้วยไฟล์เล็กก่อนถ้าไม่มั่นใจ

## Backup ก่อนแก้ schema ฐานข้อมูล

Schema คือโครงสร้างฐานข้อมูล เช่น table, column, index, foreign key

ก่อนแก้ schema:

- Backup database
- อ่าน migration ให้เข้าใจก่อน
- ตรวจว่า migration ไม่มี `DROP DATABASE`
- ตรวจว่า migration ไม่มี `DROP TABLE` กับฐานข้อมูลจริง
- ตรวจว่า migration ไม่มี `TRUNCATE TABLE` กับฐานข้อมูลจริง
- ถ้าไม่แน่ใจ ให้หยุดและถามก่อน

## วิธีตั้งชื่อไฟล์ backup

ตั้งชื่อให้รู้ว่า backup จาก database ไหน เวลาไหน และทำก่อนงานอะไร

ตัวอย่าง:

```text
brakecheck_backup_2026-06-11_before_step_8_3.sql
brakecheck_backup_2026-06-11_before_big_excel_import.sql
brakecheck_backup_2026-06-11_before_migration.sql
```

แนะนำให้ใช้วันที่แบบ `YYYY-MM-DD` เพื่อเรียงลำดับง่าย

## ห้าม commit backup ขึ้น GitHub

ห้าม commit ไฟล์ backup database หรือไฟล์ backup attachments ขึ้น GitHub เพราะอาจมีข้อมูลจริงของโรงงาน เช่น Lot, ประวัติ QC, ชื่อผู้ใช้, ข้อมูลลูกค้า, PDF หรือรูปภาพไฟล์แนบ

หมายเหตุ: `scripts/backup-system.bat` และ `scripts/backup-database.bat` จะสร้างไฟล์ในโฟลเดอร์ `backups/` ใต้โปรเจกต์เพื่อให้มือใหม่หาไฟล์ง่าย โฟลเดอร์นี้ถูก `.gitignore` กันไว้แล้ว แต่ backup สำคัญควรถูก copy ไปเก็บนอก repo หรือที่เก็บที่บริษัทกำหนด

ถ้าเผลอวางไฟล์ backup ใน repo:

- อย่า `git add`
- ถ้าไฟล์อยู่ใน `backups/` ให้ตรวจว่า Git ไม่เห็นไฟล์นั้น
- ถ้าไฟล์อยู่นอก `backups/` ให้ย้ายออกไปที่โฟลเดอร์ backup นอกโปรเจกต์
- ตรวจ `git status` อีกครั้ง

## ก่อน Restore ต้องตรวจอะไร

ก่อน restore ให้ตรวจ:

- ไฟล์ backup ถูกตัวหรือไม่
- target database เป็น test หรือ real
- restore จะเขียนทับข้อมูลปัจจุบันหรือไม่
- มี backup ของข้อมูลปัจจุบันก่อน restore หรือยัง
- ผู้ใช้ยืนยันแล้วหรือยัง

ถ้าไม่แน่ใจว่า database เป็นของจริงหรือทดสอบ ให้หยุดและถามก่อน

## มีไฟล์ Backup แล้ว ต้องเรียกใช้งานอย่างไร

หัวข้อนี้ใช้เมื่อข้อมูลหาย ระบบเสีย หรือย้ายเครื่อง แล้วมีไฟล์ backup อยู่แล้ว

ไฟล์ที่ควรมี:

- แบบ Auto Backup ล่าสุด: โฟลเดอร์ `brakecheck_auto_2026-06-30_2230` ที่มี `database.sql`, `attachments.zip`, และ `backup-info.txt`
- แบบ backup เดิม: ไฟล์ database เช่น `brakecheck_backup_20260629-204003.sql` และไฟล์แนบ เช่น `attachments_backup_20260629-204009.zip`

ข้อควรจำ: ให้ restore เข้า test database ก่อนเสมอ อย่า restore ทับ database จริงทันที

### ขั้นที่ 1: นำไฟล์ backup มาไว้ในเครื่องแม่

นำโฟลเดอร์ backup หรือไฟล์ `.sql`/`.zip` มาไว้ในโฟลเดอร์ที่หาเจอง่าย เช่น:

```text
C:\Users\KONG\Documents\BrakeCheck\backups\
```

ถ้าเป็น Auto Backup ล่าสุด path จะหน้าตาประมาณนี้:

```text
C:\Users\KONG\Documents\BrakeCheck\backups\brakecheck_auto_2026-06-30_2230\database.sql
C:\Users\KONG\Documents\BrakeCheck\backups\brakecheck_auto_2026-06-30_2230\attachments.zip
```

ถ้า backup สำคัญถูกเก็บไว้นอก repo หรือที่เก็บของบริษัท ให้ copy กลับมาใช้งานเฉพาะตอน restore

### ขั้นที่ 2: หยุดใช้งานระบบชั่วคราว

ก่อน restore ให้แจ้งผู้ใช้ให้หยุดใช้งาน BrakeCheck ชั่วคราว เช่น:

- หยุด Import Excel
- หยุด Approve
- หยุดแก้ข้อมูล Lot
- หยุดเปิด server ถ้าต้อง restore database จริง

เหตุผล: ป้องกันข้อมูลใหม่ปนกับช่วงที่กำลังกู้คืน

### ขั้นที่ 3: Backup สภาพปัจจุบันก่อน

ถึงข้อมูลจะเสียหรือหายบางส่วน ก็ควร backup สภาพปัจจุบันไว้ก่อน เผื่อต้องย้อนกลับ

ใช้ไฟล์:

```text
scripts\auto-backup-system.bat
```

หลัง backup เสร็จ ให้ตรวจว่าได้โฟลเดอร์ใหม่ใน `backups/` ที่มี:

- `database.sql`
- `attachments.zip`
- `backup-info.txt`

### ขั้นที่ 4: เตรียม test database ใน MySQL

เปิด MySQL แล้วสร้าง database ทดสอบชื่อใหม่ เช่น:

```sql
CREATE DATABASE brakecheck_restore_test
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

ถ้าใช้ MySQL user ตาม `.env` เดิม ให้ตรวจว่า user นั้นมีสิทธิ์กับ test database ด้วย

ตัวอย่างคำสั่งให้สิทธิ์:

```sql
GRANT ALL PRIVILEGES
ON brakecheck_restore_test.*
TO 'ชื่อ_user_mysql'@'localhost';
```

หมายเหตุ:

- เปลี่ยน `ชื่อ_user_mysql` ให้ตรงกับ `DB_USER` ใน `.env`
- ห้ามเขียนรหัสผ่านจริงลงเอกสาร
- ถ้าไม่แน่ใจเรื่องสิทธิ์ MySQL ให้ให้ IT ช่วยตรวจ

### ขั้นที่ 5: Restore ไฟล์ database เข้า test database

เปิด Command Prompt แล้วใช้คำสั่งรูปแบบนี้:

```text
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u ชื่อ_user_mysql -p brakecheck_restore_test < "C:\Users\KONG\Documents\BrakeCheck\backups\brakecheck_auto_2026-06-30_2230\database.sql"
```

ตัวอย่างไฟล์ backup รุ่นเดิม:

```text
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u root -p brakecheck_restore_test < "C:\Users\KONG\Documents\BrakeCheck\backups\brakecheck_backup_20260629-204003.sql"
```

หลังรันคำสั่ง MySQL จะถาม password ให้กรอกรหัสผ่าน MySQL ของเครื่องนั้น

หมายเหตุ:

- คำสั่งนี้เป็นตัวอย่าง ให้เปลี่ยนชื่อ user, database และไฟล์ backup ให้ตรงกับเครื่องจริง
- อย่าใส่รหัสผ่านจริงไว้ในคำสั่งหรือในเอกสาร
- ถ้า restore เข้า test database ไม่ผ่าน ห้าม restore เข้า database จริง

### ขั้นที่ 6: ให้ระบบชี้ไปที่ test database ชั่วคราว

ก่อนแก้ `.env` ให้จดค่าเดิมของ `DB_NAME` ไว้ก่อน เช่น `brakecheck`

จากนั้นแก้ `.env` ชั่วคราว:

```text
DB_NAME=brakecheck_restore_test
```

แล้วเปิด server:

```text
scripts\start-server.bat
```

หลังทดสอบเสร็จ ต้องเปลี่ยน `DB_NAME` กลับเป็น database จริง

### ขั้นที่ 7: ตรวจข้อมูลใน test database

ตรวจอย่างน้อย:

- เปิด `http://localhost:3000/api/health`
- Login ได้
- เปิด `http://localhost:3000/api/database/health` หลัง login ได้
- Lot สำคัญยังอยู่
- ประวัติ Import ยังอยู่
- Audit/History ยังอยู่
- Report หรือ Export เปิดได้
- หน้างาน QC ที่ใช้จริงเปิดได้

ถ้าข้อมูลไม่ครบ ให้หยุดและหาไฟล์ backup ตัวอื่นก่อน

### ขั้นที่ 8: Restore ไฟล์แนบ

ไฟล์แนบจริงอยู่ที่:

```text
storage\attachments\
```

ก่อนเอาไฟล์ backup กลับมา ให้เก็บโฟลเดอร์เดิมไว้ก่อน เช่น rename เป็น:

```text
storage\attachments_before_restore
```

จากนั้นแตกไฟล์:

```text
attachments.zip
```

แล้วนำโฟลเดอร์ `attachments` ที่แตกได้กลับไปไว้ที่:

```text
storage\attachments\
```

หลังแตกไฟล์แล้ว ให้ลองเปิด Lot ที่มีไฟล์แนบ เพื่อตรวจว่า PDF หรือรูปภาพเปิดได้

### ขั้นที่ 9: ถ้า test database ผ่านแล้ว ค่อยวางแผน restore ของจริง

ก่อน restore ทับ database จริง ต้องยืนยันครบทุกข้อ:

- test database restore ผ่านแล้ว
- ไฟล์ `database.sql` หรือ `.sql` ถูกตัว
- ไฟล์ `attachments.zip` หรือ `.zip` ถูกตัว
- backup สภาพปัจจุบันแล้ว
- ไม่มีผู้ใช้กำลังใช้งานระบบ
- หัวหน้า QC หรือ IT อนุมัติแล้ว
- รู้แน่ชัดว่า database จริงชื่ออะไร เช่น `brakecheck`

ถ้าข้อใดข้อหนึ่งยังไม่ชัด ให้หยุดและถามก่อน

### ขั้นที่ 10: Restore เข้า database จริง

เมื่อตรวจทุกอย่างผ่านแล้วเท่านั้น จึงค่อย restore เข้า database จริง

ตัวอย่างรูปแบบคำสั่ง:

```text
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u ชื่อ_user_mysql -p brakecheck < "C:\Users\KONG\Documents\BrakeCheck\backups\brakecheck_auto_2026-06-30_2230\database.sql"
```

หลัง restore database จริงแล้ว ให้เปลี่ยน `.env` กลับมาชี้ database จริง:

```text
DB_NAME=brakecheck
```

แล้วเปิด server ใหม่

### ขั้นที่ 11: ตรวจหลัง restore ของจริง

ตรวจซ้ำ:

- เปิด `http://localhost:3000/api/health`
- Login ได้
- เปิด `http://localhost:3000/api/database/health` หลัง login ได้
- Lot สำคัญยังอยู่
- Import history ยังอยู่
- Audit/History ยังอยู่
- Report/Export ใช้งานได้
- ไฟล์แนบเปิดได้
- ให้ QC ลองใช้งานจริง 1 รอบ

### ข้อห้ามระหว่าง Restore

- ห้าม restore ทับ database จริงทันที
- ห้ามลบ backup เก่า
- ห้าม commit ไฟล์ `.sql` หรือ `.zip`
- ห้ามใส่รหัสผ่านจริงในเอกสาร
- ห้ามใช้ `DROP DATABASE` กับ database จริง
- ถ้าไม่แน่ใจว่าเป็น test หรือ real database ให้หยุดถามก่อน

## บันทึกซ้อม Restore

วันที่ซ้อม: 2026-06-30

ผลลัพธ์: ซ้อม Restore สำเร็จบน test database `brakecheck_restore_test_20260630_082624`

สิ่งที่ตรวจแล้ว:

- Backup database ปัจจุบันก่อน restore แล้ว
- Backup `storage/attachments` ก่อน restore แล้ว
- Restore เข้า test database ชื่อใหม่ ไม่เขียนทับ database จริง
- จำนวนข้อมูลสำคัญหลัง restore ตรงกับต้นทาง เช่น `lots`, `excel_import_batches`, `lot_audit_logs`
- เปิด `/api/health` ผ่าน
- เปิด `/api/database/health` แบบยังไม่ login ได้ `401` ตามที่ควรเป็น
- Login ด้วย user ทดสอบใน test database ผ่าน
- เปิด `/api/database/health` หลัง login แล้วผ่าน และชี้ไปที่ test database ถูกต้อง

หมายเหตุ:

- ไม่แสดงรหัสผ่านจริงหรือค่า `.env` จริงในบันทึกนี้
- ไฟล์ backup อยู่ใน `backups/` และห้าม commit ขึ้น GitHub
- test database นี้สร้างไว้เพื่อยืนยันว่า restore ใช้งานได้จริง
