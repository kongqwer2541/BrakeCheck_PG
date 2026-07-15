# คู่มืออัปเดตระบบอย่างปลอดภัย

ใช้ checklist นี้ก่อนอัปเดต BrakeCheck เพื่อป้องกันข้อมูล QC หาย และช่วยให้มือใหม่ทำงานเป็นขั้นตอน

ไฟล์นี้เป็น checklist สั้นสำหรับการอัปเดตระบบ รายละเอียดเต็มให้เปิดไฟล์หลักตามงาน:

- ทดสอบระบบ: `docs/manual-test-checklist.md`
- แก้ปัญหา: `docs/troubleshooting.md`
- migration หรือแก้ schema: `docs/database-migration-guide.md`
- backup / restore: `docs/backup-restore-guide.md`

## ก่อนอัปเดต

- รัน `git status`
- ตรวจว่าไม่มีงานค้างที่ไม่เข้าใจ
- ตรวจ branch ว่าอยู่ branch ที่ถูกต้อง
- อ่าน requirement ให้ครบก่อนแก้
- ยืนยันว่าไม่ใช้ฐานข้อมูลจริงสำหรับทดลอง
- ถ้าต้องใช้ฐานข้อมูลจริง ให้ backup database ก่อน
- ตรวจว่าไฟล์ `.env` ไม่ถูก commit
- ตรวจว่าจะไม่เพิ่ม dependency ใหม่โดยไม่ขออนุญาต
- ตรวจว่าจะไม่แก้ schema โดยไม่มี migration

คำสั่งพื้นฐาน:

```powershell
git status
```

ถ้างานเกี่ยวกับ database ให้ backup ก่อนเสมอ

## ระหว่างอัปเดต

- แก้เฉพาะไฟล์ที่เกี่ยวข้องกับงาน
- ไม่ reset database
- ไม่ลบข้อมูลจริง
- ไม่ใช้ `DROP DATABASE`
- ไม่ใช้ `DROP TABLE` กับฐานข้อมูลจริง
- ไม่ใช้ `TRUNCATE TABLE` กับฐานข้อมูลจริง
- ไม่เพิ่ม dependency โดยไม่ขออนุญาต
- ไม่แก้ `.env.example` ให้มีรหัสผ่านจริง
- ไม่เปิดเผย password, token, หรือข้อมูลโรงงาน
- ถ้าเจอปัญหาใหม่ ให้บอกผู้ใช้ก่อนขยาย scope

## หลังอัปเดต

ใช้ checklist สั้นนี้ก่อนส่งงาน:

- รัน syntax check ตามประเภทงานที่แก้ เช่น `node --check` กับไฟล์ JavaScript ที่เกี่ยวข้อง
- รัน `git diff --check`
- เช็ก API health: `http://localhost:3000/api/health`
- ถ้างานเกี่ยวกับ database ให้เช็ก `http://localhost:3000/api/database/health`
- ทำ manual browser test ตาม `docs/manual-test-checklist.md`
- ถ้า migration เปลี่ยน schema ให้ตรวจตาม `docs/database-migration-guide.md`

สรุปหลังงาน:

- ไฟล์ที่เปลี่ยน
- สิ่งที่แก้
- สิ่งที่ทดสอบ
- สิ่งที่ไม่ได้ทดสอบ
- ความเสี่ยงที่เหลือ

## ถ้าอัปเดตแล้วระบบผิดปกติ

- อย่าลบข้อมูลจริง
- อย่า reset database ทันที
- เก็บ error message
- ตรวจ `git status`
- ตรวจ API health
- ตรวจ database health
- ถ้าเกี่ยวกับข้อมูล ให้ backup ปัจจุบันก่อน restore
- ถ้าจะ restore ต้องยืนยันไฟล์ backup และ database เป้าหมายก่อน
- เปิด `docs/troubleshooting.md` เพื่อไล่ปัญหาตามอาการ
- ถ้าปัญหาเกิดจาก migration ให้เปิด `docs/database-migration-guide.md` ก่อนแก้ต่อ
