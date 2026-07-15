# Export Dimension Column Guide

เอกสารนี้อธิบายชีตและคอลัมน์ในไฟล์ `BrakeCheck_Export_Dimension_YYYY-MM-DD.xlsx`

ไฟล์นี้ใช้สำหรับส่งข้อมูลค่าตรวจมิติออกไปวิเคราะห์ภายนอก เช่น Excel หรือ Minitab
ระบบ BrakeCheck ยังไม่คำนวณ CP / CPK เอง

## Sheet: raw_data

ชีตข้อมูลหลัก ใช้สำหรับวิเคราะห์สถิติ

หลักสำคัญ:

- 1 แถว = 1 จุดวัด
- ถ้า 1 ชิ้นวัด 3 จุด จะออกมา 3 แถว
- ถ้า 5 ชิ้น ชิ้นละ 3 จุด จะออกมา 15 แถว
- ค่าที่ควรใช้วิเคราะห์คือ `measured_value`

| Column | ความหมาย | หมายเหตุ |
|---|---|---|
| `lot_number` | Lot หลัก | ใช้อ้างอิงใบตรวจ QC |
| `lot_pack` | Lot Pack / บาร์โค้ดแพ็ก | ใช้ตามข้อมูลนำเข้า |
| `production_lot` | Lot ผลิต | Lot จากฝั่งผลิต |
| `production_date` | วันที่ผลิต | วันที่ผลิตของ Lot |
| `inspection_date` | วันที่ตรวจ | วันที่มีการตรวจมิติ |
| `model` | รุ่น | รุ่นสินค้า |
| `description` | รายละเอียด / มิติ | เช่น ขนาดหรือรายละเอียดสินค้า |
| `purchase_order` | ใบสั่งซื้อ | PO |
| `grade` | เกรด | เกรดสินค้า |
| `quantity` | จำนวน | จำนวนชิ้นใน Lot |
| `topic_name` | หัวข้อการวัด | เช่น ความหนา, ความกว้าง, ความยาว |
| `piece_index` | ชิ้นที่ | ลำดับชิ้นงานที่ตรวจ |
| `point_index` | จุดวัดที่ | ลำดับจุดวัดในชิ้นนั้น |
| `measured_value` | ค่าที่วัดได้ | เป็นตัวเลข ใช้สำหรับวิเคราะห์สถิติ |
| `instrument_code` | เครื่องมือวัด | รหัสเครื่องมือวัดที่บันทึกไว้ |
| `inspector_name` | ผู้ตรวจ | ชื่อผู้ตรวจ |
| `inspection_status` | สถานะใบตรวจ | ปกติควรเป็น `completed` |
| `lot_status` | สถานะ Lot | ปกติควรเป็น `approved` |
| `drawing_ref` | อ้างอิง Drawing | เว้นว่างไว้ให้ผู้ใช้เติมเอง |
| `nominal` | ค่าเป้าหมาย / ค่ากลาง | เว้นว่างไว้ให้ผู้ใช้เติมเอง |
| `lsl` | Lower Specification Limit | ค่าต่ำสุดที่ยอมรับได้ เว้นว่างไว้ให้ผู้ใช้เติมเอง |
| `usl` | Upper Specification Limit | ค่าสูงสุดที่ยอมรับได้ เว้นว่างไว้ให้ผู้ใช้เติมเอง |
| `tolerance_note` | หมายเหตุ Tolerance | เว้นว่างไว้ให้ผู้ใช้เติมเอง |

## Sheet: skipped_values

ชีตค่าที่ระบบข้าม ไม่เอาไปเป็นตัวเลขใน `raw_data`

ใช้สำหรับตรวจสอบว่ามีค่าใดถูกข้ามบ้าง เช่น ช่องว่าง, `-`, หรือข้อความที่ไม่ใช่ตัวเลข

| Column | ความหมาย | หมายเหตุ |
|---|---|---|
| `lot_number` | Lot หลัก | เหมือนใน `raw_data` |
| `lot_pack` | Lot Pack / บาร์โค้ดแพ็ก | เหมือนใน `raw_data` |
| `production_lot` | Lot ผลิต | เหมือนใน `raw_data` |
| `production_date` | วันที่ผลิต | เหมือนใน `raw_data` |
| `inspection_date` | วันที่ตรวจ | เหมือนใน `raw_data` |
| `model` | รุ่น | เหมือนใน `raw_data` |
| `description` | รายละเอียด / มิติ | เหมือนใน `raw_data` |
| `purchase_order` | ใบสั่งซื้อ | เหมือนใน `raw_data` |
| `grade` | เกรด | เหมือนใน `raw_data` |
| `quantity` | จำนวน | เหมือนใน `raw_data` |
| `topic_name` | หัวข้อการวัด | หัวข้อที่มีค่าถูกข้าม |
| `piece_index` | ชิ้นที่ | ชิ้นงานที่มีค่าถูกข้าม |
| `point_index` | จุดวัดที่ | จุดวัดที่มีค่าถูกข้าม |
| `instrument_code` | เครื่องมือวัด | รหัสเครื่องมือวัด |
| `inspector_name` | ผู้ตรวจ | ชื่อผู้ตรวจ |
| `inspection_status` | สถานะใบตรวจ | ปกติควรเป็น `completed` |
| `lot_status` | สถานะ Lot | ปกติควรเป็น `approved` |
| `measured_value_raw` | ค่าดิบที่ถูกข้าม | เช่น ว่าง, `-`, หรือข้อความ |
| `skip_reason` | เหตุผลที่ข้าม | เช่น `blank`, `dash`, `not_numeric` |

## Sheet: summary

ชีตสรุปจำนวนข้อมูลที่ export

### Section: summary_by_topic

สรุปจำนวนค่าแยกตามหัวข้อการวัด

| Column | ความหมาย |
|---|---|
| `topic_name` | ชื่อหัวข้อการวัด |
| `numeric_value_count` | จำนวนค่าที่เป็นตัวเลข |
| `skipped_value_count` | จำนวนค่าที่ถูกข้าม |

### Section: summary_by_lot

สรุปจำนวนค่าแยกตาม Lot

| Column | ความหมาย |
|---|---|
| `lot_number` | Lot |
| `numeric_value_count` | จำนวนค่าที่เป็นตัวเลขใน Lot นั้น |
| `skipped_value_count` | จำนวนค่าที่ถูกข้ามใน Lot นั้น |

## Sheet: metadata

ชีตข้อมูลประกอบ บอกว่าไฟล์นี้ export ด้วยเงื่อนไขอะไร

| Key | ความหมาย |
|---|---|
| `export_scope` | ขอบเขตข้อมูลที่ export |
| `selected_topics` | หัวข้อการวัดที่เลือกตอน export |
| `lot_count` | จำนวน Lot ที่ export |
| `numeric_value_count` | จำนวนค่าตัวเลขทั้งหมด |
| `skipped_value_count` | จำนวนค่าที่ถูกข้ามทั้งหมด |
| `total_measurement_values` | จำนวนจุดวัดรวม ทั้งค่าตัวเลขและค่าที่ถูกข้าม |
| `max_measurement_values` | จำนวนจุดวัดสูงสุดที่ระบบอนุญาตต่อครั้ง |
| `cp_cpk` | ระบุว่า BrakeCheck ยังไม่คำนวณ CP / CPK |
| `spec_columns` | ระบุว่าคอลัมน์ Spec เว้นไว้ให้เติมจาก Drawing ภายนอก |

## วิธีใช้ไฟล์นี้แบบง่าย

1. ใช้ชีต `raw_data` เป็นข้อมูลหลัก
2. ใช้คอลัมน์ `measured_value` เป็นค่าตัวเลขสำหรับวิเคราะห์
3. ใช้ `topic_name` แยกหัวข้อ เช่น ความหนา, ความกว้าง, ความยาว
4. ใช้ `lot_number`, `piece_index`, `point_index` เพื่อตามย้อนกลับว่าเป็นค่าจาก Lot / ชิ้น / จุดวัดไหน
5. ถ้าต้องใช้ Spec ให้เติม `drawing_ref`, `nominal`, `lsl`, `usl`, `tolerance_note` เองจาก Drawing
6. ถ้าต้องตรวจว่ามีค่าใดถูกข้าม ให้ดูชีต `skipped_values`

## คำศัพท์สำคัญ

| คำศัพท์ | ความหมายแบบง่าย |
|---|---|
| `nominal` | ค่าเป้าหมาย หรือค่ากลางตาม Drawing |
| `lsl` | ค่าต่ำสุดที่ยอมรับได้ |
| `usl` | ค่าสูงสุดที่ยอมรับได้ |
| `tolerance` | ช่วงบวกลบที่ Drawing กำหนด |
| `CP / CPK` | ค่าสถิติความสามารถของกระบวนการ ใช้วิเคราะห์ภายนอก BrakeCheck |
