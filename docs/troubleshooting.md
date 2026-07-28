# Troubleshooting

คู่มือนี้รวมปัญหาที่พบบ่อยและวิธีตรวจเบื้องต้นสำหรับ BrakeCheck

ไฟล์นี้เป็นแหล่งหลักสำหรับการแก้ปัญหา ถ้าปัญหาเกิดระหว่าง manual test ให้ดู checklist ใน `docs/manual-test-checklist.md` ควบคู่กัน และถ้าปัญหาเกี่ยวกับ migration หรือ schema ให้ดู `docs/database-migration-guide.md` ก่อนแก้ฐานข้อมูล

## เปิดเว็บไม่ได้

ให้ตรวจทีละข้อ:

- server เปิดอยู่หรือยัง
- URL ถูกต้องหรือไม่: `http://localhost:3000/`
- port `3000` ถูกใช้งานโดยโปรแกรมอื่นหรือไม่
- Terminal มี error หรือไม่

ลองเช็ก API:

```text
http://localhost:3000/api/health
```

## npm start ไม่ติด

ให้ลอง:

```powershell
cd server
npm install
npm start
```

ถ้ายังไม่ติด ให้ดู error ใน Terminal ก่อน อย่าเพิ่งลบไฟล์หรือ reset โปรเจกต์

## database health fail

ให้ตรวจ:

- PostgreSQL 17 เปิดอยู่หรือไม่
- database `brakecheck_pg` มีอยู่หรือยัง
- ค่า `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` ใน `.env` ถูกต้องหรือไม่
- role `brakecheck_app` มีสิทธิ์เข้าฐานข้อมูลหรือไม่

ห้าม reset database ถ้ายังไม่แน่ใจว่าเป็นฐานข้อมูลทดสอบหรือฐานข้อมูลจริง

ถ้าปัญหาเกิดหลัง migration หรือการเปลี่ยน schema ให้เปิด `docs/database-migration-guide.md` ก่อนแก้ต่อ และถ้าต้อง restore ให้ใช้ `docs/backup-restore-guide.md` เป็นคู่มือหลัก

## login ไม่ได้

ให้ตรวจ:

- รหัสพนักงานถูกต้องหรือไม่
- รหัสผ่านถูกต้องหรือไม่
- user ถูก suspended หรือ locked หรือไม่
- server ติดต่อ database ได้หรือไม่

ถ้าเป็น user ใหม่ อาจต้องเปลี่ยนรหัสผ่านครั้งแรก

## import Excel ไม่ผ่าน

ให้ตรวจ:

- ไฟล์ต้องเป็น `.xlsx` หรือ `.xlsm`
- ต้องมี sheet ชื่อ `DATA`
- Column A `Lot` ห้ามซ้ำ
- Column T `วันฝน` ต้องเป็นวันที่ถูกต้อง
- ถ้า Excel formula แสดงผลผิด ให้แก้ใน Excel ก่อน

อย่ากดบันทึกซ้ำหลายครั้งถ้าระบบกำลัง loading

## เครื่องอื่นเข้าเว็บไม่ได้

ให้ตรวจ:

- เครื่อง server และเครื่อง client อยู่ใน network เดียวกันหรือไม่
- ใช้ IP ของเครื่อง server แทน `localhost`
- Windows Firewall เปิดให้เข้า port `3000` หรือไม่
- server bind และเปิดอยู่จริงหรือไม่

ตัวอย่าง URL จากเครื่องอื่น:

```text
http://SERVER_IP:3000/
```

## port 3000 ถูกใช้งานอยู่

เช็ก process ที่ใช้ port:

```powershell
netstat -ano | findstr :3000
```

ถ้าจะปิด process ต้องแน่ใจก่อนว่าไม่ใช่งานสำคัญของระบบอื่น

ทางเลือกที่ปลอดภัยกว่า:

- ปิด server BrakeCheck ตัวเก่าก่อน
- หรือเปลี่ยน `APP_PORT` ใน `.env` ชั่วคราวสำหรับเครื่องทดสอบ
