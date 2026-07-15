# Go-live Checklist สำหรับ IT

ใช้ checklist นี้ก่อนเปิดใช้งาน BrakeCheck จริงในบริษัท

เป้าหมายคือให้ IT ตรวจว่าเครื่องแม่, database, backup, restore และ workflow QC พร้อมใช้งานจริงแล้ว

> ห้ามใส่รหัสผ่านจริง, ค่า `.env` จริง, ไฟล์ backup, `.sql`, `.zip` หรือข้อมูลโรงงานจริงในเอกสารนี้

## ข้อมูลการตรวจ

- วันที่ตรวจ: __________
- ผู้ตรวจ IT: __________
- เครื่องแม่: __________
- IP เครื่องแม่: __________
- Database ที่ตรวจ: __________
- ผลรวม: [ ] Go-live ได้  [ ] ยังไม่พร้อม

## 1. เครื่องแม่และโปรแกรมพื้นฐาน

- [ ] เครื่องแม่ถูกกำหนดชัดเจนว่าเป็นเครื่องเปิด server และเก็บ MySQL
- [ ] เครื่องแม่เปิด Windows ได้ปกติ
- [ ] ติดตั้ง Node.js แล้ว
- [ ] ติดตั้ง MySQL แล้ว
- [ ] ติดตั้ง Chrome แล้ว
- [ ] ติดตั้ง Git แล้ว ถ้าบริษัทใช้ Git เพื่ออัปเดตระบบ
- [ ] ตรวจระบบด้วย `scripts/check-system.bat` แล้วผ่าน
- [ ] เปิด server ด้วย `scripts/start-server.bat` แล้วไม่ error

## 2. Network และเครื่องลูก

- [ ] เครื่องแม่มี IP ชัดเจน เช่น IP คงที่ หรือ DHCP reservation
- [ ] เครื่องแม่เปิด `http://localhost:3000/` ได้
- [ ] เครื่องลูกเปิด `http://<server-ip>:3000/` ได้
- [ ] แท็บเล็ตหรือเครื่อง QC ที่ใช้งานจริงเปิดเว็บได้
- [ ] Windows Firewall หรือ firewall บริษัทอนุญาต port `3000` ตามที่ IT อนุมัติ
- [ ] เครื่องลูกไม่ต้องต่อ MySQL โดยตรง ใช้งานผ่านเว็บ BrakeCheck เท่านั้น

## 3. `.env` และความปลอดภัย

- [ ] ไฟล์ `.env` อยู่เฉพาะบนเครื่องแม่
- [ ] `.env` ไม่ถูกส่งขึ้น GitHub
- [ ] `APP_PORT` ถูกต้อง
- [ ] `CORS_ORIGINS` ระบุเฉพาะ URL ที่อนุญาต ไม่ใช้ `*`
- [ ] `SESSION_SECRET` เป็นค่าจริง ยาวอย่างน้อย 32 ตัวอักษร และไม่ใช่ placeholder
- [ ] production ใช้ MySQL user เฉพาะระบบ เช่น `brakecheck_app`
- [ ] production ไม่ใช้ `DB_USER=root`
- [ ] ไม่มีรหัสผ่านจริงถูกเขียนในเอกสาร, chat, commit หรือ screenshot ที่จะแชร์ออกไป

## 4. Database Health

- [ ] Login เข้าระบบได้
- [ ] เปิด `http://localhost:3000/api/health` แล้วระบบตอบว่าใช้งานได้
- [ ] เปิด `http://localhost:3000/api/database/health` หลัง login แล้วผ่าน
- [ ] Database health ตรวจพบตาราง QC สำคัญครบ
- [ ] ไม่มี error เรื่องต่อ MySQL ไม่ได้
- [ ] ไม่มี stack trace หรือ SQL error หลุดให้ผู้ใช้ทั่วไปเห็น

## 5. Backup ก่อนเปิดจริง

- [ ] รัน `scripts/backup-system.bat` แล้วสำเร็จ
- [ ] ได้ไฟล์ backup database `.sql`
- [ ] ได้ไฟล์ backup attachments `.zip` ถ้ามีไฟล์แนบ
- [ ] ไฟล์ backup อยู่ใน `backups/` หรือที่บริษัทกำหนด
- [ ] copy backup สำคัญออกไปเก็บนอก repo หรือที่เก็บกลางของบริษัทแล้ว
- [ ] ยืนยันว่า `backups/`, `.sql`, `.zip` ไม่ถูก commit ขึ้น GitHub

## 6. Restore Drill

ซ้อม restore คือการทดลองกู้ข้อมูล เพื่อพิสูจน์ว่าถ้าระบบพังจะกู้คืนได้

- [ ] อ่าน `docs/backup-restore-guide.md` ก่อนซ้อม restore
- [ ] ซ้อม restore กับ test database เท่านั้น
- [ ] ไม่ restore ทับ database จริง
- [ ] หลัง restore แล้วเปิด server ได้
- [ ] หลัง restore แล้ว login ได้
- [ ] หลัง restore แล้วเปิดหน้าหลัก, Import, ตรวจ Lot, Approve และ Report ได้
- [ ] จดชื่อ backup ที่ใช้ซ้อม โดยไม่เขียนรหัสผ่านจริงลงเอกสาร

## 7. Workflow QC ก่อนเปิดจริง

- [ ] Login ด้วย user ที่ใช้งานจริงได้
- [ ] role และ permission ถูกต้อง เช่น manager/head/user เห็นเมนูตามสิทธิ์
- [ ] Import Excel ไฟล์ทดสอบได้
- [ ] Preview แสดง Lot, Lot Pack, Lot ผลิต และวันฝนถูกต้อง
- [ ] Confirm Save ทำงานได้หลังตรวจข้อมูลแล้ว
- [ ] ตรวจ QC Inspection ได้
- [ ] Approve ได้ตามสิทธิ์
- [ ] Export Report ได้
- [ ] ข้อความ error อ่านเข้าใจ ไม่ใช่ stack trace หรือ SQL error ดิบ

## 8. เกณฑ์ Go-live / No-go

ห้ามเปิดใช้งานจริงถ้ายังมีข้อใดข้อหนึ่งนี้:

- [ ] ยังไม่ได้ backup ทั้งระบบ
- [ ] ยังไม่ได้ซ้อม restore กับ test database
- [ ] `/api/database/health` ไม่ผ่าน
- [ ] production ยังใช้ `DB_USER=root`
- [ ] เครื่องลูกเปิดเว็บไม่ได้
- [ ] Login, Import, Confirm Save, Approve หรือ Report ใช้งานไม่ได้
- [ ] ยังไม่รู้ว่าใครดูแลเครื่องแม่, backup และ restore

ถ้าทุกข้อสำคัญผ่านแล้ว ให้เปิดใช้งานจริงได้ โดยควรมี IT หรือผู้ดูแลอยู่ใกล้ ๆ ในวันแรก

## 9. ผู้รับผิดชอบหลังเปิดจริง

- ผู้ดูแลเครื่องแม่: __________
- ผู้ดูแล MySQL และ `.env`: __________
- ผู้ดูแล backup: __________
- ผู้อนุมัติ restore: __________
- ช่องทางแจ้งปัญหา: __________
