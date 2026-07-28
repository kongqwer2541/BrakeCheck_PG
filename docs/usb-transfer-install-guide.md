# คู่มือติดตั้ง BrakeCheck จากแฟลชไดรฟ์

คู่มือนี้ใช้สำหรับนำ BrakeCheck จากเครื่องทดสอบที่บ้านไปติดตั้งใหม่บนเครื่องบริษัท โดยสร้าง PostgreSQL 17 ที่สะอาด

## หลักสำคัญ

- ไม่ย้ายฐานทดสอบ `brakecheck_pg` จากเครื่องที่บ้านไปเป็นฐานจริง
- ไม่เชื่อมต่อหรือ Restore ข้อมูลจาก MySQL
- ไม่คัดลอก `.env`, password, token, log, backup หรือข้อมูลทดสอบ
- สร้างฐาน `brakecheck_pg` ใหม่บนเครื่องบริษัท
- เริ่มข้อมูลจริงหลัง IT และผู้ใช้ตรวจ Go-live/UAT ผ่านเท่านั้น

## 1. สิ่งที่ควรมีในแฟลชไดรฟ์

ชุดติดตั้งควรมี:

```text
BrakeCheck_Deployment_YYYY-MM-DD/
  app/
  database-clean/
    schema.sql
  docs/
  installers/
  checksums/
```

ตรวจว่ามีอย่างน้อย:

- source โปรแกรม BrakeCheck
- PostgreSQL 17 installer
- Node.js LTS installer
- `database-clean/schema.sql`
- `.env.example`
- คู่มือติดตั้งและ Go-live checklist
- checksum สำหรับตรวจว่าไฟล์ไม่เสีย

ห้ามมี:

- `.env`
- `node_modules/`
- `backups/`
- log
- `storage/attachments` จากเครื่องทดสอบ
- database backup หรือข้อมูลโรงงานจริง

## 2. ก่อนเสียบแฟลชไดรฟ์กับคอมบริษัท

1. ให้ IT ตรวจแฟลชไดรฟ์ด้วยระบบป้องกันไวรัสของบริษัท
2. ให้ IT ยืนยันโฟลเดอร์ติดตั้ง เช่น `C:\BrakeCheck_PG`
3. ให้ IT ยืนยัน IP เครื่องแม่และ port `3000`
4. ให้ IT เป็นผู้กำหนดรหัส PostgreSQL และผู้รับผิดชอบ backup
5. ห้ามเปิดโปรแกรมจากแฟลชไดรฟ์โดยตรง

## 3. คัดลอกโปรแกรมลงเครื่องบริษัท

1. สร้างโฟลเดอร์ที่ IT อนุมัติ เช่น:

```text
C:\BrakeCheck_PG
```

2. แตกไฟล์โปรแกรมจาก `app/` ลงโฟลเดอร์นี้
3. ตรวจว่ามี `client/`, `server/`, `scripts/`, `docs/` และ `.env.example`
4. เก็บแฟลชไดรฟ์ไว้เป็นชุดติดตั้ง ห้ามใช้เป็นที่รันระบบหรือที่เก็บ backup ประจำ

## 4. ติดตั้งโปรแกรมพื้นฐาน

ให้ IT ติดตั้ง:

- Node.js LTS
- PostgreSQL 17
- Chrome

ตรวจใน PowerShell:

```powershell
node --version
npm --version
Get-Service | Where-Object { $_.Name -like "postgresql*" } | Select-Object Name, Status, StartType
```

PostgreSQL service ควรเป็น `Running` และ `Automatic`

## 5. ติดตั้ง Node.js packages

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์:

```powershell
cd C:\BrakeCheck_PG
npm ci --prefix server
```

ถ้าเครื่องบริษัทไม่มี internet ให้ IT เตรียมวิธีติดตั้ง package ที่บริษัทอนุมัติ ห้ามคัดลอก `node_modules` จากเครื่องอื่นโดยไม่ตรวจสอบ

## 6. สร้าง PostgreSQL ใหม่ที่สะอาด

ใช้ pgAdmin 4 และเชื่อมต่อด้วยบัญชีผู้ดูแล PostgreSQL:

1. สร้าง Login/Group Role ชื่อ `brakecheck_app`
2. เปิดสิทธิ์ `Can login`
3. ตั้งรหัสผ่านใหม่ของเครื่องบริษัท
4. ไม่ให้ role นี้เป็น Superuser
5. สร้าง database ชื่อ `brakecheck_pg`
6. ให้ผู้ดูแล PostgreSQL เป็น owner ของ database ระหว่างลง schema

ข้อควรระวัง:

- ห้ามใช้ฐานทดสอบจากเครื่องที่บ้าน
- ห้าม Restore เข้า `brakecheck_pg` สำหรับการติดตั้งใหม่
- ห้ามใช้ `brakecheck_app` เป็นผู้รัน schema

## 7. ลง schema 14 ตาราง

1. ใน pgAdmin เลือก database `brakecheck_pg`
2. เปิด Query Tool ด้วยบัญชีผู้ดูแล PostgreSQL
3. เปิดไฟล์ `database-clean/schema.sql` หรือ `server/src/database/schema.sql`
4. ตรวจว่าหัว Query Tool แสดง database `brakecheck_pg`
5. กด Execute
6. Refresh `Schemas > public > Tables`

ผ่านเมื่อเห็น 14 ตารางและไม่มี error

Schema จะให้สิทธิ์ runtime ที่จำเป็นแก่ `brakecheck_app` โดยไม่ให้สิทธิ์แก้ schema

## 8. สร้าง `.env` ของบริษัท

1. คัดลอก `.env.example` เป็น `.env`
2. แก้ค่าบนเครื่องบริษัทเท่านั้น
3. ใช้ค่ารูปแบบนี้ โดยแทน placeholder ด้วยค่าจริงของบริษัท:

```text
APP_NAME=BrakeCheck
APP_PORT=3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://<server-ip>:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brakecheck_pg
DB_USER=brakecheck_app
DB_PASSWORD=<company-postgresql-password>
SESSION_SECRET=<random-text-at-least-32-characters>
```

ห้ามส่ง `.env` ในแชต ห้ามคัดลอกกลับไปแฟลชไดรฟ์ และห้าม commit

สร้าง `SESSION_SECRET` ใน PowerShell ได้ด้วย:

```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```

## 9. สร้าง Admin คนแรก

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์:

```powershell
$secureAdminPassword = Read-Host "รหัสผ่านชั่วคราวของ Admin" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secureAdminPassword).Password
npm run create-admin --prefix server
Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
Remove-Variable secureAdminPassword -ErrorAction SilentlyContinue
```

ระบบสร้าง user `admin` role `head` และบังคับเปลี่ยนรหัสผ่านเมื่อ Login ครั้งแรก

ถ้าต้องการเปลี่ยนรหัสพนักงานหรือชื่อ Admin ให้ IT ตั้ง environment ชั่วคราวตาม `server/src/scripts/create-admin.js` โดยห้ามเขียน password ลงไฟล์ script

## 10. ตรวจระบบและเปิด Server

รัน:

```text
scripts\check-system.bat
scripts\start-server.bat
```

เปิด:

```text
http://localhost:3000/
http://localhost:3000/api/health
http://localhost:3000/api/database/health
```

Database health ผ่านเมื่อ:

- engine เป็น PostgreSQL
- database เป็น `brakecheck_pg`
- schema พร้อม
- พบตารางครบ 14 ตาราง

## 11. ตั้งค่าระบบเริ่มต้น

หลัง Admin เปลี่ยนรหัสผ่านแล้ว:

1. เพิ่มผู้ใช้ตาม role จริง
2. ตั้งหัวข้อตรวจมิติ
3. ตั้งหัวข้อตรวจบรรจุ
4. ตั้งจำนวนสุ่มตรวจ
5. ตั้งรหัสเครื่องมือวัด
6. ใช้ข้อมูลทดสอบที่ IT อนุมัติทดสอบ workflow

ยังไม่ควรนำข้อมูลจริงเข้า จนกว่า Go-live checklist ผ่าน

## 12. ทดสอบก่อนเปิดใช้งานจริง

ใช้ `docs/go-live-checklist.md` และตรวจอย่างน้อย:

- Login/Logout/เปลี่ยนรหัสผ่าน
- role และ permission
- Import Excel/Manual Lot
- ตรวจมิติ/ตรวจบรรจุ
- Approved/NG/Cancel Approval
- Results/Summary/Export
- Audit และ Snapshot
- Backup ทั้ง database และ attachments
- Restore ลง test database ชื่อใหม่
- เครื่องลูกเปิดผ่าน `http://<server-ip>:3000/`

## 13. Backup หลังเริ่มใช้งาน

- ใช้ `scripts/backup-system.bat` สำหรับ full backup
- ชุด backup ต้องมี `database.backup`, `attachments.zip`, `backup-info.txt`
- เก็บสำเนาสำคัญนอกเครื่องแม่ตามที่บริษัทอนุมัติ
- ตั้ง Auto Backup หลัง IT ยืนยันเวลา, account และที่เก็บ
- ระบบไม่ลบ backup เก่าอัตโนมัติจนกว่าจะมี retention policy

Restore ต้องทำแบบ Manual ตาม `docs/backup-restore-guide.md` และต้องซ้อมกับ test database ก่อนเสมอ

## 14. เกณฑ์หยุดและถาม IT

หยุดติดตั้งเมื่อ:

- ไม่แน่ใจว่ากำลังใช้ database ใด
- schema ไม่ครบ 14 ตาราง
- `.env` ใช้ `DB_USER=postgres`
- Database health ไม่ผ่าน
- ต้องเปิด firewall แต่ยังไม่ได้รับอนุมัติ
- ต้อง Restore หรือใช้ข้อมูลจริง
- พบไฟล์ลับหรือข้อมูลทดสอบติดมากับแฟลชไดรฟ์

## สรุป

การติดตั้งครั้งนี้คือสร้าง PostgreSQL 17 ใหม่ที่สะอาดบนเครื่องบริษัท ไม่ใช่การย้ายฐาน MySQL หรือฐานทดสอบจากบ้าน หลังติดตั้งต้องผ่าน Go-live/UAT ก่อนเริ่มเก็บข้อมูลจริง
