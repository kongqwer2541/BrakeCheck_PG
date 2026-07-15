# คู่มือปุ่มกด Windows สำหรับ BrakeCheck

คู่มือนี้ช่วยให้มือใหม่เปิด server ตรวจระบบ และ backup ข้อมูลได้โดยไม่ต้องจำคำสั่งยาว ๆ

## เอกสารนี้ใช้เมื่อไหร่

ใช้ไฟล์นี้เป็นคู่มือหลักเฉพาะปุ่ม `.bat` บน Windows เช่น เปิด server, ตรวจระบบ, backup, ติดตั้ง Auto Start หรือถอน Auto Start

ถ้าต้องติดตั้งระบบบนเครื่องแม่บริษัท ให้เริ่มจาก `docs/deployment-guide.md` ก่อน แล้วค่อยกลับมาดูไฟล์นี้เฉพาะขั้นตอนปุ่มกด
ถ้าต้องย้ายระบบด้วยแฟลชไดรฟ์ ให้เริ่มจาก `docs/usb-transfer-install-guide.md`
ถ้าต้อง Restore หรือกู้ข้อมูล ให้ใช้ `docs/backup-restore-guide.md` เป็นคู่มือหลัก

## ไฟล์ปุ่มกดอยู่ที่ไหน

ไฟล์อยู่ในโฟลเดอร์:

```text
scripts/
```

ไฟล์ที่มี:

- `scripts/start-server.bat`
- `scripts/check-system.bat`
- `scripts/backup-database.bat`
- `scripts/backup-system.bat`
- `scripts/auto-start-server.bat`
- `scripts/install-auto-start.bat`
- `scripts/uninstall-auto-start.bat`

## แต่ละปุ่มใช้ทำอะไร

### start-server.bat

ใช้เปิด BrakeCheck server

เมื่อเปิดสำเร็จ ให้เข้าเว็บใน Chrome:

```text
http://localhost:3000/
```

เช็ก API:

```text
http://localhost:3000/api/health
```

เช็ก database:

```text
http://localhost:3000/api/database/health
```

### check-system.bat

ใช้ตรวจเครื่องก่อนเปิดระบบ เช่น:

- มี Node.js หรือไม่
- มี npm หรือไม่
- มีโฟลเดอร์ `server/` หรือไม่
- มี `server/package.json` หรือไม่
- มี `.env` หรือไม่

### backup-database.bat

ใช้สำรองข้อมูล MySQL ด้วย `mysqldump`

ปุ่มนี้ backup เฉพาะฐานข้อมูล ไม่รวมไฟล์แนบจริงใน `storage/attachments` ถ้าต้องการกู้ระบบให้ครบให้ใช้ `backup-system.bat` แทน

ไฟล์ backup จะถูกสร้างใน:

```text
backups/
```

ไฟล์ backup จะมีวันที่และเวลาในชื่อไฟล์ เช่น:

```text
brakecheck_backup_20260611-153000.sql
```

### backup-system.bat

ใช้สำรองข้อมูลทั้งระบบ เหมาะสำหรับก่อนอัปเดตระบบหรือก่อนทำงานกับข้อมูลจริง

ปุ่มนี้จะ Backup:

- MySQL database เป็นไฟล์ `.sql`
- `storage/attachments` เป็นไฟล์ `.zip`

ไฟล์ backup จะถูกสร้างใน:

```text
backups/
```

ถ้าระบบถามรหัสผ่าน MySQL ให้กรอกรหัสผ่าน database ของเครื่องแม่

ถ้าต้อง Restore จากไฟล์ backup ที่ได้ ให้ไปที่ `docs/backup-restore-guide.md` ก่อนทำจริง

### install-auto-start.bat

ใช้ตั้งค่าให้เครื่องแม่เปิด BrakeCheck server อัตโนมัติเมื่อ Windows user login

ไฟล์นี้จะสร้าง Windows Scheduled Task ชื่อ:

```text
BrakeCheck Auto Start
```

Task นี้จะรัน:

```text
scripts/auto-start-server.bat
```

ข้อควรระวัง:

- ควรใช้บนเครื่องแม่บริษัทเท่านั้น
- ถ้าขึ้น `Access is denied` ให้เปิด PowerShell แบบ Run as Administrator แล้วติดตั้งตามหัวข้อด้านล่าง
- MySQL ต้องเปิดอัตโนมัติหลัง reboot ด้วย
- ถ้า server เปิดไม่ติด ให้ดู log ที่ `server/auto-start-server.log`
- ถ้ากดแล้วหน้าต่างไม่ขึ้น ให้เปิด Command Prompt ในโฟลเดอร์โปรเจกต์แล้วรัน `scripts\install-auto-start.bat --dry-run` เพื่อดูข้อความ
- การติดตั้ง/ถอด Auto Start จะมี log สั้น ๆ ที่ `server/auto-start-install.log`
- ถ้าต้องการทดสอบแบบไม่สร้าง task ให้รัน `scripts/install-auto-start.bat --dry-run`

วิธีติดตั้งผ่าน PowerShell แบบ Run as Administrator:

1. กด Start
2. พิมพ์ `PowerShell`
3. คลิกขวา `Windows PowerShell`
4. เลือก `Run as administrator`
5. รันคำสั่ง:

```powershell
cd C:\Users\KONG\Documents\BrakeCheck
.\scripts\install-auto-start.bat --opened-by-wrapper
```

ถ้าสำเร็จจะเห็นข้อความ:

```text
Auto Start installed successfully.
```

เช็กว่า task ถูกสร้างแล้ว:

```powershell
schtasks /Query /TN "BrakeCheck Auto Start"
```

### uninstall-auto-start.bat

ใช้ถอด Auto Start ออกจากเครื่องแม่

เหมาะสำหรับกรณี:

- เปลี่ยนเครื่องแม่
- ไม่ต้องการให้ BrakeCheck เปิดเองแล้ว
- ต้องการให้ IT ตั้งค่าใหม่

ถ้าต้องการทดสอบแบบไม่ลบ task ให้รัน:

```text
scripts/uninstall-auto-start.bat --dry-run
```

วิธีถอนผ่าน PowerShell แบบ Run as Administrator:

1. กด Start
2. พิมพ์ `PowerShell`
3. คลิกขวา `Windows PowerShell`
4. เลือก `Run as administrator`
5. รันคำสั่ง:

```powershell
cd C:\Users\KONG\Documents\BrakeCheck
.\scripts\uninstall-auto-start.bat --opened-by-wrapper
```

หลังถอนแล้วให้เช็ก:

```powershell
schtasks /Query /TN "BrakeCheck Auto Start"
```

ถ้าขึ้นข้อความนี้ แปลว่าถอนสำเร็จแล้ว:

```text
ERROR: The system cannot find the file specified.
```

## วิธีดับเบิลคลิกใช้งาน

1. เปิดโฟลเดอร์โปรเจกต์ `BrakeCheck`
2. เข้าโฟลเดอร์ `scripts`
3. ดับเบิลคลิกไฟล์ `.bat` ที่ต้องการ
4. อ่านข้อความในหน้าต่างก่อนปิด

ถ้าเกิด error หน้าต่างจะไม่ปิดทันที เพราะมี `pause` ให้ดูข้อความก่อน

## ต้องเปิดปุ่มไหนก่อน

แนะนำลำดับสำหรับมือใหม่:

1. เปิด `check-system.bat`
2. ถ้าทุกอย่างพร้อม ให้เปิด `backup-system.bat` ก่อนอัปเดตระบบหรือ import ข้อมูลจำนวนมาก
3. เปิด `start-server.bat`
4. เปิด Chrome ไปที่ `http://localhost:3000/`

ถ้าเป็นเครื่องแม่บริษัทและต้องการให้ server เปิดเองหลัง login ให้เปิด `install-auto-start.bat` หลังจากทดสอบ `start-server.bat` ผ่านแล้ว

## ตั้งค่า MySQL ให้เปิดอัตโนมัติหลังเปิดเครื่อง

Auto Start ของ BrakeCheck จะเปิด server ให้ แต่ถ้า MySQL ยังไม่เปิด server อาจใช้งานไม่ได้ จึงควรตั้ง MySQL ให้เปิดเองหลัง Windows เปิดเครื่องด้วย

### วิธีตรวจชื่อ MySQL service

1. เปิด PowerShell แบบ Run as Administrator
2. รันคำสั่ง:

```powershell
Get-Service | Where-Object { $_.Name -like "MySQL*" } | Select-Object Name, Status, StartType
```

ชื่อที่พบบ่อย เช่น:

```text
MySQL80
```

ถ้าไม่เจอชื่อ MySQL service ให้ถาม IT หรือคนที่ติดตั้ง MySQL ก่อน

### วิธีตั้ง MySQL ให้เปิดอัตโนมัติ

ตัวอย่างนี้ใช้ชื่อ service เป็น `MySQL80` ถ้าเครื่องจริงใช้ชื่ออื่น ให้เปลี่ยนชื่อให้ตรงกับที่ตรวจพบ

```powershell
Set-Service -Name "MySQL80" -StartupType Automatic
Start-Service -Name "MySQL80"
Get-Service -Name "MySQL80"
```

ผลที่ควรเห็น:

```text
Status = Running
StartType = Automatic
```

### วิธีทดสอบหลังตั้งค่า

1. Restart เครื่องแม่
2. รอ 30-60 วินาที
3. เปิด PowerShell แล้วรัน:

```powershell
Get-Service -Name "MySQL80"
```

4. เปิด Chrome แล้วเข้า:

```text
http://localhost:3000/
http://localhost:3000/api/health
```

ถ้าเว็บเปิดได้และ `/api/health` ผ่าน แปลว่า Auto Start และ MySQL พร้อมใช้งานเบื้องต้น

ถ้าเว็บเปิดไม่ได้ ให้ดู:

```text
server\auto-start-server.log
server\auto-start-install.log
```

## ถ้าเปิด server ไม่ติดต้องทำอย่างไร

วิธีแก้ปัญหาแบบละเอียดอยู่ใน `docs/troubleshooting.md`

ให้ลอง:

- เปิด `check-system.bat`
- ตรวจว่ามี Node.js และ npm
- ตรวจว่ามี `.env`
- ตรวจว่า MySQL เปิดอยู่
- ตรวจว่า port `3000` ไม่ถูกโปรแกรมอื่นใช้
- อ่าน error ในหน้าต่างก่อนกดปุ่มปิด

ถ้ายังไม่เข้าใจ error ให้ส่งข้อความ error ให้ Codex ดู

## วิธีปิด server แบบปลอดภัย

ถ้าเปิดด้วย `start-server.bat`:

1. ไปที่หน้าต่าง server
2. กด `Ctrl+C`
3. ถ้าถาม `Terminate batch job?` ให้พิมพ์ `Y`
4. กด Enter

ข้อควรระวัง:

- อย่าปิดเครื่องแม่ถ้ามีคนใช้งานระบบอยู่
- อย่าปิด server ระหว่างกำลัง Import Excel หรือบันทึก QC
- ถ้าระบบใช้ในโรงงานจริง ให้แจ้งผู้ใช้ก่อนปิด server

## ข้อควรระวังเรื่อง backup

- ไฟล์ backup อาจมีข้อมูลจริงของโรงงาน
- ห้าม commit backup ขึ้น GitHub
- ห้ามส่งไฟล์ backup ให้คนที่ไม่เกี่ยวข้อง
- ก่อน restore ต้องเข้าใจว่า restore อาจเขียนทับข้อมูลปัจจุบัน
- ถ้าต้องการกู้ระบบให้ครบ ต้องมีทั้งไฟล์ `.sql` และไฟล์ `.zip` ของ attachments
- รายละเอียด Restore ที่ปลอดภัยอยู่ใน `docs/backup-restore-guide.md`
