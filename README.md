# BrakeCheck_PG

BrakeCheck_PG คือ workspace สำหรับย้ายระบบ BrakeCheck จาก MySQL ไป PostgreSQL 17 โดยยังคงเป้าหมายเดิมคือให้เจ้าหน้าที่ QC โรงงานผลิตผ้าเบรกรถยนต์และรถบรรทุกใช้บันทึก ตรวจสอบ และติดตามข้อมูลคุณภาพแทนเอกสารกระดาษ

ระบบยังออกแบบให้เปิดใช้งานผ่าน Chrome ใช้เครื่องมือฟรี ไม่มีค่าใช้จ่ายรายเดือน และทำงานแบบ local-first บน Windows

สถานะปัจจุบัน: repo นี้เป็น PostgreSQL migration workspace ยังไม่ใช่ระบบ production ที่ย้ายเสร็จแล้ว โค้ดจำนวนมากยังเป็นฐานเดิมจาก BrakeCheck MySQL version และจะค่อย ๆ เปลี่ยนตาม `docs/postgresql-migration-plan.md`

โปรเจกต์ MySQL เดิมที่ `C:\Users\KONG\Documents\BrakeCheck` ต้องเก็บไว้เป็นระบบสำรอง/แหล่งอ้างอิง และห้ามแก้หรือเชื่อมต่อฐานข้อมูลเดิมโดยไม่ได้อนุมัติ

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Target Database: PostgreSQL 17
- Source baseline: BrakeCheck MySQL version
- Tools: VS Code, Git, GitHub, Chrome

## โครงสร้างโปรเจกต์

- `client/` - หน้าเว็บที่เปิดใน Chrome
- `client/src/pages/` - หน้าแต่ละหน้าของระบบ
- `client/src/services/` - ไฟล์เรียก API
- `client/src/styles/` - CSS หลัก
- `server/` - Backend Node.js / Express
- `server/src/routes/` - API routes
- `server/src/controllers/` - รับ request และส่ง response
- `server/src/services/` - logic หลักของระบบ
- `server/src/database/` - schema และ migration SQL
- `docs/` - เอกสารโปรเจกต์

## อ่านอะไรต่อดี

README นี้เป็นสารบัญสั้นของโปรเจกต์ ถ้าต้องทำงานจริง ให้เปิดคู่มือหลักตามงานที่กำลังทำก่อน

| งานที่ต้องทำ | อ่านไฟล์หลัก |
| --- | --- |
| ดูแผนย้ายจาก MySQL ไป PostgreSQL | `docs/postgresql-migration-plan.md` |
| เริ่มเปิดระบบบนเครื่อง local ครั้งแรก | `docs/beginner-start-guide.md` |
| เปิด server, ตรวจระบบ, backup ด้วยปุ่มกด Windows | `docs/windows-button-guide.md` |
| Backup, Restore, ซ้อม Restore หรือกู้ข้อมูล | `docs/backup-restore-guide.md` |
| ตั้ง Auto Backup ฐานข้อมูลและไฟล์แนบตามเวลา | `docs/auto-backup-guide.md` |
| ติดตั้งใช้งานจริงแบบเครื่องแม่/เครื่องลูกในบริษัท | `docs/deployment-guide.md` |
| ย้ายโปรแกรมด้วยแฟลชไดรฟ์โดยไม่ใช้ Git | `docs/usb-transfer-install-guide.md` |
| อัปเดตระบบอย่างปลอดภัย | `docs/update-system-safely.md` |
| เปลี่ยนโครงสร้างฐานข้อมูลหรือ migration | `docs/database-migration-guide.md` |
| ทดสอบระบบหลังแก้หรือก่อนส่งให้ QC ลองใช้ | `docs/manual-test-checklist.md` |
| แก้ปัญหาเบื้องต้น | `docs/troubleshooting.md` |
| ดูแผนงาน, สถานะ Step, และ Git workflow | `docs/project-plan.md`, `docs/git-branch-workflow.md` |
| ดูคอลัมน์ไฟล์ Export Dimension | `docs/export-dimension-column-guide.md` |

## สิ่งที่มือใหม่ควรรู้ก่อนเริ่ม

- Repo นี้ยังอยู่ระหว่างย้ายฐานข้อมูล ห้ามใช้กับฐานข้อมูลจริงจนกว่า phase migration/test จะผ่านและได้รับอนุมัติ
- ถ้าไม่อยากพิมพ์คำสั่งเอง ให้เริ่มจาก `docs/windows-button-guide.md`
- ถ้าจะ backup ด้วยปุ่มกด ให้ใช้ `scripts/backup-system.bat` เพื่อเก็บทั้ง database และไฟล์แนบ
- ถ้าจะตั้ง backup อัตโนมัติ ให้เริ่มจาก `docs/auto-backup-guide.md` และใช้แนวทาง full-system backup เป็นหลัก
- ถ้าจะ restore หรือกู้ข้อมูล ให้เปิด `docs/backup-restore-guide.md` ก่อนทำจริง
- ถ้าไม่แน่ใจว่า database เป็นของจริงหรือ test ให้หยุดและถามก่อน

## กฎข้อมูลสำคัญ

- Excel import อ่านเฉพาะ sheet `DATA`
- รองรับไฟล์ Excel เฉพาะ `.xlsx` และ `.xlsm`
- Column A = `Lot` เป็นรหัสหลัก ห้ามซ้ำ
- Column R = `Lot Pack` ใช้ยิงบาร์โค้ด ซ้ำได้
- Column X = `Lot ผลิต` ใช้ตรวจบรรจุ ซ้ำได้
- Column T = `วันฝน` ใช้เป็นวันที่จากไฟล์ Excel
- ข้อมูล QC เป็นข้อมูลจริงของโรงงาน ต้อง backup ก่อนอัปเดต, migration, restore, bulk update หรือ import จำนวนมาก

## คำเตือนสำคัญ

- ห้าม commit ไฟล์ `.env`
- ห้าม commit `backups/`, `*.sql`, ไฟล์ backup `.zip`, log หรือข้อมูลโรงงานจริง
- ห้ามใส่รหัสผ่านจริง, token, database password หรือ `SESSION_SECRET` ลงในเอกสารหรือ GitHub
- ห้าม restore ทับ database จริงทันที ต้องลองกับ test database ก่อน
- ห้ามใช้ `DROP DATABASE`, `DROP TABLE`, `TRUNCATE TABLE`, reset database หรือคำสั่งลบข้อมูลจริงโดยไม่ยืนยันชัดเจน
- ถ้างานเกี่ยวกับ database, backup, restore หรือ migration ให้หยุดอ่านคู่มือหลักก่อนลงมือ
