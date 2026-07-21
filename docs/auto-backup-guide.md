# คู่มือ Auto Backup ฐานข้อมูลและไฟล์แนบ

คู่มือนี้ใช้ตั้ง Backup ฐานข้อมูล PostgreSQL และไฟล์แนบอัตโนมัติบนเครื่องแม่ของ BrakeCheck

## Auto Backup คืออะไร

Auto Backup คือการให้ Windows รันไฟล์ Backup ให้เองตามเวลา เช่น ทุกวัน 17:00 หลังเลิกงาน

## ทำไมต้อง Backup ฐานข้อมูล QC

ฐานข้อมูล QC เก็บ Lot, ประวัติ Import, ผลตรวจ, Audit และสถานะงานจริงของโรงงาน ส่วน `storage/attachments` เก็บไฟล์แนบจริง เช่น PDF หรือรูปภาพ ถ้าขาดอย่างใดอย่างหนึ่ง การกู้คืนจะไม่ครบ

## Backup ต่างจาก Restore อย่างไร

- Backup คือสำรองข้อมูล PostgreSQL ออกมาเป็นไฟล์ `database.backup`
- Restore คือเอาไฟล์ backup กลับเข้า database หรือโฟลเดอร์ไฟล์แนบ

Restore มีความเสี่ยงเพราะอาจเขียนทับข้อมูลปัจจุบัน จึงไม่ควรทำอัตโนมัติ

## ไฟล์ Backup เก็บไว้ที่ไหน

Auto Backup จะสร้าง 1 โฟลเดอร์ต่อ 1 รอบ backup:

```text
backups/brakecheck_auto_2026-06-30_1700/
```

ในโฟลเดอร์นั้นจะมี:

```text
database.backup
attachments.zip
backup-info.txt
```

Log จะอยู่ที่:

```text
backups/backup-log.txt
```

## วิธีทดสอบ Backup แบบกดเอง

ดับเบิลคลิกไฟล์นี้:

```text
scripts/auto-backup-system.bat
```

ถ้าสำเร็จ จะเห็นข้อความว่า System backup completed successfully และมี path ของโฟลเดอร์ backup

ถ้าไม่สำเร็จ ให้อ่านข้อความในหน้าต่างและดู log ที่:

```text
backups/backup-log.txt
```

## วิธีติดตั้ง Auto Backup

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ BrakeCheck แล้วรัน:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-auto-backup-task.ps1
```

ค่าเริ่มต้นคือ Backup ทุกวันเวลา 17:00

ถ้า Windows แจ้งว่า Access is denied ให้เปิด PowerShell แบบ Run as Administrator หรือให้ IT ช่วย

## ตั้งเป็น Backup รายสัปดาห์

ตัวอย่าง Backup ทุกวันศุกร์ เวลา 17:00:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-auto-backup-task.ps1 -Schedule Weekly -Day FRI -Time 17:00
```

ไม่แนะนำให้ตั้งถี่เกินจำเป็น เพราะไฟล์ backup จะใช้พื้นที่เพิ่มขึ้นเรื่อย ๆ

## วิธีเปิด Task Scheduler เพื่อตรวจ

1. กด Start
2. ค้นหา `Task Scheduler`
3. เปิด `Task Scheduler Library`
4. มองหา task ชื่อ `BrakeCheck Auto Backup`

## วิธีเช็กว่า Backup สำเร็จ

ตรวจ 3 จุด:

- มีโฟลเดอร์ใหม่ใน `backups/`
- ในโฟลเดอร์นั้นมี `database.backup`, `attachments.zip`, และ `backup-info.txt`
- เปิด `backups/backup-log.txt` แล้วเห็นข้อความ `SUCCESS`
- เวลาโฟลเดอร์ตรงกับเวลาที่ตั้งไว้

## วิธีดู backup-log.txt

เปิดไฟล์นี้ด้วย Notepad:

```text
backups/backup-log.txt
```

ถ้าเห็น `FAILED` ให้อ่านข้อความข้าง ๆ แล้วตรวจ PostgreSQL, `.env`, และ `pg_dump`

## วิธีเปลี่ยนเวลา Backup

รันคำสั่งเดิมพร้อมเวลาใหม่ เช่น 18:30:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-auto-backup-task.ps1 -Time 18:30
```

สคริปต์จะอัปเดต task เดิมให้

## วิธีปิดหรือลบ Auto Backup

ใช้คำสั่ง:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-auto-backup-task.ps1 -Delete
```

หรือเปิด Task Scheduler แล้วลบ task ชื่อ `BrakeCheck Auto Backup`

## ข้อควรระวัง

- ไฟล์ `database.backup` มีข้อมูลจริงของโรงงาน
- `attachments.zip` มีไฟล์แนบจริงของโรงงาน
- ห้ามส่งไฟล์ Backup ให้คนนอก
- ห้ามอัปโหลด Backup ขึ้น GitHub
- ห้าม commit `.env`, `backups/`, `*.backup`, `*.sql` หรือไฟล์ backup อื่น ๆ
- ห้ามใส่รหัสผ่านจริงใน `.bat`, `.ps1`, หรือเอกสาร
- รหัสผ่านฐานข้อมูลให้เก็บใน `.env` ของเครื่องจริงเท่านั้น
- ตรวจพื้นที่ว่างของเครื่องแม่เป็นระยะ เพราะ backup จะเพิ่มขึ้นเรื่อย ๆ
- ควรคัดลอก backup สำคัญไปเก็บ External Harddisk หรือที่เก็บที่บริษัทกำหนดเป็นระยะ
- Auto Backup นี้ไม่ทำ Restore, ไม่รัน migration, และไม่ลบ backup เก่าอัตโนมัติ

## ถ้าต้อง Restore จาก Auto Backup

Auto Backup มีหน้าที่สร้างชุดไฟล์สำรองเท่านั้น ไม่ได้กู้ข้อมูลกลับเข้า database ให้เอง และไม่ควรทำ Restore อัตโนมัติ

ถ้าต้อง Restore ให้ใช้คู่มือหลัก [docs/backup-restore-guide.md](backup-restore-guide.md) ก่อนทำจริง

ก่อนเริ่ม ให้เลือก backup 1 ชุด เช่น:

```text
backups/brakecheck_auto_2026-06-30_1700/
```

ในโฟลเดอร์นี้ต้องมี:

```text
database.backup
attachments.zip
backup-info.txt
```

สรุปขั้นตอนแบบสั้น:

1. Backup สภาพปัจจุบันก่อนเสมอ แม้ข้อมูลจะเสียหรือหายบางส่วน
2. หยุดใช้งานระบบชั่วคราว เช่น Import, Approve, แก้ Lot และปิด server ถ้าจะ restore database จริง
3. Restore `database.backup` เข้า test database ด้วย `pg_restore` ก่อน ห้าม restore ทับ database จริงทันที
4. ให้ระบบชี้ไป test database ชั่วคราวด้วยค่า `DB_NAME` ใน `.env` แล้วตรวจข้อมูลในระบบ
5. ตรวจ Login, Lot สำคัญ, ค่าตรวจ QC, Audit/History, Report/Export และไฟล์แนบ
6. แตก `attachments.zip` ไปที่โฟลเดอร์ทดสอบก่อน อย่าแตกทับ `storage\attachments\` จริงทันที
7. จะ Restore ของจริงได้ก็ต่อเมื่อ test database ผ่าน, backup ถูกชุด, backup สภาพปัจจุบันแล้ว, ไม่มีผู้ใช้ใช้งาน, และหัวหน้า QC หรือ IT อนุมัติแล้ว
8. หลัง Restore ของจริง ให้เปิดระบบแล้วให้ QC ลองใช้งานจริง 1 รอบ

ข้อควรระวังที่ห้ามข้าม:

- ระบบ BrakeCheck อ่านข้อมูลจาก PostgreSQL ตามค่า `DB_NAME` ใน `.env` ไม่ได้อ่านไฟล์ backup โดยตรง
- ห้ามใส่ password จริงในคำสั่งหรือเอกสาร
- ห้าม commit `.env`, `backups/`, `*.backup`, `*.sql` หรือไฟล์ `.zip` backup ขึ้น GitHub
- ห้ามลบ backup ชุดเก่า, backup สภาพปัจจุบัน, หรือโฟลเดอร์ไฟล์แนบเดิมจนกว่าจะตรวจผ่าน
- ถ้าไม่แน่ใจว่า database เป็น test หรือ real ให้หยุดและถามก่อน
- Auto Backup นี้ไม่ทำ Restore, ไม่รัน migration, และไม่ลบ backup เก่าอัตโนมัติ

## ถ้า pg_dump ไม่พบ

`pg_dump` คือเครื่องมือของ PostgreSQL สำหรับสร้างไฟล์ backup แบบ custom เช่น `database.backup`

ถ้าสคริปต์แจ้งว่า `pg_dump is not available` ให้ติดตั้ง PostgreSQL 17 tools หรือเพิ่มโฟลเดอร์ PostgreSQL `bin` เข้า PATH เช่น:

```text
C:\Program Files\PostgreSQL\17\bin
```

ถ้าไม่แน่ใจ ให้ถาม IT ก่อนแก้ค่าเครื่อง
