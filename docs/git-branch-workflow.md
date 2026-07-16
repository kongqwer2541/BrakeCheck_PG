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

## สถานะล่าสุด

งานที่ทำเสร็จและ Merge แล้ว:

- Step 1: โครงสร้างโปรเจกต์
- Step 2: MySQL database และตารางเริ่มต้น
- Step 3: Backend health และ Database health
- Step 4: Login, Session, Change Password, User Management
- Step 5: Layout หลัก, Sidebar, Dashboard โครงแรก
- Step 6.1: Backend อ่าน Excel และ Preview
- Step 6.2: Save Excel to Database
- Step 6.3: Dashboard ดึงข้อมูลจริง
- Step 6.4: หน้า Import Excel, Preview, Confirm Save
- Step 6.4.1: จัดการ Session หมดอายุจาก API
- Step 6.4.2: App helpers และ UI cleanup
- Step 6.5: Manual Input Lot
- Step 6.6: Edit / Void Lot พร้อม Audit
- Step 6.7: ประวัติ Lot, Import, Audit
- Step 7: Barcode Scan / Lot Lookup
- Step 8.1: Lot Inspection Shell
- Step 8.2: Database และ API ฟอร์มตรวจมิติ
- Step 8.2.1-8.2.9: คู่มือมือใหม่, backup/restore, Windows helper, env example, deployment guide, documentation safety review
- Step 8.3: UI ฟอร์มตรวจมิติ
- Step 8.4: ตารางค่าตรวจ, default config, เงื่อนไขช่อง `-`, validation ตาม form config, note การตรวจ และจำรหัสเครื่องมือบางช่อง
- Step 8.5: Permission, Status และ Final Save Flow
- Step 8.6: Dimension Inspection Final QA & Cleanup
- Fix: แก้ mapping `ขนาดรูเจาะ` และ `ขนาดรูคว้าน`
- Fix: แก้ Database health ให้ตรวจ `lot_audit_logs` ได้ถูกต้อง
- Step 9: Packing Inspection Form
- Step 9.1: Final QA, UX cleanup และ Handoff Summary เตรียมเริ่ม Step 10
- Step 10.1: คิว `ตรวจและอนุมัติ` และ Approved Workflow
- Step 10.1.1: หลักฐานผู้อนุมัติ/ผู้รับทราบ NG
- Step 10.2: ไฟล์แนบผูกกับ Lot
- Step 10 Docs: Handoff Summary และ workflow หลัง merge
- Step 11.1: Export Excel รายงาน Lot แบบเอกสารอ่าน/แนบงาน
- Step 11.2: Export PDF รายงาน Lot พร้อม layout อ่านง่ายและตรวจฟอนต์ไทย
- Step 12.1: System Settings Foundation เปิดเมนูตั้งค่าระบบ, เพิ่ม `rule_key`, audit log และ seed `hole_inspection`
- Step 12.2: Inspection Topic Management เพิ่ม/ปิดหัวข้อ, แก้ลำดับ/หมายเหตุ, ซ่อน inactive, audit และ block draft
- Step 12.3: Sampling Rules + Instrument Prefix แก้จำนวนสุ่มตรวจทั้งชุดและ prefix เครื่องมือวัด 5 ช่อง
- Step 13: Inspection Work Queue Pages
- Step 14.1: Export Dimension Backend Preview สำหรับกรองรุ่น/วันที่/หัวข้อ และ preview Lot ที่ export ได้
- Step 14.2: Export Dimension Excel API สำหรับ export `.xlsx` ด้วย `raw_data`, `skipped_values`, `summary`, `metadata`
- Step 14.3: Export Data UI สำหรับ preview, เลือกหัวข้อ, เลือกหลาย Lot และดาวน์โหลด Excel
- Step 15: Results สำหรับเปิดดูงานที่ Approved แล้ว และงาน NG ที่รับทราบแล้วแบบ read-only ทุก role เข้าถึงได้

สถานะปิดงาน:
- แผนหลักของโปรแกรมจบที่ Step 15 แล้ว
- ถ้าจะเพิ่ม export/print จาก Results, UI cleanup หรือฟีเจอร์ใหม่ ให้เปิด branch/scope ใหม่
- ก่อน commit/push/PR ของงานเอกสารหรือฟีเจอร์ใหม่ ให้ตรวจ `git status`, diff และ test ที่เกี่ยวข้องเสมอ

## ปิดงาน Step 15 อย่างปลอดภัย

สถานะล่าสุด:

- Step 15 เป็น Step สุดท้ายของแผนหลัก และปิดงานแล้ว
- งาน Step 15 เดิมทำงานบน branch `codex/step-15-results`
- เพิ่มหน้าเมนู `Results` แทนเมนูเดิม `ค้นหาตามรุ่น`
- หน้า Results ใช้สำหรับเปิดดูงานที่จบแล้วแบบ read-only เท่านั้น
- รองรับแท็บ `Approved` และ `รับทราบ NG`
- ทุก role เข้าได้: `head`, `assistant`, `officer`
- ค้นหาได้จาก Lot, Lot Pack, Lot ผลิต, รุ่น/รายละเอียด และกรองวันที่ผลิตได้
- มีปุ่มย้อนหลัง 1 วัน, ย้อนหลัง 3 วัน, โหมดวันที่ทั้งหมด และปุ่มไปวันล่าสุด
- เปิดดูใบตรวจเดิมด้วยการคลิก/แตะซ้ำแถวเดิมในเวลาสั้น ๆ เพื่อรองรับแท็บเล็ต
- หน้าใบตรวจที่เปิดจาก Results ไม่มีปุ่มอนุมัติ, ส่งกลับ, รับทราบ NG, บันทึก, upload/delete หรือแก้ไขข้อมูล
- Step 15 ไม่มี export/print เพราะใช้เปิดดูรายละเอียดการตรวจสอบเท่านั้น
- Step 15 ไม่แก้ schema/database ไม่มี migration ไม่มี bulk data write และไม่มี dependency ใหม่

Final QA ที่ใช้ปิดงาน Step 15:

```powershell
node --check server/src/services/results.service.js
node --check client/src/pages/results.page.js
node --check client/src/app.js
node --check client/src/pages/lot-inspection.page.js
node --test server/src/services/results.service.test.js
node --test client/src/pages/results.page.test.mjs
node --test client/src/app.results-readonly.test.mjs
node --test client/src/pages/lot-inspection.page.test.mjs
git diff --check
```

ข้อควรระวังหลัง Step 15:

- ห้ามเปลี่ยน Results ให้เป็นหน้าแก้ไขหรือหน้าอนุมัติ
- ห้ามเพิ่มปุ่มอนุมัติ, ส่งกลับ, รับทราบ NG, บันทึก, upload/delete หรือแก้ไขใน Results/read-only detail
- ห้ามเปลี่ยน workflow อนุมัติเดิมจาก Step 10
- ถ้าจะเพิ่ม export/print ให้เปิด branch/scope ใหม่
- ถ้าภายหลังมี migration, bulk operation หรือ script เขียนข้อมูลจริง ต้อง backup database ก่อน


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
