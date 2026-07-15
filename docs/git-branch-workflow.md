# Git Workflow สำหรับ BrakeCheck

เอกสารนี้เป็นคู่มือ Git แบบสั้น ใช้เพื่อทำงานทีละ Step โดยไม่ให้ `master` เสียหาย

ใช้ไฟล์นี้เป็นแหล่งหลักสำหรับ branch, commit, merge, สถานะที่ merge แล้ว และ prompt ที่ยังใช้ได้จริง ส่วน roadmap และ handoff summary แบบละเอียดให้อ่าน `docs/project-plan.md`

สถานะปัจจุบัน ณ 2026-07-01: แผนหลักของ BrakeCheck ปิดงานที่ Step 15: Results แล้ว ถ้าจะทำงานต่อให้เปิดเป็น scope ใหม่ ไม่รวมย้อนหลังใน Step 15

## หลักการ

- `master` = งานที่ Merge แล้วและควรใช้งานได้
- `codex/step-x-short-name` = branch สำหรับงานใหม่หรือ bug fix
- งานแก้โค้ดควรทำใน branch แยก
- งานเอกสารเล็ก ๆ ทำบน `master` ได้ ถ้าผู้ใช้อนุมัติ

## ก่อนเริ่ม Step ใหม่

```powershell
git status
git checkout master
git pull
git checkout -b codex/step-x-short-name
```

ตัวอย่าง:

```powershell
git checkout -b codex/step-8-1-lot-inspection-shell
```

## หลังทำงานและทดสอบผ่าน

```powershell
git status
git add ชื่อไฟล์
git commit -m "feat: short clear message"
git push -u origin codex/step-x-short-name
```

จากนั้นเปิด Pull Request ใน GitHub:

- `base`: `master`
- `compare`: branch ที่ทำงาน

หลัง Merge แล้วกลับมาอัปเดตเครื่อง:

```powershell
git checkout master
git pull
git status
```

## Commit Message ที่ใช้

ใช้ Conventional Commits แบบสั้น:

- `feat: add barcode lot lookup`
- `fix: handle expired session`
- `docs: update project plan`
- `refactor: simplify app helpers`
- `style: polish dashboard layout`

## จุดที่ควรสร้าง Branch

- เพิ่มหน้าใหม่
- เพิ่มหรือแก้ API
- แก้ฐานข้อมูล
- แก้ Login, Session, Permission
- Import Excel
- Manual Input Lot
- Edit / Void Lot
- History / Audit
- ระบบตรวจ QC, Approved, Export
- bug ที่กระทบหลายหน้า


## คอลัมน์ Excel ที่ใช้ในระบบ

อ่านเฉพาะ Sheet `DATA` และรองรับเฉพาะไฟล์ `.xlsx` / `.xlsm`

| Column | ชื่อใน Excel | ใช้ในระบบ |
| --- | --- | --- |
| A | Lot | รหัสหลักของงานตรวจ QC, ห้ามซ้ำ |
| E | เลขที่ใบสั่งซื้อ | ใบสั่งซื้อ |
| F | Code | Code สินค้า |
| H | บันทึก(รหัสของนอก) | หมายเหตุ/ข้อมูลเสริม |
| M | เกรด | เกรด |
| N | เจาะ-ไม่เจาะ | ข้อมูลประกอบเกรด/ลักษณะงาน |
| O | กว้าง-หนา-ยาว | รายละเอียดขนาดสินค้า |
| R | Lot Pack | ใช้ยิง Barcode, ซ้ำได้ |
| T | วันฝน | วันที่ผลิตจาก Excel |
| U | ยิงเลเซอร์ | หมายเหตุ/ข้อมูลเสริม |
| W | จำนวนชิ้น | จำนวน Lot และใช้คำนวณจำนวนสุ่มตรวจ |
| X | Lot ผลิต | ใช้ในฟอร์มตรวจบรรจุ, ซ้ำได้ |
| AJ | ดอกคว้าน | ขนาดรูคว้าน |
| AK | ดอกเจาะ | ขนาดรูเจาะ |
| AL | รุ่นผลิตภัณฑ์ | รุ่น |
| AM | รีเวท | รีเวท No. ในฟอร์มตรวจมิติ |
| AN | หมายเหตุ | หมายเหตุ/ข้อมูลเสริม |

กฎสำคัญ:

- Column A `Lot` คือ Key หลักของใบตรวจ
- Column R `Lot Pack` ใช้ค้นหาจาก Barcode และอาจเจอหลาย Lot
- Column X `Lot ผลิต` ใช้ตรวจบรรจุและอาจซ้ำได้
- Column T `วันฝน` ถ้าข้อมูลวันที่ผิด ต้องเตือนก่อนบันทึก
- Column AJ / AK ต้องไม่สลับกัน: AJ = ขนาดรูคว้าน, AK = ขนาดรูเจาะ

## กฎที่ต้องจำ

- ห้าม commit `.env`
- ห้าม commit `node_modules`
- ห้าม commit ไฟล์ log
- ก่อนแก้โค้ดต้องดู `git status`
- Merge เข้า `master` หลังทดสอบผ่านเท่านั้น
