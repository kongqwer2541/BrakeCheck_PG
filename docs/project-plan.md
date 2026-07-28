# แผนพัฒนาโปรเจกต์ BrakeCheck

เอกสารนี้เป็นแผนล่าสุดของโปรเจกต์ BrakeCheck แบบกระชับ

ใช้ไฟล์นี้เป็นแหล่งหลักสำหรับ roadmap, สถานะ Step, และ handoff summary ของงานที่ทำเสร็จแล้ว ส่วนวิธีแตก branch, commit, push และ prompt สำหรับเริ่มงานใหม่ให้ดู `docs/git-branch-workflow.md`

สถานะปัจจุบัน ณ 2026-07-28: โปรแกรมเปลี่ยนมาใช้ PostgreSQL 17 และผ่าน workflow/UAT บนเครื่องทดสอบแล้ว กำลังเตรียมติดตั้งฐานข้อมูลใหม่ที่สะอาดบนเครื่องบริษัท เอกสารนี้เก็บทั้งแผนเดิมและกฎสำคัญที่ต้องรักษาต่อ

BrakeCheck คือ Web Application สำหรับ QC โรงงานผลิตผ้าเบรก เปิดใช้งานผ่าน Chrome และเก็บข้อมูลใน PostgreSQL 17 บนเครื่องหรือเครือข่ายภายในโรงงาน

## เป้าหมายหลัก

- ลดการจดบันทึกคุณภาพบนกระดาษ
- นำเข้าข้อมูลผลิตจาก Excel
- ค้นหา Lot ด้วยบาร์โค้ด
- บันทึกผลตรวจ QC อย่างเป็นระบบ
- ตรวจสอบย้อนหลังได้
- ใช้เครื่องมือฟรี ไม่มีค่าใช้จ่ายรายเดือน
- โค้ดอ่านง่าย เหมาะกับการดูแลระยะยาว

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: PostgreSQL 17
- Tools: VS Code, Git, GitHub, Chrome

## Business Rules สำคัญ

- อ่าน Excel เฉพาะ Sheet `DATA`
- รองรับเฉพาะ `.xlsx` และ `.xlsm`
- Column A = `Lot` เป็นรหัสหลัก ห้ามซ้ำ
- Column R = `Lot Pack` ใช้ยิงบาร์โค้ด ซ้ำได้
- Column X = `Lot ผลิต` ใช้ตรวจบรรจุ ซ้ำได้
- Column T = `วันฝน` ใช้เป็นวันที่จากไฟล์ Excel
- ถ้า `Lot Pack` เจอหลาย `Lot` ต้องให้ผู้ใช้เลือก
- ไม่ลบข้อมูลจริงถาวรถ้าไม่จำเป็น ให้ใช้สถานะหรือ Void
- งานสำคัญต้องมี Audit เพื่อดูย้อนหลังว่าใครทำอะไร

## สถานะงานที่เสร็จแล้ว

### Step 1-3: พื้นฐานระบบ

- สร้างโครงสร้างโปรเจกต์
- ตั้งค่า Backend Server
- เชื่อมต่อฐานข้อมูล (แผนเดิมเริ่มจาก MySQL; ระบบปัจจุบันใช้ PostgreSQL 17)
- เพิ่ม API ตรวจ Server และ Database

### Step 4: Login และผู้ใช้

- Login ด้วยรหัสพนักงานและรหัสผ่าน
- บังคับเปลี่ยนรหัสผ่านครั้งแรก
- Session หมดอายุแล้วกลับหน้า Login
- จัดการผู้ใช้
- Reset Password
- Hash password ก่อนเก็บในฐานข้อมูล

### Step 5: Layout และ Dashboard

- Sidebar
- Top bar
- Dashboard
- Stat cards
- ตารางรายการตรวจสอบ
- Filter, Search, Pagination
- Loading, Empty, Error state

### Step 6: ระบบ Excel และข้อมูล Lot

- อ่านไฟล์ Excel และ Preview
- ตรวจชนิดไฟล์และ Sheet `DATA`
- ตรวจ Lot ซ้ำ
- ตรวจคอลัมน์สำคัญ
- Confirm Save ลง PostgreSQL
- Dashboard ใช้ข้อมูลจริง
- Manual Input Lot
- Edit / Void Lot
- บันทึก Audit การแก้ไข
- หน้าประวัติ Lot, Import, Audit

### Step 7: Barcode Scan / Lot Lookup

- ยิงหรือพิมพ์ `Lot Pack` / `Lot`
- ค้นหา Lot ที่เกี่ยวข้อง
- ถ้าเจอหลาย Lot ให้เลือก Lot ที่ต้องการตรวจ
- แสดงสถานะของแต่ละ Lot เช่น รอตรวจ, Approved, NG, Void
- เปิดหน้า Lot Inspection โดยผูกกับ `Lot` หลัก
- แสดงข้อมูลหัวเรื่อง Lot, Lot Pack, Lot ผลิต, ใบสั่งซื้อ, Code, รุ่น, รายละเอียด, เกรด, จำนวน, วันฝน, ขนาดรูเจาะ, ขนาดรูคว้าน
- รองรับการเลือก Lot ด้วยการคลิกทั้งแถว
- ป้องกันการไปตรวจต่อเมื่อสถานะเป็น Void

### Step 8: Lot Inspection และฟอร์มตรวจมิติ
#### Step 8.1: Lot Inspection Shell

- เปิดหน้า Lot Inspection จาก Step 7
- แสดงหัวเรื่อง Lot แบบกระชับ
- วางแท็บ `ฟอร์มตรวจมิติ` และ `ฟอร์มตรวจบรรจุ` ในหน้าเดียวกัน
- ให้แท็บตรวจบรรจุเป็นโครงไว้ก่อน ยังไม่ทำ Logic ตรวจจริง

#### Step 8.2: Database และ API ฟอร์มตรวจมิติ

- เตรียมตารางบันทึกหัวใบตรวจมิติและค่าตรวจรายช่อง
- ดึงข้อมูลหัวเรื่องจาก Lot อัตโนมัติ
- บันทึก Draft / Completed
- ตรวจสิทธิ์บันทึกและแก้ไขตามบทบาท

#### Step 8.3: UI ฟอร์มตรวจมิติ

- ฟิลด์ก่อนเริ่มตรวจ: รหัสเครื่องมือวัด 5 รายการ, วันที่ตรวจสอบ, กะ, รีเวท No., รหัสผลิต, ประเภทผ้าเบรก, แบบผ้าเบรก, ขนาดความหนารูยึดรีเวท, จำนวนชิ้นสุ่มตรวจ
- วันที่ตรวจสอบดึงจากวันที่ระบบ
- รีเวท No. ดึงจาก Excel Column AM ถ้ามี และกรอกเองได้ถ้าว่าง
- จำนวนชิ้นสุ่มตรวจคำนวณจากจำนวนชิ้นตามกฎ Sampling
- แสดงหัวข้อฟอร์มจาก `form_config`

#### Step 8.4: Auto-advance สำหรับเครื่องมือวัด

- รองรับเครื่องมือวัดที่ส่งค่าเหมือนพิมพ์ตัวเลข + Enter
- เมื่อกด Enter ให้เด้งไปช่องถัดไปในหัวข้อเดียวกัน
- เมื่อครบช่องสุดท้าย ให้เด้งไปหัวข้อถัดไป
- ช่องที่เป็น `-` หรือไม่ต้องวัด ให้ข้ามอัตโนมัติ

#### Step 8.5: Permission, Lock และ Polish

- ทุกสิทธิ์บันทึกผลตรวจได้
- หลังบันทึกสมบูรณ์ ผู้ช่วยหัวหน้าขึ้นไปเท่านั้นที่แก้ไขได้
- หลัง Approved ต้อง Lock ตาม Workflow
- เพิ่ม Validation, Error state, Loading state และ Manual Test

#### Step 8 Handoff Summary: ฟอร์มตรวจมิติพร้อมส่งต่อ Step 9

สถานะล่าสุด:

- Step 8 ฟอร์มตรวจมิติทำงานหลักครบแล้ว และผ่าน QA รอบสุดท้ายแล้ว
- ฟอร์มตรวจมิติผูกกับ `Lot` หลัก แต่หน้าแสดงผลเน้น `Lot Pack` เพื่อให้ QC เห็นเลขที่ใช้ยิงบาร์โค้ดง่าย
- มี API สำหรับโหลดใบตรวจ, บันทึกชั่วคราว, บันทึกสมบูรณ์ และ validate ฝั่ง backend
- มี `form_config_snapshot` และ `pieces_data` เพื่อเก็บ snapshot ของใบตรวจหลังบันทึกสมบูรณ์
- ถ้ามีค่า `fail` ในหัวข้อผ่าน/ไม่ผ่าน ระบบเปลี่ยนสถานะ Lot เป็น `ng`
- ถ้าผ่านทั้งหมด ระบบเปลี่ยนสถานะ Lot เป็น `waiting_pack` เพื่อส่งต่อ Step 9 ตรวจบรรจุ
- Draft เปลี่ยนสถานะ Lot เป็น `temp`
- History/Audit แสดงเหตุผลเปลี่ยนสถานะตรวจมิติเป็นภาษาไทย

สิ่งที่ทำเสร็จแล้วใน Step 8:

- Step 8.1 Lot Inspection Shell และแท็บฟอร์มตรวจมิติ/ตรวจบรรจุ
- Step 8.2 Database/API ฟอร์มตรวจมิติ พร้อม validation, permission, snapshot และ status transition
- Step 8.2.1-8.2.9 เอกสารมือใหม่, safety rules, backup/restore, Windows helper, env example, deployment guide และ documentation safety review
- Step 8.3 UI ฟอร์มตรวจมิติ
- Step 8.4 UI ตารางค่าตรวจ, default form config, เงื่อนไขช่อง `-`, validation ตาม config, note การตรวจ และจำรหัสเครื่องมือบางช่อง
- Step 8.5 Permission, Status และ Final Save Flow
- Step 8.6 Final QA & Cleanup แบบไม่แก้ logic เพิ่ม

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 8:

- `client/src/pages/lot-inspection.page.js` - หน้า Lot Inspection และ UI ฟอร์มตรวจมิติ
- `client/src/services/dimension-inspection.service.js` - frontend service เรียก API ตรวจมิติ
- `client/src/app.js` - routing/state สำหรับ Lot Inspection
- `client/src/styles/main.css` - style ของฟอร์มและตารางตรวจมิติ
- `server/src/services/dimension-inspection.service.js` - business logic, validation, snapshot, permission, status transition
- `server/src/routes/lot.routes.js` และ `server/src/controllers/lot.controller.js` - API route/controller
- `server/src/database/` - schema/migration ที่เกี่ยวข้องกับ dimension inspection และ form config
- `docs/` และ `scripts/` - คู่มือมือใหม่, backup, deployment, Windows helper

เงื่อนไขสำคัญที่ต้องรักษาต่อ:

- บันทึกชั่วคราวได้ทุกสิทธิ์
- แก้ไขหลัง `completed` ได้เฉพาะผู้ช่วยหัวหน้าขึ้นไป
- ห้ามย้อน `completed` กลับเป็น draft
- Lot ที่ `approved` หรือ `void` ต้องห้ามแก้ draft/complete
- `form_config_snapshot` ของใบตรวจที่ completed ต้องไม่เปลี่ยนย้อนหลังตาม config ใหม่
- PDF/ประวัติย้อนหลังในอนาคตควรอ่านจาก snapshot
- ช่องที่ไม่ต้องวัดต้องเป็น `-` และ backend ต้อง validate ซ้ำเสมอ
- หัวข้อรูเจาะ/รูคว้านยังผูกกับชื่อหัวข้อภาษาไทยใน Step 8 เพื่อคุม scope; แนวทางระยะยาวให้ย้ายไป Step 12 ด้วย config key เช่น `rule_key = hole_inspection`

### Step 9: ฟอร์มตรวจบรรจุ

- ตรวจ Lot ผลิต / สติกเกอร์ / จำนวน / รายละเอียดบรรจุ
- รองรับข้อมูลจาก Excel และการตรวจจริง

#### Step 9 Handoff Summary: ฟอร์มตรวจบรรจุพร้อมส่งต่อ Step 10

สถานะล่าสุด:

- Step 9 ฟอร์มตรวจบรรจุทำงานหลักครบแล้ว และพร้อมส่งต่อ Step 10 Approved Workflow
- ฟอร์มตรวจบรรจุผูกกับ `Lot` หลัก และแสดง `Lot Pack` / `Lot ผลิต` / รหัสอ้างอิงตรวจบรรจุให้ QC เห็นชัด
- หลังตรวจมิติผ่านทั้งหมด Lot จะเข้าสถานะ `waiting_pack` เพื่อเปิดตรวจบรรจุ
- บันทึกชั่วคราวตรวจบรรจุได้ และถ้ามีหัวข้อ `fail` ระบบเปลี่ยน Lot เป็น `ng` ทันที
- บันทึกสมบูรณ์ตรวจบรรจุถ้าผ่านทั้งหมด ระบบเปลี่ยน Lot เป็น `waiting_approve`
- บันทึกสมบูรณ์ตรวจบรรจุถ้ามี `fail` อย่างน้อย 1 หัวข้อ ระบบเปลี่ยน Lot เป็น `ng`
- ใบตรวจบรรจุที่ `completed` แก้ไขได้เฉพาะ `assistant` และ `head`
- หัวข้อฟอร์มตรวจบรรจุ active อยู่ที่ `form_config` ชุด `201-205`; ids เก่า `1-5` ถูกปิด active เพื่อเลี่ยงชนกับข้อมูลจริง

สิ่งที่ทำเสร็จแล้วใน Step 9:

- สร้างตาราง `packing_inspections` สำหรับใบตรวจบรรจุ
- เพิ่ม migration Step 9 และ seed/default `form_config` สำหรับหัวข้อตามแบบฟอร์มตรวจบรรจุ
- เพิ่ม API โหลดใบตรวจบรรจุ, บันทึกชั่วคราว, บันทึกสมบูรณ์
- เพิ่ม backend validation ว่าผลตรวจต้องเป็น `pass` หรือ `fail`
- Backend ใช้ config จาก server และ snapshot เดิม ไม่เชื่อ `formConfigSnapshot` จาก client
- บังคับกรอกหมายเหตุเมื่อบันทึกสมบูรณ์แล้วมีหัวข้อ `fail`
- ใช้ `Lot ผลิต` จาก Excel เป็นรหัสอ้างอิงตรวจบรรจุ ถ้าไม่มีให้ fallback ไปใช้ `รหัสผลิต` จากฟอร์มตรวจมิติ
- ถ้าไม่มีทั้ง `Lot ผลิต` และ `รหัสผลิต` จากฟอร์มตรวจมิติ ต้องกลับไปบันทึกตรวจมิติก่อน
- เพิ่ม UI แท็บฟอร์มตรวจบรรจุในหน้า Lot Inspection
- เพิ่มปุ่มผ่าน/ไม่ผ่าน 1 ครั้งต่อหัวข้อ, ช่องหมายเหตุ, ชื่อผู้ตรวจ, ตำแหน่ง และวันที่ตรวจบรรจุจากเวลาบันทึกล่าสุด
- เพิ่ม UX กรณีเปิดฟอร์มตรวจบรรจุแล้วไม่มีรหัสอ้างอิง ให้กดกลับไปฟอร์มตรวจมิติได้ชัดเจน
- เพิ่ม test สำคัญของ packing service และ test UX สำหรับ error กลับไปฟอร์มตรวจมิติ

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 9:

- `server/src/database/migrations/step-9-packing-inspection.sql` - migration ตารางตรวจบรรจุและหัวข้อ default
- `server/src/services/packing-inspection.service.js` - business logic, validation, snapshot, fallback รหัสอ้างอิง และ status transition
- `server/src/services/packing-inspection.service.test.js` - test rule สำคัญของฟอร์มตรวจบรรจุ
- `server/src/routes/lot.routes.js` และ `server/src/controllers/lot.controller.js` - API route/controller ตรวจบรรจุ
- `client/src/services/lots.api.js` - frontend API ตรวจบรรจุ
- `client/src/pages/lot-inspection.page.js` - UI ฟอร์มตรวจมิติ/ตรวจบรรจุ
- `client/src/pages/lot-inspection.page.test.mjs` - test UX error ตรวจบรรจุ
- `client/src/app.js` - state/routing สำหรับโหลดและบันทึกฟอร์มตรวจบรรจุ
- `client/src/styles/main.css` - style ของฟอร์มตรวจบรรจุ
- `docs/project-plan.md` และ `docs/git-branch-workflow.md` - handoff และ workflow ก่อน Step 10

เงื่อนไขสำคัญที่ต้องรักษาต่อ:

- ห้ามให้ client กำหนด snapshot หรือหัวข้อเองโดยไม่ผ่าน config จาก server
- ห้ามเปิดบันทึกตรวจบรรจุถ้า Lot ไม่อยู่ flow ที่ถูกต้อง เช่น ไม่ใช่ `waiting_pack`, `temp`, `ng` ตามเงื่อนไขที่ service อนุญาต
- ถ้าผลตรวจบรรจุมี `fail` ต้องเป็น `ng` ทั้ง draft และ completed
- ถ้าบันทึกสมบูรณ์และผ่านทั้งหมด ต้องเป็น `waiting_approve`
- ใบตรวจบรรจุ `completed` แก้ไขได้เฉพาะ `assistant` / `head`
- Lot ที่ `approved` หรือ `void` ต้องล็อก ไม่ให้ตรวจ/แก้ไขต่อ
- วันที่ตรวจบรรจุใช้วันที่ตอนกด draft หรือ completed ล่าสุด ไม่ใช้วันที่ตรวจมิติ
- ข้อมูล backup, `.env`, `*.sql`, และ `backups/` ห้าม commit ขึ้น GitHub

### Step 10: Approved Workflow

- หัวหน้า Approved
- ยกเลิก Approved ก่อนแก้ไข
- ส่งกลับแก้ไขได้

#### Step 10.1 Handoff Summary: ตรวจและอนุมัติ

สถานะล่าสุด:

- เพิ่มเมนู `ตรวจและอนุมัติ` สำหรับ `head` และ `assistant`
- เมนูมี badge นับรวม Lot สถานะ `waiting_approve` และ `ng`
- เพิ่มหน้า `คิวตรวจและอนุมัติ` พร้อมแท็บ `รออนุมัติ` และ `งาน NG`
- หน้า queue ค้นหาได้จาก `Lot`, `Lot Pack`, `Lot ผลิต`, `รุ่น`
- หน้า queue ใช้วันที่ผลิต/วันที่ฝนจาก Excel เป็นตัวกรอง และมีตัวเลือกดู `ทั้งหมด`
- ตาราง queue รองรับ tablet ด้วย horizontal scroll และมีคอลัมน์ `ไฟล์แนบ` แสดง `-` ไว้ก่อน Step 10.2
- หน้า queue มีเฉพาะปุ่ม `เปิดตรวจสอบ`; การตัดสินใจต้องทำในหน้า Lot Inspection
- เพิ่มแผง `ตรวจและอนุมัติ` ในหน้า Lot Inspection เฉพาะ `head` และ `assistant`
- `อนุมัติ`: `waiting_approve` -> `approved`, audit reason = `อนุมัติ Lot`
- `ยกเลิกอนุมัติ`: `approved` -> `waiting_approve`, ต้องกรอกหมายเหตุ
- `ส่งกลับแก้ไข`: `waiting_approve` -> `need_fix`, ต้องกรอกหมายเหตุ
- `ทบทวน NG`: `ng` -> `need_fix`, ต้องกรอกหมายเหตุ
- ก่อนอนุมัติ backend ตรวจซ้ำว่าใบตรวจมิติและใบตรวจบรรจุ `completed` และไม่มีผล `fail`
- `need_fix` ไม่ทำคิวแยก ให้หาได้จาก Dashboard filter หรือ search Lot

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 10.1:

- `server/src/database/migrations/step-10-1-approved-workflow.sql` - เพิ่ม audit action สำหรับ approved workflow
- `server/src/services/lot.service.js` - queue, workflow validation, status transition, audit log
- `server/src/routes/lot.routes.js` และ `server/src/controllers/lot.controller.js` - API queue และ action
- `server/src/services/history.service.js` - label/filter audit action ใหม่
- `client/src/pages/approval-queue.page.js` - UI คิวตรวจและอนุมัติ
- `client/src/pages/lot-inspection.page.js` - แผงตรวจและอนุมัติ
- `client/src/app.js` และ `client/src/services/lots.api.js` - routing/state/API


#### Step 10 Handoff Summary: Approved Workflow และไฟล์แนบ Lot

สถานะล่าสุด:

- Step 10 merge เข้า `master` แล้ว แยกเป็น 3 ช่วงหลัก:
  - Step 10.1: คิว `ตรวจและอนุมัติ` และ Approved Workflow
  - Step 10.1.1: หลักฐานผู้อนุมัติ/ผู้รับทราบ NG พร้อม snapshot ชื่อและตำแหน่ง
  - Step 10.2: ไฟล์แนบผูกกับ `Lot`
- เมนู `ตรวจและอนุมัติ` ใช้สำหรับ `head` และ `assistant` เพื่อดู Lot สถานะ `waiting_approve` และ `ng`
- คิวตรวจและอนุมัติค้นหาได้จาก `Lot`, `Lot Pack`, `Lot ผลิต`, `รุ่น` และใช้วันที่ผลิต/วันฝนจาก Excel เป็นตัวกรอง
- หน้า Lot Inspection มีแผง `ตรวจและอนุมัติ` เฉพาะ `head` และ `assistant`
- การอนุมัติ Lot ต้องผ่าน backend validation ว่าใบตรวจมิติและใบตรวจบรรจุ `completed` แล้ว และไม่มีผล `fail`
- Lot ที่ `approved` ถูก lock การแก้ไขฟอร์มตรวจ ต้องยกเลิกอนุมัติก่อนแก้ไข
- `send_back` เปลี่ยน Lot เป็น `need_fix`; ไม่มีคิวแยกสำหรับ `need_fix` ให้ค้นจาก Dashboard filter หรือ search Lot
- Lot ที่เป็น `ng` มีปุ่ม `รับทราบ NG` และ `ทบทวน NG`; การรับทราบ NG เก็บชื่อผู้กด ตำแหน่ง วันที่ และเหตุผลใน audit evidence
- หลักฐาน `approved` และ `ng confirmed` อ่านจาก audit snapshot ก่อน fallback ไป users เพื่อให้หลักฐานย้อนหลังไม่เปลี่ยนตามชื่อ/ตำแหน่งปัจจุบัน
- ไฟล์แนบผูกกับ `Lot` ผ่านตาราง `lot_attachments` และไฟล์จริงเก็บใต้ `storage/attachments/lots`
- ไฟล์แนบรองรับ `JPG`, `PNG`, `WEBP`, `PDF` ขนาดไม่เกิน 5MB ต่อไฟล์ และจำกัด 10 ไฟล์ active ต่อ Lot
- ตรวจชนิดไฟล์แนบทั้งนามสกุล, MIME type และ magic bytes; PDF ยอมให้พบ `%PDF-` ภายในช่วงต้นไฟล์ 1KB
- แก้ชื่อไฟล์ภาษาไทยที่ browser/multer ส่งมาเป็น latin1 mojibake สำหรับไฟล์ใหม่
- สิทธิ์ไฟล์แนบ:
  - `head`: แนบ / ดาวน์โหลด / ลบ ได้
  - `assistant`: แนบ / ดาวน์โหลด / ลบ ได้
  - `officer`: แนบ / ดาวน์โหลด ได้ แต่ลบไม่ได้
- การลบไฟล์แนบเป็น soft delete เท่านั้น และมี audit action `delete_attachment`
- การแนบไฟล์มี audit action `upload_attachment`
- คิว `ตรวจและอนุมัติ` แสดงจำนวนไฟล์แนบ active ในคอลัมน์ `ไฟล์แนบ`
- หน้า Lot Inspection วางปุ่ม `แนบไฟล์` ใกล้ปุ่มบันทึก และย้ายกล่องรายการไฟล์แนบไว้ด้านล่างสุดของหน้า

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 10:

- `server/src/database/migrations/step-10-1-approved-workflow.sql`
- `server/src/database/migrations/step-10-1-1-ng-acknowledgement.sql`
- `server/src/database/migrations/step-10-1-1-audit-actor-snapshot.sql`
- `server/src/database/migrations/step-10-2-lot-attachments.sql`
- `server/src/services/lot.service.js` - queue, approval workflow, status transition, audit log
- `server/src/services/lot-approval-evidence.service.js` - approval/NG evidence จาก audit snapshot
- `server/src/services/lot-attachment.service.js` - validation, storage metadata, soft delete, download guard
- `server/src/routes/lot.routes.js` และ `server/src/controllers/lot.controller.js` - API สำหรับ approval และ attachments
- `server/src/services/history.service.js` - audit action labels/filter
- `client/src/pages/approval-queue.page.js` - UI คิวตรวจและอนุมัติ
- `client/src/pages/lot-inspection.page.js` - แผงตรวจและอนุมัติ, ปุ่มแนบไฟล์, รายการไฟล์แนบ
- `client/src/app.js` และ `client/src/services/lots.api.js` - state และ API call ฝั่ง frontend

สิ่งที่ควรรู้หลัง Step 10:

- ก่อนใช้งานฐานข้อมูลใหม่ต้องรัน migration ที่เกี่ยวข้อง และต้อง backup database ก่อนเสมอ
- ไฟล์เก่าที่เคยแนบแล้วชื่อไฟล์ภาษาไทยเพี้ยนจะไม่ถูกซ่อมอัตโนมัติ ถ้าต้องการซ่อมชื่อย้อนหลังให้ทำเป็นงานแยก
- ถ้าธุรกิจต้องการ lock การแนบไฟล์หลัง Lot `approved` ให้แยกเป็น policy เพิ่มใน Step ถัดไป
- Step ถัดไปตาม roadmap คือ Step 11 Export Report หรือ Step 12 System Settings ตามลำดับความสำคัญที่ผู้ใช้เลือก

### Step 11: Export Report

- ส่งออก Excel หรือ PDF
- ใช้ข้อมูล Snapshot จากใบตรวจ
- Step 11.1: Export Excel แบบเอกสารอ่าน/แนบงาน โดยรวมข้อมูลมิติและบรรจุในไฟล์เดียว
- Step 11.2: Export PDF ใช้เงื่อนไขความพร้อมเดียวกับ Excel และแสดงหัวข้อรายงานเดียวกันสำหรับอ่านหรือเก็บเป็นเอกสาร
- Step 11.2 ต้องมีฟอนต์ภาษาไทยบนเครื่องที่รัน server; ค่าเริ่มต้นใช้ Tahoma ของ Windows และสามารถกำหนด `PDF_THAI_FONT_PATH` / `PDF_THAI_BOLD_FONT_PATH` ใน `.env` ได้ถ้าเครื่องโรงงานเก็บฟอนต์ไว้คนละ path
- ข้อมูลสำหรับคำนวณภายนอก เช่น CP/CPK ยังแยกไว้ใน Step 14

#### Step 11 Handoff Summary: Export Report

สถานะล่าสุด:

- Step 11 merge เข้า `master` แล้ว แยกเป็น 2 ช่วงหลัก:
  - Step 11.1: Export Excel รายงาน Lot แบบเอกสารอ่าน/แนบงาน รวมข้อมูลมิติและบรรจุในไฟล์เดียว
  - Step 11.2: Export PDF รายงาน Lot หน้าตาเดียวกับ Excel สำหรับอ่านหรือเก็บเป็นเอกสาร
- หน้า Export Report ใช้รายการ Lot ที่ส่งออกได้จากกลุ่ม `approved` และ `confirmed_ng`
- Export Excel/PDF ใช้ข้อมูล snapshot จากใบตรวจมิติและใบตรวจบรรจุที่ `completed` แล้ว
- Export ต้องผ่านเงื่อนไขความพร้อมเดียวกัน:
  - Lot ต้อง `approved` พร้อมหลักฐานอนุมัติ หรือ `ng` พร้อมหลักฐานรับทราบ NG
  - ใบตรวจมิติและใบตรวจบรรจุต้องบันทึกสมบูรณ์แล้ว
  - snapshot ของใบตรวจทั้งสองต้องอ่านได้และมีข้อมูลหัวข้อ
- Export PDF รองรับข้อความยาวด้วยการตัดบรรทัดในตาราง และกันส่วน `หลักฐานอนุมัติ` ไม่ให้หัวข้อแยกหน้ากับข้อมูล
- Export PDF ตรวจฟอนต์ภาษาไทยก่อนสร้างไฟล์ ถ้าเครื่อง server ไม่มีฟอนต์ไทยจะแจ้ง error ชัดเจนแทนการสร้างไฟล์ที่อ่านไทยไม่ได้
- Step 11 เป็นรายงานสำหรับอ่าน/แนบงานเท่านั้น ไม่ใช่ไฟล์สำหรับคำนวณ CP/CPK

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 11:

- `client/src/pages/export-report.page.js` - UI หน้า Export Report และปุ่ม Export Excel/PDF
- `client/src/services/reports.api.js` - frontend API สำหรับดาวน์โหลดไฟล์รายงาน
- `client/src/app.js` - state และ handler การโหลดคิว/ดาวน์โหลดรายงาน
- `server/src/routes/report-export.routes.js` - route รายงานพร้อม auth/role
- `server/src/controllers/report-export.controller.js` - controller ส่งไฟล์ Excel/PDF
- `server/src/services/report-export.service.js` - business logic, validation, readiness, Excel/PDF builder
- `server/src/services/report-export.service.test.js` - test rules สำคัญของ Export Report
- `client/src/pages/export-report.page.test.mjs` - test UI หน้า Export Report

สิ่งที่ควรรู้หลัง Step 11:

- Step 11 ไม่เปลี่ยนข้อมูลการตรวจและไม่แตะ schema/database migration
- PDF ใช้ค่าเริ่มต้น Tahoma ของ Windows; ถ้าเครื่องโรงงานเก็บฟอนต์คนละ path ให้ตั้ง `PDF_THAI_FONT_PATH` และถ้าต้องการตัวหนาให้ตั้ง `PDF_THAI_BOLD_FONT_PATH` ใน `.env`
- ถ้า Export PDF ใช้ไม่ได้บนเครื่องปลายทาง ให้ตรวจฟอนต์ไทยบนเครื่องที่รัน server ก่อนตรวจ logic รายงาน
- ข้อมูลสำหรับคำนวณภายนอก เช่น CP/CPK ให้ทำต่อใน Step 14 โดยอ่านจาก completed snapshot และ export เป็นข้อมูลดิบ/summary สำหรับวิเคราะห์นอกระบบ

### Step 12: System Settings

- ตั้งค่าจำนวนสุ่มตรวจ
- ตั้งค่าหัวข้อฟอร์ม
- เตรียม Dynamic Form ตามแผนระยะยาว

#### Step 12 Handoff Summary: System Settings

สถานะล่าสุด:

- Step 12 merge เข้า `master` แล้ว แยกเป็น 3 ช่วงหลัก:
  - Step 12.1: System Settings Foundation เปิดเมนู `ตั้งค่าระบบ`, เพิ่มโครงอ่านค่า settings, เพิ่ม `form_config.rule_key`, เพิ่ม `system_setting_audit_logs`, และ seed `rule_key = hole_inspection` ให้หัวข้อรูเจาะ/รูคว้าน
  - Step 12.2: Inspection Topic Management ให้ `head` และ `assistant` เพิ่มหัวข้อใหม่, แก้เฉพาะลำดับ/หมายเหตุ, ปิดใช้งานหัวข้อ, ซ่อน/แสดง inactive, เก็บ audit, และบล็อกการแก้ถ้ามี inspection draft ค้าง
  - Step 12.3: Sampling Rules + Instrument Prefix ให้แก้จำนวนสุ่มตรวจแบบบันทึกทั้งชุด และแก้ prefix รหัสเครื่องมือวัด 5 ช่องจากหน้า settings
- ใบตรวจ completed เก่ายังใช้ snapshot เดิม ไม่เปลี่ยนย้อนหลังเมื่อหัวข้อ/จำนวนสุ่มตรวจ/prefix เปลี่ยน
- ใบตรวจใหม่ใช้เฉพาะหัวข้อ active และใช้ settings ล่าสุด
- การแก้หัวข้อสำคัญ เช่น ชื่อ, ชนิด, จำนวนช่อง, ทศนิยม, ตรวจชิ้นที่, หรือ `rule_key` ให้ใช้แนวทางเพิ่มหัวข้อใหม่แล้วปิดหัวข้อเก่าแทนการแก้ทับ
- ห้ามชื่อซ้ำใน active topics ของฟอร์มเดียวกัน แต่ชื่อซ้ำกับ inactive ได้
- การปิดหัวข้อ ไม่มี hard delete และยังไม่มี restore inactive ใน Step 12
- Sampling rules ใช้ตารางเดิม `sampling_rules`; ตอนบันทึกจะ validate ว่าเริ่มที่ 1, ช่วงต่อเนื่อง, ไม่ซ้อน, ไม่เว้นช่อง, แถวสุดท้ายเป็น "ขึ้นไป", แล้ว replace ทั้งชุดใน transaction พร้อม audit
- Instrument prefix ใช้ตาราง `dimension_instrument_prefixes` และต้องอยู่รูปแบบ `A-00-` เช่น `A-02-`
- ถ้ามี inspection draft ค้าง ระบบจะบล็อกการแก้หัวข้อ, จำนวนสุ่มตรวจ, และ prefix เครื่องมือวัด พร้อมบอกจำนวน draft ค้าง
- ฟอร์มตรวจมิติไม่เชื่อ `sampleCount` จาก browser แต่คำนวณจาก `sampling_rules` ฝั่ง backend
- remembered instrument ใน browser จะไม่เติมอัตโนมัติถ้า prefix ไม่ตรง settings ใหม่
- Packing numeric รองรับหัวข้อชนิดตัวเลขและ export report แสดงค่าตาม snapshot โดยยังไม่ทำ CP/CPK ใน Step 12

ไฟล์สำคัญที่เกี่ยวข้องกับ Step 12:

- `client/src/pages/system-settings.page.js` - UI หน้า Settings, topic management, sampling rules, instrument prefixes, audit history
- `client/src/services/settings.api.js` - frontend API สำหรับ settings
- `client/src/app.js` - state/handler ของหน้า settings และการส่ง settings ไปฟอร์มตรวจ
- `client/src/pages/lot-inspection.page.js` - ใช้ form config, sampling rules และ instrument prefixes ในฟอร์มตรวจ
- `server/src/routes/settings.routes.js` - settings routes พร้อม auth/role guard
- `server/src/controllers/settings.controller.js` - controller สำหรับ settings
- `server/src/services/settings.service.js` - validation, transaction, audit, draft blocking ของ settings
- `server/src/services/dimension-inspection.service.js` - ใช้ `rule_key`, sampling rules, และ instrument prefixes ตอนตรวจมิติ
- `server/src/database/schema.sql` - schema settings ที่เกี่ยวข้อง
- `server/src/database/migrations/step-12-1-system-settings-foundation.sql` - migration foundation ของ Step 12
- `server/src/database/migrations/step-12-3-sampling-prefix-settings.sql` - migration ตาราง prefix เครื่องมือวัด
- `server/src/services/settings.service.test.js` - test validation/audit/rollback ของ settings

สิ่งที่ควรรู้หลัง Step 12:

- ก่อนรัน migration กับฐานข้อมูลจริงต้อง backup database ก่อนเสมอ
- ห้าม DROP/TRUNCATE/reset ฐานข้อมูลจริง
- ห้าม commit `.env`, backup, token, password, หรือข้อมูลโรงงานจริง
- Step 12 ตั้งค่าระบบและ dynamic form เท่านั้น งาน export ข้อมูลสำหรับ CP/CPK ยังอยู่ Step 14
- Step ถัดไปตาม roadmap คือ Step 13: Inspection Work Queue Pages

### Step 13: Inspection Work Queue Pages

#### Step 13 Handoff Summary: Inspection Work Queue Pages

สถานะล่าสุด:

- Step 13 merge เข้า `master` แล้ว: PR #49 จาก branch `codex/step-13-inspection-work-queue`
- `master` ล่าสุดหลัง merge อยู่ที่ commit `506aee6`
- Step 13 เพิ่มหน้า QC ติดตามงานตรวจสอบ โดยใช้เมนูเดิม `ตรวจมิติ` และ `ตรวจบรรจุ`
- ไม่มีการแก้ schema ฐานข้อมูล ไม่มี migration และไม่มี dependency ใหม่

สิ่งที่ทำเสร็จแล้วใน Step 13:

- Dimension Inspection Work Queue สำหรับติดตามงานตรวจมิติ
- Packing Inspection Work Queue สำหรับติดตามงานตรวจบรรจุ
- แสดงงานของวันที่ผลิตล่าสุดที่มีข้อมูล โดยใช้ `production_date` จาก Excel เหมือน Dashboard
- แสดงทุกสถานะสำคัญ เช่น รอตรวจ, กำลังตรวจ, ตรวจแล้ว, รอแก้ไข, NG, รออนุมัติ และ Approved
- ค้นหา Lot / Lot Pack / Lot ผลิต / รุ่น / ใบสั่งซื้อ ได้
- กรองวันที่, กรองสถานะ, ย้อนหลัง 1 วัน, ย้อนหลัง 3 วัน และไปวันล่าสุดได้
- หน้า queue ใช้รูปแบบตารางบน desktop และการ์ดบน tablet/mobile เพื่อให้ QC แตะใช้งานง่าย
- เปิดใบตรวจเดิมจาก queue ด้วยดับเบิ้ลคลิกหรือดับเบิ้ลแตะ เพื่อลดความเสี่ยงกดผิด
- Backend API ของ queue เป็น read-only และมี auth/role guard สำหรับ `head`, `assistant`, `officer`

ไฟล์สำคัญที่เพิ่มหรือแก้ใน Step 13:

- `client/src/pages/inspection-queue.page.js` - หน้า queue สำหรับตรวจมิติ/ตรวจบรรจุ
- `client/src/services/inspection-queues.api.js` - frontend API สำหรับดึงข้อมูล queue
- `client/src/app.js` - route/state/handler ของหน้า queue และการกลับจากใบตรวจ
- `client/src/components/main-layout.js` - เปิดเมนู `ตรวจมิติ` และ `ตรวจบรรจุ`
- `client/src/config/app.config.js` - permission ของเมนู queue
- `client/src/styles/main.css` - style ตาราง/การ์ด/filter ของ queue
- `server/src/services/inspection-queue.service.js` - query และจัดสถานะ queue
- `server/src/controllers/inspection-queue.controller.js` - controller ของ queue
- `server/src/routes/inspection-queue.routes.js` - route `/api/inspection-queues/:queueType`
- `server/src/app.js` - register route ของ queue

เงื่อนไขสำคัญที่ต้องรักษาต่อ:

- หน้า queue ต้องเป็นหน้าติดตามงาน ไม่ใช่หน้าบันทึกผลตรวจใหม่
- Packing queue ควรแสดงงานที่เกี่ยวกับตรวจบรรจุเท่านั้น งานตรวจมิติเสร็จแล้วจึงไปต่อ workflow ตรวจบรรจุ
- NG ให้ยึดแหล่งล่าสุดของงานตรวจนั้น ๆ และต้องไม่ทำให้หัวหน้าเห็น NG ผิดประเภท
- ใช้ `production_date` เป็นวันที่หลักสำหรับงานรายวันตาม Dashboard
- ข้อมูลที่แสดงจาก server ต้อง escape ก่อน render ใน browser
- API ต้องมี auth/role guard และไม่เปิดข้อมูลให้ผู้ไม่ได้ login

สิ่งที่ยังไม่ควรทำ:

- ห้ามขยาย Step 13 ไปเป็นระบบอนุมัติใหม่ เพราะมี approval workflow อยู่แล้ว
- ห้ามเริ่ม Step 14 ใน scope Step 13
- ห้ามเพิ่ม dependency/framework ใหม่โดยไม่อนุมัติ
- ห้ามแก้ schema หรือ migration ถ้าไม่จำเป็น
- ห้าม DROP, TRUNCATE, reset database หรือ hard delete ข้อมูลจริง
- ห้าม commit `.env`, `*.sql`, `backups/`, token, password หรือข้อมูลโรงงานจริง

สิ่งที่ต้องตรวจสอบก่อนเริ่ม Step 14:

- `git status` ต้อง clean และอยู่บน `master`
- `master` ต้อง pull ล่าสุดหลัง merge Step 13 แล้ว
- อ่าน `AGENTS.md`, `docs/project-plan.md` หัวข้อ Step 13 Handoff Summary และ Step 14, และ `docs/git-branch-workflow.md`
- ตรวจ `/api/health` และ `/api/database/health` ถ้าจะทดสอบผ่าน browser/API
- ถ้า Step 14 ต้องอ่านข้อมูลจริงจำนวนมาก ให้เริ่มจาก filter แคบ ๆ ก่อน
- ถ้าจะมี migration หรือการแก้ข้อมูลจริง ต้อง backup database ก่อนและขออนุญาตผู้ใช้ก่อน

#### Step 14 New Chat Context

โปรเจกต์ BrakeCheck คือ web app สำหรับ QC โรงงานผ้าเบรก ใช้ Chrome ในเครื่อง local/Windows เพื่อลดงานเอกสารและเก็บประวัติการตรวจคุณภาพ

Tech stack:

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: PostgreSQL 17
- Export Excel เดิมใช้ `exceljs`
- ทำงาน local-first ไม่เพิ่มบริการเสียเงินหรือ cloud database ถ้าไม่ได้อนุมัติ

Step 13 ทำเสร็จแล้ว:

- เพิ่ม Dimension/Packing Inspection Work Queue
- ใช้เมนูเดิม `ตรวจมิติ` และ `ตรวจบรรจุ`
- แสดงงานตาม `production_date` ล่าสุดที่มีข้อมูล
- ค้นหา/กรอง/ย้อนวัน/ไปวันล่าสุดได้
- เปิดใบตรวจเดิมด้วยดับเบิ้ลคลิกหรือดับเบิ้ลแตะ
- ไม่มี database migration และไม่มี dependency ใหม่

Step 14 ควรเริ่มจาก:

- วางแผนหน้า Measurement History Export สำหรับดึงค่าตรวจมิติออกไปวิเคราะห์สถิติภายนอก
- ยืนยันว่าจะ export เฉพาะข้อมูลที่ตรวจเสร็จ/อนุมัติแล้วก่อน เพื่อกัน draft ปน
- เริ่มจาก filter รุ่น, ช่วงวันที่, หัวข้อการวัด และเลือกหลาย Lot
- Export เป็น Excel `.xlsx` โดยใช้ `exceljs` เดิมถ้าเพียงพอ
- ใช้รูปแบบ `raw_data` แบบ 1 แถว = 1 จุดวัด เช่น 1 ชิ้นวัดความหนา 3 จุด ต้องออกมา 3 แถว

Requirement Step 14 สำหรับข้อมูลสถิติ:

- กรองตามรุ่น/รายละเอียดได้
- กรองตามช่วงวันที่ผลิต `production_date` และถ้าไม่ซับซ้อนค่อยเพิ่มวันที่ตรวจ
- เลือกหลาย Lot ได้
- เลือกหัวข้อการวัดได้ เช่น ความหนา, ความกว้าง, ความยาว
- Export ค่า raw data เป็น Excel โดย 1 แถวเท่ากับ 1 จุดวัด
- ต้องมี Lot, Lot Pack, Lot ผลิต, วันที่ผลิต, วันที่ตรวจ, รุ่น, รายละเอียด, ใบสั่งซื้อ, เกรด, จำนวน
- ต้องมีหัวข้อที่ตรวจ, ชิ้นที่, จุดวัดที่, ค่าที่วัดได้, เครื่องมือวัด, ผู้ตรวจ
- ต้องมี sheet `summary` สรุป filter, จำนวน Lot, จำนวนค่าที่ export, ช่วงวันที่ และจำนวนค่าแยกตามหัวข้อ
- ควรมี sheet `readme` หรือ `metadata` เพื่อบอกว่า export จาก filter อะไรและเมื่อไหร่
- Spec ยังไม่ผูกในระบบ เพราะแต่ละรุ่นอ้างอิง Drawing และค่า `+/-` ไม่เหมือนกัน
- เตรียมคอลัมน์ว่างไว้ให้เติมภายนอก เช่น `drawing_ref`, `nominal`, `lsl`, `usl`, `tolerance_note`
- ยังไม่คำนวณ CP/CPK, MIN/MAX เชิงตัดสินคุณภาพ หรือ OK/NG จาก spec ในระบบ

กฎสำคัญที่ต้องรักษา:

- ห้ามลบฐานข้อมูลจริง ห้าม DROP/TRUNCATE/reset database
- ห้าม commit `.env`, `*.sql`, `backups/`, password, token หรือข้อมูลโรงงานจริง
- ห้ามเพิ่ม dependency/framework ใหม่โดยไม่ขออนุมัติ
- ถ้ากระทบ schema, migration, bulk query หรือข้อมูลจริง ต้องเตือน backup ก่อน
- อ่านข้อมูลจาก snapshot/ข้อมูลที่บันทึกจริง ไม่ใช้ config ปัจจุบันไปเปลี่ยนข้อมูลย้อนหลัง
- Step 14 คือ export ข้อมูลเพื่อวิเคราะห์ภายนอก ไม่ใช่ระบบคำนวณ CP/CPK ในแอป

ไฟล์ที่ควรอ่านก่อนเริ่ม Step 14:

- `AGENTS.md`
- `README.md` เฉพาะส่วน setup/export ถ้าจำเป็น
- `docs/project-plan.md` หัวข้อ Step 13 Handoff Summary, Step 14 New Chat Context และ Step 14
- `docs/git-branch-workflow.md` หัวข้อปิดงาน Step 13 และ checklist ก่อนเริ่ม Step 14
- `server/src/services/report-export.service.js` เพื่อดู pattern export เดิม
- `server/src/services/dimension-inspection.service.js` เพื่อเข้าใจ snapshot ค่าตรวจมิติ
- `server/src/routes/report-export.routes.js` และ controller ที่เกี่ยวข้อง ถ้าจะ reuse pattern export

### Step 14: Measurement History Export

เป้าหมาย:

- ให้ผู้ใช้กรองชื่อรุ่นและเลือกหลาย Lot เพื่อดึงข้อมูลค่าตรวจมิติออกเป็น Excel ชุดเดียว
- ใช้ข้อมูล Excel ที่ export ไปวิเคราะห์ MIN / MAX / CP / CPK ภายนอกโปรแกรม
- โปรแกรมทำเฉพาะดึงข้อมูลและจัดรูปแบบ ไม่คำนวณ CP / CPK ในระบบ

ขอบเขตที่แนะนำ:

- หน้า Export ข้อมูลมิติ
  - กรองตามรุ่น
  - กรองตามหัวข้อการวัด เช่น ความหนา, ความกว้าง, ความยาว
  - กรองตามวันที่ผลิต `production_date`
  - กรองตามช่วงวันที่ตรวจ
  - แสดงรายการ Lot ที่มีใบตรวจมิติ
  - เลือกหลาย Lot ได้
  - กด Export Excel
- Excel ที่ export ควรมี sheet `raw_data`
  - รุ่น
  - Code
  - Lot
  - Lot Pack
  - Lot ผลิต
  - วันที่ตรวจมิติ
  - ผู้ตรวจ
  - หัวข้อการวัด
  - ลำดับชิ้นที่สุ่ม
  - ลำดับช่องวัด
  - ค่าที่วัดจริง
  - รหัสเครื่องมือวัด
  - สถานะใบตรวจ
- Excel ควรมี sheet `summary` สำหรับสรุป filter, จำนวน Lot, จำนวนค่าที่ export, ช่วงวันที่ และจำนวนค่าแยกตามหัวข้อ
- Excel ควรมี sheet `readme` หรือ `metadata` เพื่อบอกว่าไฟล์นี้ export จากระบบด้วย filter อะไร
- รูปแบบ `raw_data` ต้องเป็นตารางยาว โดย 1 แถว = 1 จุดวัด เช่น 1 ชิ้นวัดความหนา 3 จุด ต้องออกมา 3 แถว
- Spec ยังไม่ผูกในระบบ ให้เตรียมคอลัมน์ว่าง เช่น `drawing_ref`, `nominal`, `lsl`, `usl`, `tolerance_note` เพื่อให้ผู้ใช้เติมจาก Drawing ใน Excel ภายนอก

เงื่อนไข:

- เริ่มจากใบตรวจมิติที่ `completed` เท่านั้น
- ข้ามค่า `-` และช่องว่าง ไม่เอาไป export เป็นค่าตัวเลข
- อ่านข้อมูลจาก snapshot/ข้อมูลที่บันทึกจริง ไม่ใช้ config ปัจจุบันไปเปลี่ยนข้อมูลย้อนหลัง
- ต้องมี filter วันที่หรือรุ่นก่อน export เพื่อกันข้อมูลเยอะเกิน
- ยังไม่คำนวณ CP/CPK ในระบบ และยังไม่ตัดสิน OK/NG จาก spec ถ้ายังไม่มี spec master ที่ควบคุม version/audit
- ห้ามเพิ่ม dependency ถ้า export ด้วยเครื่องมือเดิมได้
- ถ้าจะดึงข้อมูลจากฐานข้อมูลจริงจำนวนมาก ต้อง backup และทดสอบกับข้อมูลจำกัดก่อน
- เหมาะทำหลัง Step 10-12 หรือหลัง workflow หลักนิ่งแล้ว

#### Step 14 Handoff Summary: Measurement History Export

สถานะล่าสุด:

- Step 14 ทำเป็น 3 ช่วงหลัก:
  - Step 14.1: Backend Preview สำหรับกรองข้อมูลตรวจมิติก่อน export
  - Step 14.2: Backend Excel Export สำหรับสร้างไฟล์ `.xlsx`
  - Step 14.3: Frontend Export Data UI สำหรับ preview, เลือกหัวข้อ, เลือกหลาย Lot และกด Export Excel
- Step 14.1, Step 14.2 และ Step 14.3 ทำเสร็จแล้ว และถูกบันทึกไว้ใน workflow history
- รายละเอียด branch / QA / prompt เก่าของ Step 14 อยู่ใน `docs/git-branch-workflow.md`
- ไม่มี database migration, ไม่มี schema change และไม่มี dependency ใหม่
- Export ใช้ข้อมูล Lot ที่หัวหน้า Approved แล้ว และใบตรวจมิติ `completed` เท่านั้น
- Export ใช้ snapshot/ข้อมูลที่บันทึกจริง ไม่ใช้ config ปัจจุบันไปเปลี่ยนข้อมูลย้อนหลัง
- หน้าเมนูใช้ชื่อ `Export Data` สำหรับ `head` และ `assistant`
- Excel ที่ export มี sheet หลัก:
  - `raw_data` - ตารางยาว 1 แถว = 1 จุดวัด
  - `skipped_values` - ค่าที่ข้าม เช่น ว่าง, `-`, ไม่ใช่ตัวเลข
  - `summary` - สรุปจำนวนค่าแยกตามหัวข้อและ Lot
  - `metadata` - เงื่อนไข export และข้อมูลประกอบ
- เตรียมคอลัมน์ spec ว่างไว้ให้ผู้ใช้เติมจาก Drawing ภายนอก ได้แก่ `drawing_ref`, `nominal`, `lsl`, `usl`, `tolerance_note`
- BrakeCheck ยังไม่คำนวณ CP / CPK ในระบบ ให้ใช้ Excel / Minitab หรือเครื่องมือภายนอก
- เพิ่มเอกสาร `docs/export-dimension-column-guide.md` เพื่ออธิบายทุกชีตและทุกคอลัมน์ในไฟล์ Export Dimension

ไฟล์หลักที่เกี่ยวข้อง:

- `server/src/routes/export-dimension.routes.js`
- `server/src/controllers/export-dimension.controller.js`
- `server/src/services/export-dimension.service.js`
- `server/src/services/export-dimension.service.test.js`
- `client/src/services/export-dimension.api.js`
- `client/src/pages/export-dimension.page.js`
- `client/src/app.js`
- `client/src/components/main-layout.js`
- `client/src/config/app.config.js`
- `client/src/styles/main.css`
- `docs/export-dimension-column-guide.md`

สิ่งที่ทดสอบแล้ว:

- Backend unit test ของ export dimension ผ่าน
- Manual API test Step 14.2 ผ่าน
- Manual UI test Step 14.3 ผ่าน เช่น Preview, เลือกหัวข้อ, เลือกหลาย Lot, Export Excel, security/edge case สำคัญ
- Syntax check และ `git diff --check` ผ่าน โดยมีเฉพาะ warning `LF -> CRLF` ของ Windows

เงื่อนไขสำคัญที่ต้องรักษาต่อ:

- ห้ามนำ draft มาปนใน export
- ห้าม export Lot ที่ยังไม่ Approved
- ต้องมี filter ก่อน preview/export เพื่อกันข้อมูลเยอะเกิน
- ถ้า filter เปลี่ยนหลัง preview ต้อง preview ใหม่ก่อน export
- ห้ามเพิ่ม dependency ใหม่ถ้า `exceljs` เดิมยังพอใช้
- ห้ามแก้ schema/database ถ้าไม่จำเป็น
- ถ้าภายหลังมี migration หรือ bulk operation ต้อง backup database ก่อน

### Step 15: Results

เป้าหมาย:
- เปลี่ยนปุ่มเมนู ค้นหาตามรุ่น เป็นปุ่มเมนู Results
- เพิ่มหน้า `Results` สำหรับเปิดดูงานที่จบแล้ว
- ใช้ดูอย่างเดียว ไม่ใช่หน้าแก้ไข ไม่ใช่หน้าอนุมัติ
- ทุก role มีสิทธิเข้าถึง ได้แก่ `head`, `assistant`, `officer`

ขอบเขตที่แนะนำ:

- ใช้หน้าตาและ flow คล้ายหน้า `คิวตรวจและอนุมัติ`
- แสดงงานที่ผ่านการ `Approved`
- แสดงงาน NG ที่ถูก `รับทราบ NG` แล้ว
- ค้นหาได้จาก Lot, Lot Pack, Lot ผลิต, รุ่น/รายละเอียด
- กรองวันที่ผลิตได้
- กดเปิดดูใบตรวจเดิมได้
- เน้น read-only: ไม่แสดงปุ่ม Approve, Send Back, Confirm NG หรือปุ่มแก้ไข

ข้อควรระวัง:

- ห้ามเปลี่ยน workflow อนุมัติเดิม
- ห้ามเปิดสิทธิ์แก้ไขข้อมูลจากหน้า Results
- ห้าม hard-delete หรือแก้ข้อมูลจริง
- ถ้าจะ reuse service/API จากหน้า approval queue ต้องแยก intent ให้ชัดว่า Results เป็นหน้าอ่านอย่างเดียว

#### Step 15 Handoff Summary: Results

สถานะล่าสุด:

- Step 15 เป็น Step สุดท้ายของแผนหลัก และผู้ใช้ยืนยันว่าโปรแกรมเสร็จสมบูรณ์แล้ว
- งาน Step 15 เดิมพัฒนาบน branch `codex/step-15-results`
- เปลี่ยนเมนูเดิม `ค้นหาตามรุ่น` เป็น `Results`
- เพิ่มหน้า `Results` สำหรับเปิดดูงานที่จบแล้วแบบ read-only
- รองรับ 2 กลุ่มผลลัพธ์:
  - `Approved` = Lot ที่ตรวจมิติและตรวจบรรจุเสร็จแล้ว และมีหลักฐานอนุมัติ
  - `รับทราบ NG` = Lot ที่ตรวจมิติและตรวจบรรจุเสร็จแล้ว และมีหลักฐานรับทราบ NG
- ทุก role เข้าได้ ได้แก่ `head`, `assistant`, `officer`
- มีตัวกรองวันที่ผลิต, ปุ่มย้อนหลัง 1 วัน, ปุ่มย้อนหลัง 3 วัน, โหมดวันที่ทั้งหมด และช่องค้นหา Lot / Lot Pack / Lot ผลิต / รุ่น
- เปิดดูใบตรวจเดิมได้ด้วยการคลิก/แตะซ้ำแถวเดิมในเวลาสั้น ๆ เพื่อรองรับแท็บเล็ต
- หน้าใบตรวจที่เปิดจาก Results เป็น read-only: ไม่มีปุ่มอนุมัติ, ส่งกลับ, รับทราบ NG, บันทึก, upload/delete หรือแก้ไขข้อมูล
- ไม่มี export/print ใน Step 15 เพราะหน้านี้ใช้เปิดดูรายละเอียดการตรวจสอบเท่านั้น
- ไม่มี database migration, ไม่มี schema change, ไม่มี bulk data write และไม่มี dependency ใหม่

ไฟล์หลักที่เกี่ยวข้อง:

- `server/src/routes/results.routes.js`
- `server/src/controllers/results.controller.js`
- `server/src/services/results.service.js`
- `server/src/services/results.service.test.js`
- `client/src/services/results.api.js`
- `client/src/pages/results.page.js`
- `client/src/pages/results.page.test.mjs`
- `client/src/app.results-readonly.test.mjs`
- `client/src/app.js`
- `client/src/pages/lot-inspection.page.js`
- `client/src/pages/lot-inspection.page.test.mjs`
- `client/src/components/main-layout.js`
- `client/src/config/app.config.js`
- `client/src/styles/main.css`
- `server/src/app.js`

สิ่งที่ทดสอบแล้ว:

- Unit test ฝั่ง backend สำหรับ Results ผ่าน
- Unit/source test ฝั่ง frontend สำหรับ Results และ read-only detail ผ่าน
- Syntax check ของไฟล์ที่เกี่ยวข้องผ่าน
- `git diff --check` ผ่าน โดยมีเฉพาะ warning `LF -> CRLF` ของ Windows
- Manual Testing Step 15 ผ่านแล้ว ครอบคลุมส่วนจำเป็น, security test และ edge case สำคัญ

เงื่อนไขสำคัญที่ต้องรักษาต่อ:

- Results เป็นหน้าอ่านอย่างเดียวเท่านั้น
- ห้ามเพิ่มปุ่มอนุมัติ, ส่งกลับ, รับทราบ NG, บันทึก, upload/delete หรือแก้ไขในหน้า Results/read-only detail
- ห้ามเปลี่ยน workflow อนุมัติเดิม
- ถ้าภายหลังต้องเพิ่ม export/print ให้เปิดเป็น scope ใหม่ ไม่รวมย้อนหลังใน Step 15
- ถ้าภายหลังมี migration, bulk operation หรือ script เขียนข้อมูลจริง ต้อง backup database ก่อน

## แนวทางการพัฒนา

- ทำทีละ Step เล็ก ๆ
- Review ก่อนแก้โค้ดสำคัญ
- Run/Test ก่อน Commit
- ไม่เพิ่ม Framework ใหม่ถ้าไม่จำเป็น
- ไม่เพิ่มค่าใช้จ่ายระยะยาว
- รักษา Security, Validation, Error Handling และ Code Readability
