# คู่มือย้าย BrakeCheck ด้วยแฟลชไดรฟ์

คู่มือนี้สำหรับมือใหม่ที่ต้องการย้ายโปรแกรม BrakeCheck จากคอมที่บ้านไปติดตั้งบนคอมบริษัท โดยไม่ใช้ Git เป็นหลัก

เป้าหมายคือย้ายอย่างปลอดภัย ไม่ทำฐานข้อมูลหาย และไม่เปิดเผยรหัสผ่านหรือข้อมูลจริงเกินจำเป็น

## อ่านตรงนี้ก่อน

- ไฟล์นี้เป็นคู่มือหลักเฉพาะการย้ายด้วยแฟลชไดรฟ์
- ถ้าต้องตั้งเครื่องแม่/เครื่องลูก, IP, Firewall หรือ CORS แบบใช้งานจริง ให้ดู `docs/deployment-guide.md`
- ถ้าต้องกู้ข้อมูลหรือ Restore แบบละเอียด ให้ดู `docs/backup-restore-guide.md`
- ถ้าต้องใช้ปุ่ม `.bat` เช่น เปิด server หรือ backup ให้ดู `docs/windows-button-guide.md`
- ถ้าติดปัญหาระหว่างทดสอบ ให้ดู `docs/troubleshooting.md`
- ตัวโปรแกรม BrakeCheck กับฐานข้อมูล MySQL เป็นคนละส่วน
- ถ้าต้องการข้อมูลเดิม ต้องย้ายทั้งโฟลเดอร์โปรแกรมและไฟล์ backup ฐานข้อมูล `.sql`
- ถ้าระบบมีไฟล์แนบ ต้องย้าย backup ของ `storage/attachments` ด้วย
- ไม่ควรคัดลอกโฟลเดอร์ Data ของ MySQL โดยตรง เพราะเสี่ยงเสียหายและกู้ยาก
- ห้ามอัปโหลด `.env`, `backups/`, `*.sql`, หรือไฟล์ backup จริงขึ้น GitHub

คำศัพท์สั้น ๆ:

- โปรแกรม: โฟลเดอร์ BrakeCheck ที่มี `client/`, `server/`, `docs/`, `scripts/`
- Database: ฐานข้อมูล MySQL ที่เก็บ Lot, ประวัติ, Audit, รายงาน และข้อมูล QC
- Backup: ไฟล์สำรองข้อมูล เช่น `.sql` สำหรับฐานข้อมูล และ `.zip` สำหรับไฟล์แนบ
- Restore: การนำไฟล์ backup กลับเข้า MySQL

## ภาพรวมการย้ายระบบ

การย้าย BrakeCheck มี 2 ส่วนหลัก:

1. ย้ายตัวโปรแกรม
2. ย้ายข้อมูลเดิมจาก MySQL ด้วยไฟล์ backup

ถ้าย้ายเฉพาะโฟลเดอร์โปรแกรม ระบบอาจเปิดได้ แต่จะไม่มีข้อมูลเดิม ถ้าต้องการข้อมูลเดิม ต้องมีไฟล์ backup `.sql` ที่ backup จากคอมที่บ้าน

ถ้ามีไฟล์แนบ เช่น PDF หรือรูปภาพที่แนบกับ Lot ให้ใช้ `scripts/backup-system.bat` เพื่อได้ทั้ง:

- ไฟล์ฐานข้อมูล `.sql`
- ไฟล์แนบ `.zip` จาก `storage/attachments`

ห้ามคัดลอกโฟลเดอร์ Data ของ MySQL โดยตรง เช่น `C:\ProgramData\MySQL\...` เพราะอาจใช้ไม่ได้กับเครื่องใหม่ และเสี่ยงทำข้อมูลเสีย

## สิ่งที่ต้องเตรียมบนคอมที่บ้าน

เตรียมให้ครบก่อนเสียบแฟลชไดรฟ์:

- โฟลเดอร์โปรแกรม BrakeCheck
- ไฟล์ backup ฐานข้อมูล `.sql`
- ไฟล์ backup ไฟล์แนบ `.zip` ถ้ามี
- ไฟล์ `.env.example`
- คู่มือใน `docs/`
- ปุ่มกดใน `scripts/`
- แฟลชไดรฟ์ที่มีพื้นที่พอ

ไฟล์ `.env` มีรหัสผ่านจริง จึงไม่ควรคัดลอกไปแบบไม่จำเป็น ถ้าจำเป็นต้องดูค่าเดิม ให้เปิดดูเฉพาะบนเครื่องที่ปลอดภัย และอย่าส่งขึ้น GitHub

## สิ่งที่ควรคัดลอกลงแฟลชไดรฟ์

ตัวอย่างโครงสร้างในแฟลชไดรฟ์:

```text
FlashDrive/
  BrakeCheck/
    client/
    server/
    docs/
    scripts/
    storage/  (โฟลเดอร์ระบบหรือโฟลเดอร์เปล่า)
    README.md
    AGENTS.md
    package.json
    .env.example
  database-backup/
    brakecheck_backup_YYYY-MM-DD_HHMM.sql
    attachments_backup_YYYY-MM-DD_HHMM.zip
  notes/
    install-note.txt
```

หมายเหตุ:

- `database-backup/` เป็นโฟลเดอร์แยกบนแฟลชไดรฟ์ ไม่ใช่โฟลเดอร์ที่จะ commit
- ชื่อไฟล์ backup จริงอาจต่างจากตัวอย่าง ให้ดูวันที่และเวลาที่ backup
- ถ้าไม่มีไฟล์แนบ อาจไม่มีไฟล์ `attachments_backup_...zip`
- ถ้า `storage/attachments` มีไฟล์จริง ให้ย้ายด้วยไฟล์ `attachments_backup_...zip` และเก็บแฟลชไดรฟ์ให้ปลอดภัย

## สิ่งที่ต้องระวังไม่ให้หลุด

ไฟล์เหล่านี้อาจมีข้อมูลจริงหรือรหัสผ่าน:

- `.env` มีรหัสผ่านฐานข้อมูลและ `SESSION_SECRET`
- `backups/` มีไฟล์ backup จริง
- `*.sql` มีข้อมูลฐานข้อมูลจริง
- `attachments_backup_...zip` อาจมีไฟล์แนบจริงของ Lot

ข้อควรทำ:

- เก็บแฟลชไดรฟ์ให้ปลอดภัย
- ไม่ส่งไฟล์ backup ให้คนที่ไม่เกี่ยวข้อง
- ไม่อัปโหลด `.env`, `backups/`, `*.sql`, หรือ backup `.zip` ขึ้น GitHub
- ถ้าต้องส่งให้ IT ให้ส่งผ่านช่องทางที่บริษัทอนุญาต

## วิธี Backup ฐานข้อมูลจากคอมที่บ้าน

วิธีที่แนะนำที่สุดคือ backup ทั้งระบบ:

```text
scripts/backup-system.bat
```

ปุ่มนี้จะ backup:

- MySQL database เป็นไฟล์ `.sql`
- `storage/attachments` เป็นไฟล์ `.zip`

ถ้าต้องการ backup เฉพาะฐานข้อมูล:

```text
scripts/backup-database.bat
```

ถ้าในอนาคตมีไฟล์ `scripts/auto-backup-database.bat` ในโปรเจกต์รุ่นนั้น ให้ใช้ตามคู่มือของรุ่นนั้นได้ แต่ใน repo ปัจจุบันให้ใช้ `backup-system.bat` หรือ `backup-database.bat` เป็นหลัก

หลัง backup เสร็จ ให้ตรวจ:

- มีไฟล์ `.sql` จริง
- ขนาดไฟล์ไม่ใช่ `0 KB`
- ถ้ามีไฟล์แนบ ให้มีไฟล์ `.zip` จริง
- จดวันที่และเวลาที่ backup
- ถ้ามี External Harddisk ให้เก็บสำเนาอีกชุดไว้ด้วย

ถ้าระบบถามรหัสผ่าน MySQL ให้กรอกรหัสของเครื่องนั้น แต่ห้ามจดรหัสผ่านจริงลงในคู่มือนี้หรือไฟล์ note ที่จะส่งต่อ

## สิ่งที่ต้องเตรียมบนคอมบริษัท

รายละเอียดการตั้งเครื่องแม่/เครื่องลูกและ network แบบเต็มอยู่ใน `docs/deployment-guide.md`

คอมบริษัทที่จะเป็นเครื่องแม่ควรมี:

- Chrome
- Node.js
- MySQL
- VS Code ถ้าต้องใช้เปิดดูหรือแก้ไฟล์
- สิทธิ์ติดตั้งโปรแกรม หรือให้ IT ช่วยติดตั้ง
- สิทธิ์เปิด port `3000` ถ้าจะให้เครื่องอื่นเข้าใช้งาน
- พื้นที่เก็บ backup
- เครื่องควรเปิดใช้งานประจำ เพราะถ้าเครื่องแม่ปิด เครื่องลูกจะเข้าไม่ได้

เครื่องลูกเครื่องอื่น ๆ ไม่ต้องติดตั้ง BrakeCheck ทั้งชุด แค่มี Chrome และอยู่ใน network เดียวกับเครื่องแม่

## วิธีคัดลอกโปรแกรมลงคอมบริษัท

แนะนำวางโปรแกรมไว้ที่:

```text
C:\BrakeCheck\
```

หรือ:

```text
D:\BrakeCheck\
```

ไม่แนะนำวางไว้บน Desktop เพราะย้ายยากและเสี่ยงถูกลบง่าย

ถ้าเครื่องบริษัทเคยติดตั้ง BrakeCheck แล้ว:

- ห้ามคัดลอกทับ `.env` เดิม
- ห้ามคัดลอกทับ `backups/`
- ห้ามลบโฟลเดอร์เก่าทันที

ถ้าเป็นการอัปเดตเวอร์ชันใหม่ ให้แยกโฟลเดอร์ก่อน เช่น:

```text
C:\BrakeCheck_old\
C:\BrakeCheck_new\
```

ทดสอบโฟลเดอร์ใหม่ให้ผ่านก่อน แล้วค่อยตัดสินใจใช้งานจริง

## วิธีติดตั้ง package

Package คือไฟล์ library ที่ Node.js ใช้รันระบบ

ถ้ามี internet บนคอมบริษัท ให้เปิด PowerShell แล้วรัน:

```powershell
cd C:\BrakeCheck\server
npm install
```

หรือรันจาก root ของโปรเจกต์:

```powershell
cd C:\BrakeCheck
npm install --prefix server
```

เมื่อติดตั้งสำเร็จ จะมีโฟลเดอร์ `server\node_modules`

ถ้าคอมบริษัทไม่มี internet อาจต้องเตรียม dependency ล่วงหน้า หรือให้ IT ช่วยติดตั้งจากเครื่องที่มี internet

อย่าแก้ `package.json` หรือเพิ่ม dependency ใหม่เองถ้ายังไม่ได้รับอนุมัติ

## วิธีตั้งค่า `.env`

โปรเจกต์นี้ใช้ไฟล์ `.env` ที่ root ของโปรเจกต์ เช่น:

```text
C:\BrakeCheck\.env
```

ให้คัดลอกจากไฟล์ตัวอย่าง:

```powershell
copy .env.example .env
```

จากนั้นเปิด `.env` แล้วใส่ค่าของเครื่องบริษัท เช่น:

```text
DB_HOST=localhost
DB_PORT=3306
DB_NAME=brakecheck
DB_USER=ชื่อ_user_mysql
DB_PASSWORD=กรอกในไฟล์จริงเท่านั้น_ห้ามใส่ในเอกสาร
SESSION_SECRET=ข้อความสุ่มยาวอย่างน้อย_32_ตัวอักษร
```

ข้อควรระวัง:

- ห้ามใช้รหัสผ่านจริงในเอกสาร
- ห้ามส่งไฟล์ `.env` ขึ้น GitHub
- ถ้าเครื่องบริษัทเคยมี `.env` อยู่แล้ว ห้ามทับทันที ให้ backup หรือให้ IT ตรวจ
- ถ้าไม่รู้ค่า MySQL ให้ถาม IT หรือคนที่ติดตั้ง MySQL

## วิธีสร้างฐานข้อมูลบนคอมบริษัท

MySQL ต้องมี database ที่ BrakeCheck ใช้ เช่น:

```sql
CREATE DATABASE brakecheck
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

เหตุผลที่ใช้ `utf8mb4` คือรองรับภาษาไทยและตัวอักษรพิเศษได้ดีกว่า

ข้อห้ามสำคัญ:

- ห้าม `DROP DATABASE` ถ้ามีข้อมูลจริงอยู่แล้ว
- ห้าม reset database ถ้ายังไม่แน่ใจว่าเป็นฐานข้อมูลทดสอบหรือฐานข้อมูลจริง
- ห้าม restore ทับ database จริงถ้ายังไม่ได้ backup สภาพปัจจุบัน

ถ้าไม่มั่นใจ ให้ให้ IT ช่วยสร้าง database และ user ให้ตรงกับค่าใน `.env`

## วิธี Restore ฐานข้อมูลจากไฟล์ `.sql`

Restore คือการเอาข้อมูลจากไฟล์ backup เข้า MySQL เครื่องบริษัท

ขั้นตอน Restore แบบละเอียดและปลอดภัยให้ใช้ `docs/backup-restore-guide.md` เป็นไฟล์หลัก หัวข้อนี้เป็นเพียงสรุปสำหรับงานย้ายด้วยแฟลชไดรฟ์

ก่อน restore ให้ตรวจ:

- ไฟล์ `.sql` ถูกตัว
- database เป้าหมายถูกตัว
- backup สภาพปัจจุบันของเครื่องบริษัทแล้ว ถ้าเคยมีข้อมูลเดิม
- ไม่มีผู้ใช้กำลังใช้งานระบบ

แนะนำให้ restore ลงฐานข้อมูลทดสอบก่อน ถ้าเป็นไปได้ เช่น:

```sql
CREATE DATABASE brakecheck_restore_test
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

ตัวอย่างรูปแบบคำสั่ง restore:

```text
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -P 3306 -u ชื่อ_user_mysql -p brakecheck < "D:\database-backup\ชื่อไฟล์_backup.sql"
```

หลังรันคำสั่ง MySQL จะถาม password ให้กรอกรหัสผ่านของเครื่องบริษัท

ข้อควรระวัง:

- อย่าใส่รหัสผ่านจริงในคำสั่งหรือเอกสาร
- ถ้า restore เข้า test database ไม่ผ่าน ห้าม restore เข้า database จริง
- Restore อาจเขียนทับข้อมูลเดิม ถ้าใช้ database ผิดตัว
- ไม่ต้องคัดลอกโฟลเดอร์ MySQL Data โดยตรง

ถ้ามีไฟล์แนบ `.zip` ให้ดู `docs/backup-restore-guide.md` เพิ่มเติมก่อน restore ไฟล์แนบกลับเข้า `storage\attachments`

## วิธีเปิดระบบบนคอมบริษัท

รายละเอียดปุ่มกดอยู่ใน `docs/windows-button-guide.md`

ถ้ามีปุ่มกด ให้ใช้:

```text
scripts/start-server.bat
```

ถ้าจำเป็นต้องใช้คำสั่งแทนปุ่มกด:

```powershell
cd C:\BrakeCheck\server
npm start
```

เมื่อ server เปิดแล้ว ให้เปิด Chrome:

```text
http://localhost:3000/
```

ตรวจ backend:

```text
http://localhost:3000/api/health
```

ตรวจ database:

```text
http://localhost:3000/api/database/health
```

ถ้า database health fail ให้ตรวจ MySQL, `.env`, ชื่อ database, user และ password

## วิธีให้เครื่องอื่นเข้าใช้งาน

รายละเอียดเครื่องแม่/เครื่องลูก, IP, Firewall และ CORS อยู่ใน `docs/deployment-guide.md`

สรุปสั้น:

1. ที่เครื่องแม่ เปิด PowerShell หรือ Command Prompt แล้วรัน:

```powershell
ipconfig
```

2. หา IPv4 Address เช่น:

```text
192.168.1.50
```

3. เครื่องอื่นให้เปิด Chrome แล้วเข้า:

```text
http://IP-เครื่องแม่:3000/
```

ตัวอย่าง:

```text
http://192.168.1.50:3000/
```

ถ้าเข้าไม่ได้ ให้ตรวจ:

- เครื่องแม่เปิด server อยู่หรือไม่
- เครื่องลูกอยู่ network เดียวกันหรือไม่
- Windows Firewall เปิดให้เข้า port `3000` หรือไม่
- ค่า `CORS_ORIGINS` ใน `.env` มี URL เครื่องแม่หรือไม่
- ให้ IT ช่วยตรวจ IP และ network

## วิธีทดสอบหลังย้ายเสร็จ

Checklist หลังย้าย:

- เปิดเว็บได้
- API health ผ่าน
- Database health ผ่าน
- Login ได้
- เห็นข้อมูลเดิม
- Import Excel ได้
- ค้นหา Lot ได้
- Backup จากคอมบริษัทได้
- เครื่องอื่นเข้าใช้งานได้
- ถ้ามีไฟล์แนบ ให้ลองเปิด Lot ที่มีไฟล์แนบ

ถ้าข้อใดไม่ผ่าน อย่า reset database ทันที ให้จด error และตรวจทีละจุด

## วิธีอัปเดตโปรแกรมในอนาคตด้วยแฟลชไดรฟ์

ก่อนอัปเดตทุกครั้ง:

- Backup ฐานข้อมูลบริษัทก่อนเสมอ
- ถ้ามีไฟล์แนบ ให้ backup ทั้งระบบด้วย `scripts/backup-system.bat`
- ปิด server ก่อนคัดลอกไฟล์
- ห้ามทับ `.env` เดิม
- ห้ามทับ `backups/`
- แนะนำวางเป็นโฟลเดอร์ใหม่ก่อน
- ทดสอบก่อนค่อยใช้งานจริง
- เก็บโฟลเดอร์เก่าไว้ก่อน อย่าเพิ่งลบ

ตัวอย่าง:

```text
C:\BrakeCheck_old\
C:\BrakeCheck_new\
```

ถ้าเวอร์ชันใหม่ต้องเปลี่ยน database schema ให้หยุดอ่าน `docs/database-migration-guide.md` และ backup ก่อนเสมอ

## ปัญหาที่พบบ่อยและวิธีแก้

ปัญหาแบบละเอียดให้ดู `docs/troubleshooting.md` หัวข้อนี้เป็นสรุปเฉพาะตอนย้ายด้วยแฟลชไดรฟ์

| ปัญหา | สาเหตุที่เป็นไปได้ | วิธีตรวจหรือแก้เบื้องต้น |
| --- | --- | --- |
| เปิดเว็บไม่ได้ | Server ยังไม่เปิด หรือ URL ผิด | เปิด `scripts/start-server.bat` แล้วเข้า `http://localhost:3000/` |
| Database health fail | MySQL ไม่เปิด หรือ `.env` ผิด | ตรวจ `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| `npm install` ไม่ผ่าน | ไม่มี internet หรือ Node.js ไม่พร้อม | ตรวจ Node.js, เปิด internet, หรือให้ IT ช่วยเตรียม dependency |
| MySQL เข้าไม่ได้ | รหัสผ่านผิด หรือ user ไม่มีสิทธิ์ | ให้ IT ตรวจ user/password และสิทธิ์ database |
| Restore ไม่ได้ | ไฟล์ `.sql` ผิด, path ผิด, user ไม่มีสิทธิ์ | ลอง restore ลง test database ก่อน ห้ามทับของจริงทันที |
| เครื่องอื่นเข้าเว็บไม่ได้ | Firewall หรือ network บล็อก | ใช้ IP เครื่องแม่ ตรวจ port `3000` และถาม IT |
| port `3000` ถูกใช้งานอยู่ | มี server ตัวเก่าหรือโปรแกรมอื่นเปิดอยู่ | ปิด server ตัวเก่าก่อน หรือให้ IT ตรวจ process |
| ลืมรหัส MySQL | ไม่มีรหัส database | ถาม IT หรือคนที่ติดตั้ง MySQL ห้ามเดาสุ่มจนล็อกระบบ |
| หาไฟล์ `.env` ไม่เจอ | ยังไม่ได้สร้างจาก `.env.example` | คัดลอก `.env.example` เป็น `.env` ที่ root ของโปรเจกต์ |

## Checklist ก่อนย้ายจริง

- Backup แล้ว
- มีไฟล์ `.sql` แล้ว
- มีไฟล์ backup ไฟล์แนบ `.zip` ถ้ามีไฟล์แนบ
- มีโฟลเดอร์โปรแกรมครบ
- มี `.env.example`
- มี Node.js และ MySQL บนคอมบริษัท
- คุยกับ IT แล้ว
- แฟลชไดรฟ์ปลอดภัย
- รู้ว่าเครื่องไหนเป็นเครื่องแม่
- รู้ว่าจะเก็บ backup ระยะยาวไว้ที่ไหน

## Checklist หลังย้ายเสร็จ

- เปิดระบบได้
- Login ได้
- ข้อมูลเดิมอยู่
- Health ผ่าน
- Backup ใหม่จากคอมบริษัทได้
- เครื่องอื่นเข้าได้
- ไฟล์แนบเปิดได้ ถ้ามี
- เก็บแฟลชไดรฟ์และไฟล์ backup ให้ปลอดภัย

## สรุปสั้นมาก

1. ที่คอมบ้าน ให้ backup ด้วย `scripts/backup-system.bat`
2. คัดลอกโฟลเดอร์ BrakeCheck และไฟล์ backup ลงแฟลชไดรฟ์
3. ที่คอมบริษัท วางโปรแกรมที่ `C:\BrakeCheck\` หรือ `D:\BrakeCheck\`
4. ติดตั้ง Node.js, MySQL และ package ด้วย `npm install`
5. สร้าง `.env` จาก `.env.example` และใส่ค่าของเครื่องบริษัท
6. สร้าง database และ restore จากไฟล์ `.sql`
7. เปิด server ด้วย `scripts/start-server.bat`
8. ทดสอบเว็บ, health, login, ข้อมูลเดิม, backup และเครื่องลูก

จำไว้: ถ้าต้องการข้อมูลเดิม ต้องย้ายไฟล์ backup `.sql` ด้วย และไม่ควรคัดลอกโฟลเดอร์ MySQL Data โดยตรง
