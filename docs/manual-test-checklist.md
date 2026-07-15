# Manual Test Checklist

ใช้ checklist นี้หลังแก้ระบบหรือก่อนส่งงานให้ผู้ใช้ทดสอบ

ไฟล์นี้เป็นแหล่งหลักเรื่องการทดสอบระบบ ถ้าระหว่างทดสอบเจอปัญหา ให้เปิด `docs/troubleshooting.md` และถ้างานเกี่ยวกับ migration หรือ schema ให้เปิด `docs/database-migration-guide.md` ก่อนทำต่อ

## Quick Regression Checklist

ใช้หัวข้อนี้หลังแก้ระบบทุกครั้ง เพื่อเช็กสั้น ๆ ว่าของเดิมยังไม่พัง

ถ้าเป็นฐานข้อมูลจริง ห้ามสร้างข้อมูลทดลองมั่ว ๆ ให้ทดสอบเฉพาะงานที่ตกลงกับผู้ใช้แล้ว หรือใช้ test database แทน

1. เปิดระบบ
   - เปิด `http://localhost:3000/` ได้
   - เปิด `http://localhost:3000/api/health` แล้วระบบตอบว่า ready
   - ถ้าต้องตรวจ database ให้ login ก่อน แล้วค่อยเปิด `/api/database/health`

2. Login / สิทธิ์ผู้ใช้
   - login ด้วย user ที่ถูกต้องได้
   - password ผิดต้องขึ้นข้อความเข้าใจง่าย
   - user สิทธิ์น้อยต้องไม่เห็นหรือทำงานของหัวหน้าได้
   - logout แล้วกลับมาใช้งานหน้าที่ต้อง login ไม่ได้

3. Import Excel
   - เลือกไฟล์ `.xlsx` หรือ `.xlsm` ได้
   - preview ขึ้นก่อนบันทึก
   - Lot ซ้ำหรือวันที่ผิดต้องแจ้ง error ก่อน save
   - ถ้าเป็นฐานข้อมูลจริง อย่ากด Confirm Save ด้วยไฟล์ทดลอง

4. ค้นหาและตรวจ Lot
   - ค้นด้วย `Lot` ได้
   - ค้นด้วย `Lot Pack` ได้
   - ถ้า 1 Lot Pack เจอหลาย Lot ต้องมีให้เลือกก่อน
   - เปิดหน้า Lot Inspection ได้

5. ตรวจ Dimension / Packing
   - บันทึก draft ได้เมื่อข้อมูลยังไม่ครบ
   - complete ได้เมื่อข้อมูลครบตามกติกา
   - ถ้าใส่ค่าผิดรูปแบบต้องแจ้งเตือน
   - กดซ้ำระหว่าง save แล้วข้อมูลไม่ควรซ้ำ

6. Approve / Report / Results
   - งานที่รออนุมัติแสดงใน Approval Queue
   - หัวหน้าหรือผู้มีสิทธิ์ approve ได้
   - ข้อมูลที่ approved แล้วควรถูก lock
   - Export report หรือดู Results ได้จากข้อมูลที่เสร็จแล้ว

7. Error / Empty / Loading
   - ตอนโหลดข้อมูลมีสถานะ loading
   - ถ้าไม่มีข้อมูลต้องเห็น empty state ที่อ่านเข้าใจ
   - ถ้า server/database มีปัญหา ไม่ควรเห็น stack trace หรือ SQL error

8. ก่อนส่งงาน
   - ไม่มีไฟล์ `.env`, backup, `.sql`, `.zip` หรือข้อมูลจริงติดไปกับ Git
   - ถ้างานกระทบ database ต้อง backup ก่อนเสมอ
   - จดสั้น ๆ ว่าทดสอบข้อไหนผ่านแล้ว และข้อไหนยังไม่ได้ทดสอบ

## Final Handoff Checklist

ใช้หัวข้อนี้เมื่อต้องส่งมอบระบบหลังจบ Step 15 โดยไม่สร้างหรือแก้ข้อมูลจริงโดยไม่จำเป็น

- Login ได้ และ user แต่ละสิทธิ์เห็นเมนูตามที่ควรเห็น
- Import, ค้นหา Lot, ตรวจ Dimension, ตรวจ Packing, Approve, Export Report และ Results เปิดได้ตาม flow หลัก
- หน้า Results เปิดดูงาน `Approved` และ `รับทราบ NG` ได้แบบ read-only
- หน้าใบตรวจที่เปิดจาก Results ต้องไม่มีปุ่มอนุมัติ, ส่งกลับ, รับทราบ NG, บันทึก, upload/delete หรือแก้ไขข้อมูล
- ถ้าทดสอบกับฐานข้อมูลจริง ให้ใช้ข้อมูลที่ตกลงกับผู้ใช้แล้วเท่านั้น และห้ามสร้างข้อมูลทดลองมั่ว ๆ
- ก่อน deploy หรือแก้ข้อมูลจำนวนมาก ต้อง backup database ก่อนเสมอ
- ตรวจว่าไม่มี `.env`, `backups/`, `*.sql`, backup `.zip`, log หรือข้อมูลโรงงานจริงติดไปกับ Git
- ถ้ามีฟีเจอร์ใหม่หลัง Step 15 ให้เปิด scope ใหม่ ไม่แก้ย้อนหลังใน Step 15

## Login

- เข้าระบบด้วย user ที่ถูกต้องได้
- รหัสผิดแล้วขึ้น error ชัดเจน
- user ที่ต้องเปลี่ยนรหัสผ่านครั้งแรกถูกพาไปหน้า Change Password

## Dashboard

- เปิด Dashboard ได้หลัง login
- แสดงข้อมูลจาก MySQL
- filter/search/pagination ใช้งานได้
- loading, empty, error state แสดงถูกต้อง

## Import Excel

- upload ไฟล์ `.xlsx` / `.xlsm` ได้
- อ่านเฉพาะ sheet `DATA`
- preview ก่อนบันทึกได้
- Confirm Save แล้วข้อมูลเข้า database

## Duplicate Lot

- Excel ที่มี Column A `Lot` ซ้ำต้องถูกแจ้ง error
- ห้ามบันทึกข้อมูลซ้ำลง database

## Barcode / Lot Pack

- ค้นหาด้วย `Lot Pack` ได้
- ถ้าเจอหลาย Lot ต้องเลือก Lot ก่อนตรวจ
- ค้นหาด้วย `Lot` ได้
- Lot ที่เป็น `Void` ต้องไม่ให้ตรวจต่อ

## QC Inspection

- เปิดหน้า Lot Inspection จาก Lot Lookup ได้
- หัวข้อมูล Lot แสดงถูกต้อง
- ฟอร์มตรวจมิติต้องผูกกับ Column A `Lot`
- draft/completed ต้องบันทึกผู้ใช้และเวลาเมื่อระบบรองรับ

## Approval

- หัวหน้าหรือผู้มีสิทธิ์ Approved ได้เมื่อถึง step ที่รองรับ
- ข้อมูล Approved ต้องถูก lock
- ถ้าต้องแก้ไขหลัง Approved ต้องยกเลิก Approved ก่อน

## User Permission

- Officer ใช้เฉพาะเมนูที่อนุญาต
- Assistant ใช้เมนูจัดการที่กำหนดได้
- Head จัดการผู้ใช้และงานอนุมัติได้
- API สำคัญต้องตอบ `403` เมื่อสิทธิ์ไม่พอ

## Session หมดอายุ

- token หมดอายุแล้วกลับหน้า Login
- API ที่ต้อง login ต้องตอบ `401`
- หน้าเว็บไม่ควรค้างด้วย error ที่อ่านไม่ออก

## Backup / Migration ก่อนอัปเดต

- ก่อน migration หรือแก้ฐานข้อมูล ต้องยืนยันว่า backup แล้ว
- backup database ต้องไม่เก็บใน repo
- ห้าม commit `.env` หรือ backup database
- ถ้าไม่แน่ใจว่าเป็น database จริงหรือ test ให้หยุดถามก่อน
- ถ้างานเกี่ยวกับ migration ให้ใช้ `docs/database-migration-guide.md` เป็นคู่มือหลัก
- ถ้าต้อง restore หรือกู้ข้อมูล ให้ใช้ `docs/backup-restore-guide.md` เป็นคู่มือหลัก
