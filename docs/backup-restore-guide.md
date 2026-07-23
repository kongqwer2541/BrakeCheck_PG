# คู่มือ Backup และ Restore

คู่มือนี้ช่วยป้องกันข้อมูล QC หายก่อนอัปเดตระบบ แก้ฐานข้อมูล หรือ Import Excel จำนวนมาก

ไฟล์นี้เป็นแหล่งหลักของเรื่อง Backup และ Restore ทั้งหมด รวมถึง backup ที่สร้างจาก `scripts/backup-system.bat`, `scripts/auto-backup-system.bat`, หรือโฟลเดอร์ Auto Backup ที่มี `database.backup`, `attachments.zip`, และ `backup-info.txt`

ถ้าเอกสารอื่นพูดถึง Restore แบบสั้น ๆ ให้กลับมาอ่านขั้นตอนเต็มในไฟล์นี้ก่อนทำจริง

## เอกสารนี้ใช้เมื่อไหร่

ใช้ไฟล์นี้เมื่อต้อง Backup, Restore, ซ้อม Restore, หรือกู้ข้อมูลจากไฟล์ backup ที่มีอยู่แล้ว

ถ้าต้องติดตั้งระบบใหม่ ให้เริ่มจาก `docs/deployment-guide.md` ก่อน
ถ้าต้องใช้ปุ่ม backup แบบดับเบิลคลิก ให้ดู `docs/windows-button-guide.md` คู่กัน

## Backup คืออะไร

Backup คือการสำรองข้อมูลไว้เป็นไฟล์อีกชุดหนึ่ง เผื่อระบบเสีย แก้ผิด หรือต้องย้อนกลับไปก่อนเกิดปัญหา

สำหรับ BrakeCheck ข้อมูลสำคัญมี 2 ส่วน:

- PostgreSQL: เก็บ Lot, ประวัติ Import, Audit, ใบตรวจ, สถานะงาน QC และข้อมูลไฟล์แนบ
- `storage/attachments`: เก็บไฟล์แนบจริง เช่น PDF หรือรูปภาพที่แนบกับ Lot

ถ้า Backup เฉพาะ PostgreSQL ข้อมูลตรวจจะยังอยู่ แต่ไฟล์แนบจริงอาจหายได้ จึงควร Backup ทั้ง database และ `storage/attachments`

## Restore คืออะไร

Restore คือการนำไฟล์ Backup กลับเข้า database

เมื่อเปิดระบบด้วย `scripts\start-server.bat` ระบบ BrakeCheck จะอ่าน PostgreSQL ตามค่า `DB_NAME` ในไฟล์ `.env` ไม่ได้อ่านไฟล์ backup โดยตรง ดังนั้นไฟล์ `database.backup` และ `attachments.zip` เป็นเพียงไฟล์ต้นทางสำหรับกู้ข้อมูลกลับเข้า PostgreSQL และโฟลเดอร์ไฟล์แนบ

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

1. Backup PostgreSQL database เป็นไฟล์ `database.backup`
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
- ตรวจว่าได้ทั้งไฟล์ `database.backup` ของ database และไฟล์ `.zip` ของ attachments
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
brakecheck_backup_2026-06-11_before_step_8_3.backup
brakecheck_backup_2026-06-11_before_big_excel_import.backup
brakecheck_backup_2026-06-11_before_migration.backup
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

- แบบ Auto Backup ล่าสุด: โฟลเดอร์ `brakecheck_auto_2026-06-30_2230` ที่มี `database.backup`, `attachments.zip`, และ `backup-info.txt`
- แบบ backup เดิม: ถ้าเป็นไฟล์ `.sql` จากระบบ MySQL เดิม ให้หยุดและถาม IT ก่อน เพราะคู่มือนี้ใช้ PostgreSQL custom backup (`.backup`)

ข้อควรจำ: ให้ restore เข้า test database ก่อนเสมอ อย่า restore ทับ database จริงทันที

### ขั้นที่ 1: นำไฟล์ backup มาไว้ในเครื่องแม่

นำโฟลเดอร์ backup หรือไฟล์ `.backup`/`.zip` มาไว้ในโฟลเดอร์ที่หาเจอง่าย เช่น:

```text
C:\Users\KONG\Documents\BrakeCheck_PG\backups\
```

ถ้าเป็น Auto Backup ล่าสุด path จะหน้าตาประมาณนี้:

```text
C:\Users\KONG\Documents\BrakeCheck_PG\backups\brakecheck_auto_2026-06-30_2230\database.backup
C:\Users\KONG\Documents\BrakeCheck_PG\backups\brakecheck_auto_2026-06-30_2230\attachments.zip
```

ถ้า backup สำคัญถูกเก็บไว้นอก repo หรือที่เก็บของบริษัท ให้ copy กลับมาใช้งานเฉพาะตอน restore

ก่อน Restore ให้เลือกไฟล์ `database.backup` จากชุด Backup ที่ต้องการให้ชัดเจน ตรวจชื่อโฟลเดอร์และ `backup-info.txt` ในชุดเดียวกันก่อน แล้วเปิด PowerShell ที่โฟลเดอร์โปรเจกต์และรัน:

```powershell
$backupPath = (Read-Host "วางพาธเต็มของไฟล์ database.backup ที่ต้องการตรวจ").Trim().Trim('"')
if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
  throw "ไม่พบไฟล์ Backup ตามพาธที่ระบุ"
}
Write-Host "กำลังตรวจไฟล์: $backupPath"
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list $backupPath
```

ผลที่ผ่านต้องแสดงรายการ `TABLE`, `SEQUENCE` หรือ `TABLE DATA` โดยไม่มีข้อความ `error` หรือ `invalid archive` คำสั่งนี้อ่านไฟล์ที่ผู้ใช้ระบุเท่านั้นและยังไม่ Restore ข้อมูล

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

- `database.backup`
- `attachments.zip`
- `backup-info.txt`

ถ้าชื่อโฟลเดอร์ลงท้ายด้วย `.incomplete` แปลว่า Backup ไม่สำเร็จครบชุด ห้ามนำโฟลเดอร์นั้นไป Restore ให้ตรวจข้อความ Error แล้วสร้าง Backup ชุดใหม่

### ขั้นที่ 4: เตรียม test database ใน PostgreSQL

เปิด pgAdmin แล้วสร้าง database ทดสอบชื่อใหม่บน `PostgreSQL 17` ตามขั้นตอนนี้:

1. ขยาย `PostgreSQL 17` แล้วคลิกขวา `Databases`
2. เลือก `Create` > `Database`
3. ตั้งชื่อไม่ซ้ำ เช่น `brakecheck_restore_test_20260722`
4. ตั้ง Owner เป็น `postgres`
5. กด Save แล้วตรวจว่าฐานใหม่ยังว่าง

อย่าเลือก `brakecheck_pg` และอย่าใช้คำสั่งลบหรือเขียนทับ database เดิม ถ้าชื่อ test database มีอยู่แล้ว ให้สร้างชื่อใหม่แทนการลบฐานเดิม

### ขั้นที่ 5: Restore ไฟล์ database เข้า test database

การ Restore เป็นขั้นตอน Manual เท่านั้น ให้ IT หรือผู้ที่ได้รับอนุมัติทำกับ database ทดสอบที่ว่าง

ถ้าใช้ pgAdmin ให้คลิกขวา test database แล้วเลือก `Restore` จากนั้นตั้งค่า:

- General: Format เป็น `Custom or tar`, เลือก `database.backup` และ Role name เป็น `postgres`
- Data Options: เปิด `Owner` ในส่วน `Do not save` แต่ปิด `Privileges`
- Query Options: ปิด `Include CREATE DATABASE statement`, `Clean before restore` และ `Include IF EXISTS clause`
- Query Options: เปิด `Single transaction`
- Options: เปิด `Exit on error` และปิด `Use SET SESSION AUTHORIZATION`

การปิด `Privileges` ในส่วน `Do not save` หมายถึงให้ Restore สิทธิ์เดิมของ `brakecheck_app` กลับมาด้วย ก่อนกด Restore ให้ตรวจชื่อ database ด้านบนอีกครั้งว่าคือ test database

ถ้าใช้ Command Prompt ให้ใช้คำสั่งรูปแบบนี้:

```text
pg_restore --host=localhost --port=5432 --username=postgres --dbname=brakecheck_restore_test_20260722 --no-owner --single-transaction --exit-on-error "C:\Users\KONG\Documents\BrakeCheck_PG\backups\brakecheck_auto_2026-06-30_2230\database.backup"
```

หลังรันคำสั่ง PostgreSQL จะถาม password ให้กรอกรหัสผ่านของเครื่องนั้นในช่องถามเท่านั้น

หมายเหตุ:

- คำสั่งนี้เป็นตัวอย่าง ให้เปลี่ยนชื่อ role, database และไฟล์ backup ให้ตรงกับเครื่องจริง
- อย่าใส่รหัสผ่านจริงไว้ในคำสั่งหรือในเอกสาร
- ใช้ `postgres` เฉพาะงาน Restore ส่วนแอปต้องกลับไปใช้ `brakecheck_app` ตาม `.env`
- ถ้า restore เข้า test database ไม่ผ่าน ห้าม restore เข้า database จริง
- ห้ามเติม `--clean`, `--create` หรือคำสั่งลบใด ๆ ในการซ้อม Restore

### ขั้นที่ 6: ให้ระบบชี้ไปที่ test database ชั่วคราว

1. ปิด BrakeCheck Server และหน้าต่าง Terminal ของ Server เดิม
2. ก่อนแก้ `.env` ให้จดค่าเดิมของ `DB_NAME` ไว้ก่อน เช่น `brakecheck_pg`
3. ตรวจว่ามีค่า `DB_NAME` ค้างอยู่ใน Terminal, Windows User หรือ Windows Machine หรือไม่:

```powershell
Get-Item Env:DB_NAME -ErrorAction SilentlyContinue
[Environment]::GetEnvironmentVariable('DB_NAME', 'User')
[Environment]::GetEnvironmentVariable('DB_NAME', 'Machine')
```

ถ้าพบบรรทัดใดมีชื่อ database แสดงอยู่ ให้ปิด Server เดิมก่อน และใช้ `scripts\start-server.bat` เปิดระบบทุกครั้ง เพราะปุ่มนี้จะกันค่าที่ค้างไม่ให้แทนค่าใน `.env` ถ้าจำเป็นต้องใช้ `npm start` โดยตรง ให้ IT ตรวจและลบค่า Windows User/Machine ที่ค้างก่อน

สำหรับ Terminal ปัจจุบัน สามารถล้างเฉพาะค่าชั่วคราวได้ด้วยคำสั่งนี้:

```powershell
Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
```

4. แก้เฉพาะ `DB_NAME` ในไฟล์ `.env` ที่โฟลเดอร์หลักของโปรเจกต์ชั่วคราว:

```text
DB_NAME=brakecheck_restore_test_20260722
```

5. เปิด Server ใหม่:

```text
scripts\start-server.bat
```

6. เปิด Chrome Incognito แล้ว Login ใหม่ อย่าใช้หน้าที่เปิดค้างจาก Server เดิม
7. เปิด `/api/database/health` หลัง Login แล้วตรวจว่าช่อง `database` ตรงกับ test database ทุกตัวอักษร ถ้าไม่ตรง ห้ามทดสอบต่อ

หน้าเว็บสามารถเปิดได้แม้ database เชื่อมต่อไม่ได้ จึงต้องใช้การ Login และ database health เป็นตัวยืนยัน หลังทดสอบเสร็จให้ปิด Server เปลี่ยน `DB_NAME` กลับเป็น `brakecheck_pg` ล้าง `Env:DB_NAME` อีกครั้ง แล้วเปิดด้วย `scripts\start-server.bat` จากนั้นตรวจ `/api/database/health` ว่าช่อง `database` กลับมาเป็น `brakecheck_pg` ก่อนใช้งานต่อ

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

สำหรับการซ้อม Restore ห้ามย้ายหรือเขียนทับไฟล์แนบจริงที่:

```text
storage\attachments\
```

ให้แตก `attachments.zip` ไปยังโฟลเดอร์ทดสอบ เช่น:

```text
backups\attachments_restore_test\
```

จากนั้นเปิด Query Tool ของ test database แล้วรันคำสั่งแบบอ่านอย่างเดียว:

```sql
SELECT
  l.lot_number AS lot,
  la.original_name,
  la.stored_name,
  la.file_size
FROM public.lot_attachments AS la
JOIN public.lots AS l ON l.id = la.lot_id
WHERE la.deleted_at IS NULL
ORDER BY la.id;
```

นำค่า `stored_name` ไปเทียบกับชื่อไฟล์ที่แตกออกมา แล้วตรวจว่าแสดงหมายเลข Lot, ขนาดไฟล์มากกว่า 0 และเปิด PDF หรือรูปภาพได้จริง การนำไฟล์กลับไปไว้ที่ `storage\attachments\` ทำเฉพาะ Restore จริงหลังได้รับอนุมัติและเก็บโฟลเดอร์ปัจจุบันไว้แล้วเท่านั้น

### ขั้นที่ 9: ถ้า test database ผ่านแล้ว ค่อยวางแผน restore ของจริง

ก่อน restore ทับ database จริง ต้องยืนยันครบทุกข้อ:

- test database restore ผ่านแล้ว
- ไฟล์ `database.backup` ถูกตัว
- ไฟล์ `attachments.zip` หรือ `.zip` ถูกตัว
- backup สภาพปัจจุบันแล้ว
- ไม่มีผู้ใช้กำลังใช้งานระบบ
- หัวหน้า QC หรือ IT อนุมัติแล้ว
- รู้แน่ชัดว่า database จริงชื่ออะไร เช่น `brakecheck_pg`

ถ้าข้อใดข้อหนึ่งยังไม่ชัด ให้หยุดและถามก่อน

### ขั้นที่ 10: Restore เข้า database จริง (Manual เท่านั้น)

เมื่อตรวจทุกอย่างผ่านแล้วเท่านั้น จึงค่อยให้ IT หรือผู้มีอำนาจอนุมัติดำเนินการ Restore จริง

คู่มือนี้ไม่สั่ง Restore จริงให้อัตโนมัติ และไม่ให้ผู้ใช้ทั่วไปนำคำสั่งไปกดเอง เพราะอาจเขียนทับข้อมูล production ได้ ให้ IT ตรวจชื่อ database, role, สิทธิ์ และวิธี Restore ที่องค์กรอนุมัติก่อนทุกครั้ง

หลัง Restore database จริงแล้ว ให้ตรวจและตั้ง `.env` ให้ชี้ database จริง:

```text
DB_NAME=brakecheck_pg
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
- ห้าม commit ไฟล์ `.backup`, `.sql` หรือ `.zip`
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

### รอบวันที่ 2026-07-22

ผลลัพธ์: ซ้อม Restore สำเร็จบน test database `brakecheck_restore_test_20260722`

สิ่งที่ตรวจแล้ว:

- Necessary tests ผ่าน: ตรวจชุด Backup, `pg_restore --list`, Restore database, Login, Users, Lot, Audit, ผลตรวจ, Export และไฟล์แนบ
- Security tests ผ่าน: ไม่พบ password/secret ใน log หรือ Task Scheduler, Backup ถูก Git ignore และไม่ได้ Restore ทับ `brakecheck_pg`
- Edge cases ผ่าน: Backup ซ้ำไม่เขียนทับไฟล์เดิม, ไม่ลบ Backup เก่า และ Dry Run ไม่สร้างไฟล์
- แตก `attachments.zip` ในโฟลเดอร์ทดสอบและเทียบ `stored_name` กับ Lot โดยไม่เขียนทับ `storage\attachments`
- หลังทดสอบเปลี่ยน `DB_NAME` กลับเป็น `brakecheck_pg`
