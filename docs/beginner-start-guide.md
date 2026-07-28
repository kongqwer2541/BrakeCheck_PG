# Beginner Start Guide

คู่มือนี้ช่วยให้มือใหม่เริ่มเปิดระบบ BrakeCheck บนเครื่อง local ได้ทีละขั้น

## โปรแกรมที่ต้องมี

- Chrome: ใช้เปิดหน้าเว็บ BrakeCheck
- VS Code: โปรแกรมสำหรับเปิดโฟลเดอร์โปรเจกต์และแก้ไฟล์
- Node.js: ใช้รัน backend server
- PostgreSQL 17: ฐานข้อมูลของระบบ
- Git: ใช้ดูสถานะงานและทำ branch/commit

## VS Code คืออะไร

VS Code คือโปรแกรมแก้โค้ด ใช้เปิดโฟลเดอร์ `BrakeCheck` เพื่อดูไฟล์ frontend, backend, และ docs ในที่เดียว

## Terminal คืออะไร

Terminal คือช่องพิมพ์คำสั่ง เช่น เปิด server, ติดตั้ง package, หรือเช็ก Git ใน Windows โปรเจกต์นี้ใช้ PowerShell ได้

## วิธีติดตั้ง package

เปิด Terminal ที่โฟลเดอร์โปรเจกต์ แล้วรัน:

```powershell
cd server
npm install
```

ถ้าอยู่ที่ root ของโปรเจกต์และต้องการรันผ่าน script หลัก ให้ใช้:

```powershell
npm install --prefix server
```

## วิธีตั้งค่า .env

ไฟล์ `.env` คือไฟล์ตั้งค่าจริงของเครื่อง เช่น port, ชื่อฐานข้อมูล, user ฐานข้อมูล, password ฐานข้อมูล และ secret สำหรับ session

ระบบ BrakeCheck อ่านไฟล์ `.env` จาก root ของโปรเจกต์ ไม่ใช่จากโฟลเดอร์ `server`

1. copy ไฟล์ `.env.example` เป็น `.env`
2. แก้ค่าใน `.env` ให้ตรงกับเครื่องจริง เช่น database user/password
3. ถ้าไม่รู้ค่าฐานข้อมูล ให้ถามผู้ดูแลระบบหรือ IT
4. ห้าม commit ไฟล์ `.env` ขึ้น GitHub

คำสั่ง copy บน Windows:

```powershell
copy .env.example .env
```

ตัวอย่างค่าที่ต้องมี:

```text
APP_NAME=BrakeCheck
APP_PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brakecheck_pg
DB_USER=brakecheck_app
DB_PASSWORD=change_me
SESSION_SECRET=replace_with_random_text_at_least_32_chars
```

หมายเหตุ: ค่าด้านบนเป็นตัวอย่างเท่านั้น ห้ามใส่รหัสผ่านจริงใน `.env.example`

## วิธีสร้าง SESSION_SECRET

`SESSION_SECRET` คือข้อความลับที่ระบบใช้เซ็น token สำหรับ login

ถ้าค่านี้สั้นเกินไปหรือใช้ค่าตัวอย่าง ระบบจะไม่ยอมเปิด server เพื่อป้องกันการตั้งค่าที่ไม่ปลอดภัย

ขั้นตอนสำหรับเครื่องจริง:

1. เปิด PowerShell ที่โฟลเดอร์โปรเจกต์
2. รันคำสั่งนี้เพื่อสร้างข้อความสุ่ม

```powershell
[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
```

3. copy ผลลัพธ์ที่ได้
4. เปิดไฟล์ `.env`
5. แก้บรรทัด `SESSION_SECRET=...` ให้เป็นผลลัพธ์ที่ copy มา

ตัวอย่าง:

```text
SESSION_SECRET=11111111-2222-3333-4444-55555555555566666666-7777-8888-9999-000000000000
```

6. save ไฟล์ `.env`
7. ห้ามส่งค่า `SESSION_SECRET` ให้คนอื่น และห้าม commit ไฟล์ `.env` ขึ้น GitHub

## วิธีเปิด server

จากโฟลเดอร์โปรเจกต์:

```powershell
npm start
```

หรือเข้าโฟลเดอร์ server ก่อน:

```powershell
cd server
npm start
```

ถ้า server เปิดสำเร็จ จะใช้งานที่ port `3000`

## วิธีเปิดเว็บใน Chrome

เปิด Chrome แล้วเข้า:

```text
http://localhost:3000/
```

## วิธีเช็ก API health

เปิดใน Chrome:

```text
http://localhost:3000/api/health
```

ควรเห็นข้อความประมาณ:

```json
{"ok":true,"message":"BrakeCheck API is ready"}
```

## วิธีเช็ก database health

เปิดใน Chrome:

```text
http://localhost:3000/api/database/health
```

ถ้าไม่ผ่าน ให้ตรวจว่า PostgreSQL 17 เปิดอยู่ ฐาน `brakecheck_pg` มีครบ 14 ตาราง และค่า `.env` ถูกต้อง
