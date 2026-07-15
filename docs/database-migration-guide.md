# คู่มือ Database Migration

คู่มือนี้อธิบายวิธีคิดเรื่อง migration สำหรับมือใหม่ เพื่อให้แก้โครงสร้างฐานข้อมูลอย่างปลอดภัย

ไฟล์นี้เป็นแหล่งหลักเรื่อง migration และการเปลี่ยน schema ถ้าต้องทดสอบระบบหลัง migration ให้ใช้ `docs/manual-test-checklist.md` ควบคู่กัน และถ้าเจอ error ให้เปิด `docs/troubleshooting.md`

## Migration คืออะไร

Migration คือไฟล์ SQL ที่ใช้เปลี่ยนโครงสร้างฐานข้อมูล เช่น เพิ่ม table, เพิ่ม column, เพิ่ม index หรือเพิ่ม constraint

ใน BrakeCheck ไฟล์ migration อยู่ที่:

```text
server/src/database/migrations/
```

## ห้ามแก้ migration เก่าหลังใช้งานจริง

ถ้า migration เคยรันบนเครื่องจริงแล้ว ไม่ควรกลับไปแก้ไฟล์เดิม เพราะเครื่องอื่นหรือ database จริงอาจมีสถานะไม่ตรงกัน

ให้สร้าง migration ใหม่แทน เพื่อให้ประวัติการเปลี่ยนแปลงชัดเจน

## ต้องสร้าง migration ใหม่เมื่อเปลี่ยนโครงสร้างฐานข้อมูล

ควรสร้าง migration ใหม่เมื่อมีงานแบบนี้:

- เพิ่ม table ใหม่
- เพิ่ม column ใหม่
- เปลี่ยนชนิดข้อมูล
- เพิ่ม index
- เพิ่ม foreign key
- เพิ่ม constraint
- ปรับ enum status

ไม่ควรแอบแก้ schema โดยไม่มี migration เพราะจะทำให้เครื่องอื่นตามไม่ทัน

## ห้าม DROP / TRUNCATE กับข้อมูลจริง

คำสั่งที่ห้ามใช้กับ database จริง:

```sql
DROP DATABASE
DROP TABLE
TRUNCATE TABLE
```

เหตุผล:

- `DROP DATABASE` ลบฐานข้อมูลทั้งก้อน
- `DROP TABLE` ลบตารางทั้งตาราง
- `TRUNCATE TABLE` ลบข้อมูลทั้งตารางอย่างรวดเร็ว

ถ้าจำเป็นต้องลบหรือ reset เพื่อทดสอบ ต้องยืนยันก่อนว่าเป็น database test/local เท่านั้น และต้องได้รับอนุญาตชัดเจน

## ตัวอย่างชื่อ migration ที่ดี

ชื่อไฟล์ควรบอก step และสิ่งที่เปลี่ยน

ตัวอย่าง:

```text
step-8-2-dimension-inspection.sql
step-8-3-dimension-form-fields.sql
step-10-approval-workflow.sql
fix-lot-status-approved-lock.sql
```

หลีกเลี่ยงชื่อที่ไม่ชัด เช่น:

```text
update.sql
new.sql
fix.sql
test.sql
```

## สิ่งที่ต้องตรวจใน migration

ก่อนรัน migration ให้ตรวจ:

- มี backup database แล้วหรือยัง
- database เป็น test หรือ real
- migration มีคำสั่งทำลายข้อมูลหรือไม่
- migration สอดคล้องกับ requirement หรือไม่
- migration อ่านเข้าใจง่ายหรือไม่
- migration ผูกกับ step ปัจจุบันหรือไม่

## สิ่งที่ต้องทดสอบหลัง migration

หลัง migration ให้ทดสอบแบบสั้นก่อน:

- API health: `http://localhost:3000/api/health`
- Database health: `http://localhost:3000/api/database/health`
- Login
- workflow ที่เกี่ยวกับ table/column ใหม่
- validation error และ permission error ที่เกี่ยวข้อง

จากนั้นให้ใช้ `docs/manual-test-checklist.md` เป็น checklist หลักสำหรับ manual test ของหน้าที่กระทบ

ถ้า migration fail:

- อย่ารันคำสั่งแก้แบบเดาสุ่ม
- อ่าน error ก่อน
- ตรวจว่า database ตรงกับที่คิดหรือไม่
- ถ้าเป็น database จริง ให้หยุดและถามก่อนแก้ต่อ
- เปิด `docs/troubleshooting.md` เพื่อไล่ปัญหา server/database แบบเป็นขั้นตอน
