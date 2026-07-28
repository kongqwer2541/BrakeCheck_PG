# Quality Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้า `Summary` สำหรับผู้บริหาร QC เพื่อดูผลคุณภาพและแนวโน้มจากวันที่ผลิต โดยไม่ใช้กราฟ ไม่เพิ่ม dependency และไม่แสดงข้อมูลรายบุคคล

**Architecture:** เพิ่ม API แบบอ่านอย่างเดียวที่ `/api/summary` และคำนวณจาก `lots`, inspection snapshots และ `lot_audit_logs` ที่มีอยู่แล้ว หน้าเว็บใช้รูปแบบ HTML/CSS/JavaScript เดิม แสดง KPI และตาราง พร้อมรายการ Lot แบบเจาะรายละเอียดที่เปิดฟอร์มเดิมในโหมดอ่านอย่างเดียว

**Tech Stack:** Node.js, Express, PostgreSQL 17, HTML, CSS, JavaScript, Node test runner

## Global Constraints

- ใช้ `production_date` ซึ่งมาจาก Excel Column T เป็นวันที่หลัก
- ช่วงวันที่ต่อการค้นหาต้องไม่เกิน 366 วัน
- ผลสุดท้ายมีเฉพาะ Approved ที่มีหลักฐาน `approve` และ NG ที่มีหลักฐาน `confirm_ng` รอบปัจจุบัน
- ไม่นับ Lot สถานะ `void`
- จำกัดสิทธิ์หน้าและ API ให้เฉพาะ `head` และ `assistant`; `officer` ต้องได้ `403`
- ใช้ parameterized PostgreSQL queries เท่านั้น
- ไม่แก้ Schema และไม่เพิ่ม migration
- ไม่เพิ่ม dependency, Chart.js, กราฟ, Export, เป้าหมายสีตัดสิน หรือข้อมูลรายบุคคล
- หน้า Summary เป็นแบบอ่านอย่างเดียว
- ใช้สถานะ Loading, Empty และ Error ที่ไม่เปิดเผย SQL หรือ stack trace
- ห้ามเปิด `.env` หรือใช้ข้อมูลโรงงานจริงในการทดสอบ
- ห้าม `git add`, commit หรือ push จนกว่าผู้ใช้จะสั่งโดยตรง

---

## File Map

| ไฟล์ | หน้าที่ |
|---|---|
| `server/src/services/summary.service.js` | ตรวจตัวกรอง สร้าง query คำนวณ KPI ตารางจัดอันดับ รายปี และ drill-down |
| `server/src/services/summary.service.test.js` | ทดสอบสูตร สถานะ ตัวกรอง SQL แบบ parameterized และการแบ่งหน้า |
| `server/src/controllers/summary.controller.js` | รับ query string แล้วส่งต่อให้ Service |
| `server/src/routes/summary.routes.js` | กำหนด Summary endpoints และสิทธิ์ `head`/`assistant` |
| `server/src/app.js` | mount router ที่ `/api/summary` |
| `server/src/routes/permission.routes.test.js` | ยืนยันสิทธิ์ Backend, Frontend และเมนู |
| `client/src/services/summary.api.js` | สร้าง query string และเรียก Summary API |
| `client/src/services/summary.api.test.mjs` | ทดสอบชื่อและค่าพารามิเตอร์ที่ส่งให้ API |
| `client/src/pages/summary.page.js` | render และ bind หน้า Summary |
| `client/src/pages/summary.page.test.mjs` | ทดสอบ KPI ตาราง escape HTML และสถานะหน้าจอ |
| `client/src/config/app.config.js` | เพิ่มสิทธิ์หน้า `summary` |
| `client/src/components/main-layout.js` | เพิ่มเมนู Summary ในกลุ่มรายงาน |
| `client/src/app.routes.js` | เพิ่ม route ฝั่งหน้าเว็บ |
| `client/src/app.js` | เก็บ state, โหลดข้อมูล, เปลี่ยนตัวกรอง และเปิด Lot แบบอ่านอย่างเดียว |
| `client/src/app.summary.test.mjs` | ยืนยันการเชื่อม route/state/read-only flow |
| `client/src/styles/main.css` | layout และ responsive styles ของ Summary |
| `client/src/styles/summary-style.test.mjs` | ยืนยัน responsive grid และ horizontal scroll |

## Shared Interfaces

Overview endpoint:

```text
GET /api/summary
  ?startDate=2026-07-01
  &endDate=2026-07-31
  &modelSearch=Isuzu
  &grade=525%20A
  &topicSource=all
  &years=2026,2025,2024
```

Overview response:

```js
{
  ok: true,
  filters: {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: 'Isuzu',
    grade: '525 A',
    topicSource: 'all',
    years: [2026, 2025, 2024],
    trendGrouping: 'day'
  },
  options: {
    grades: ['525 A', '535 A'],
    years: [2026, 2025]
  },
  updatedAt: '2026-07-28T10:30:00.000Z',
  stats: {
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    unfinishedTotal: 5,
    unfinished: {
      waitingInspection: 1,
      inProgress: 1,
      needFix: 1,
      waitingPacking: 1,
      waitingApproval: 1
    }
  },
  trend: [],
  topNgTopics: [],
  topNgModels: [],
  yearly: []
}
```

Drill-down endpoint:

```text
GET /api/summary/lots
  ?view=topic
  &rankGroup=selected
  &startDate=2026-07-01
  &endDate=2026-07-31
  &modelSearch=
  &grade=
  &topicSource=dimension
  &topicName=ความหนา
  &page=1
  &pageSize=50
```

Allowed `view` values:

```text
final
approved
confirmed_ng
unfinished
trend
topic
model
year
```

Allowed `rankGroup` values for `topic` and `model`:

```text
selected
other
```

`other` means all rows below the first five from the same ranking and filters. This keeps the `อื่น ๆ` row drill-down accurate without accepting an arbitrary SQL fragment from the client.

Drill-down response:

```js
{
  ok: true,
  items: [{
    lotNumber: '260723002',
    productionDate: '2026-07-23',
    modelName: 'Isuzu CX 730 EX CX',
    dimension: '216*16.0-192',
    grade: '525 A',
    finalResult: 'confirmed_ng',
    finalResultLabel: 'รับทราบ NG',
    ngTopics: ['ความหนา']
  }],
  summary: {
    totalItems: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1
  }
}
```

---

### Task 1: Backend Filter Validation And Core Metrics

**Files:**
- Create: `server/src/services/summary.service.test.js`
- Create: `server/src/services/summary.service.js`

**Interfaces:**
- Produces: `normalizeSummaryFilters(input, now)`
- Produces: `getQualitySummary(input, connection)`
- Consumes: `createCurrentNgConfirmationExistsSql()` from `lot-approval-evidence.service.js`

- [ ] **Step 1: Write failing validation tests**

Add tests that prove the backend owns the rules:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTrendGrouping,
  normalizeSummaryFilters
} from './summary.service.js';

test('summary defaults to current month and three calendar years', () => {
  const result = normalizeSummaryFilters({}, new Date('2026-07-28T00:00:00.000Z'));

  assert.deepEqual(result, {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: [2026, 2025, 2024],
    trendGrouping: 'day'
  });
});

test('summary rejects ranges longer than 366 days', () => {
  assert.throws(
    () => normalizeSummaryFilters({
      startDate: '2025-01-01',
      endDate: '2026-01-02'
    }),
    (error) => error.statusCode === 400
  );
});

test('summary accepts only three unique years and known topic sources', () => {
  assert.throws(
    () => normalizeSummaryFilters({ years: '2026,2025,2024,2023' }),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => normalizeSummaryFilters({ topicSource: 'unknown' }),
    (error) => error.statusCode === 400
  );
});

test('summary selects day week and month grouping from range length', () => {
  assert.equal(getTrendGrouping('2026-07-01', '2026-07-31'), 'day');
  assert.equal(getTrendGrouping('2026-05-01', '2026-07-31'), 'week');
  assert.equal(getTrendGrouping('2025-08-01', '2026-07-31'), 'month');
});
```

- [ ] **Step 2: Run the validation tests and confirm they fail**

Run:

```powershell
node --test server/src/services/summary.service.test.js
```

Expected: FAIL because `summary.service.js` and its exports do not exist.

- [ ] **Step 3: Implement exact filter rules**

Create constants and validation helpers in `summary.service.js`:

```js
import { postgresDb } from '../config/database.js';
import { createCurrentNgConfirmationExistsSql } from './lot-approval-evidence.service.js';

const topicSources = ['all', 'dimension', 'packing'];
const maxRangeDays = 366;
const maxModelSearchLength = 120;
const maxGradeLength = 20;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export function getTrendGrouping(startDate, endDate) {
  const days = Math.floor(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`))
      / 86400000
  ) + 1;
  if (days <= 31) return 'day';
  if (days <= 93) return 'week';
  return 'month';
}
```

`normalizeSummaryFilters()` must:

1. validate real `YYYY-MM-DD` dates in UTC;
2. default to first/last day of the current month;
3. reject start after end;
4. reject an inclusive range over 366 days;
5. normalize `modelSearch` to at most 120 characters;
6. normalize `grade` to at most 20 characters;
7. accept only `all`, `dimension`, `packing`;
8. parse 1-3 unique years between 2000 and 2100;
9. default years to current year and previous two years.

- [ ] **Step 4: Add failing core metric tests**

Use a fake connection identified by SQL comments so tests do not touch a database:

```js
import { getQualitySummary } from './summary.service.js';

test('summary calculates final results NG rate and unfinished groups', async () => {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('summary:stats')) {
        return { rows: [{
          final_lots: 10,
          approved_lots: 8,
          confirmed_ng_lots: 2,
          waiting_inspection: 1,
          in_progress: 2,
          need_fix: 1,
          waiting_packing: 1,
          waiting_approval: 2
        }] };
      }
      if (sql.includes('summary:options')) {
        return { rows: [{ grades: ['525 A'], years: [2026] }] };
      }
      return { rows: [] };
    }
  };

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026'
  }, connection);

  assert.deepEqual(result.stats, {
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    unfinishedTotal: 7,
    unfinished: {
      waitingInspection: 1,
      inProgress: 2,
      needFix: 1,
      waitingPacking: 1,
      waitingApproval: 2
    }
  });
  assert.ok(calls.every(({ params }) => Array.isArray(params)));
});
```

Also assert the stats SQL:

```js
assert.match(statsSql, /lots\.status <> 'void'/);
assert.match(statsSql, /action = 'approve'/);
assert.match(statsSql, /action = 'confirm_ng'/);
assert.match(statsSql, /review_ng/);
assert.doesNotMatch(statsSql, /changed_by|actor_name_snapshot|password_hash|token_hash/);
```

- [ ] **Step 5: Implement core metrics with one shared classification rule**

Use this final-result classification in every Summary query:

```sql
CASE
  WHEN lots.status = 'approved'
    AND dimension_inspections.status = 'completed'
    AND packing_inspections.status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM lot_audit_logs approved_logs
      WHERE approved_logs.lot_id = lots.id
        AND approved_logs.action = 'approve'
    )
  THEN 'approved'
  WHEN lots.status = 'ng'
    AND dimension_inspections.status = 'completed'
    AND (
      packing_inspections.id IS NULL
      OR packing_inspections.status = 'completed'
    )
    AND CURRENT_NG_CONFIRMATION_EXISTS
  THEN 'confirmed_ng'
  ELSE NULL
END
```

Replace `CURRENT_NG_CONFIRMATION_EXISTS` at code-construction time with:

```js
createCurrentNgConfirmationExistsSql({
  lotIdExpression: 'lots.id',
  confirmationAlias: 'summary_confirmed_ng'
})
```

The unfinished groups must map as follows:

```text
pending -> waitingInspection
temp -> inProgress
need_fix -> needFix
waiting_pack -> waitingPacking
waiting_approve -> waitingApproval
ng without current confirm_ng evidence -> waitingApproval
```

This last rule prevents an NG waiting for acknowledgement from disappearing from both final and unfinished counts.

Use `lots.production_date BETWEEN $n AND $n`, `ILIKE $n ESCAPE '\'` for model/detail search, and an exact `aci_grade = $n` comparison. Never interpolate user text into SQL.

Return the normalized filters from the server so the client can display defaults exactly as calculated:

```js
return {
  ok: true,
  filters,
  options: {
    grades: optionRows[0]?.grades || [],
    years: optionRows[0]?.years || []
  },
  updatedAt: new Date().toISOString(),
  stats,
  trend: [],
  topNgTopics: [],
  topNgModels: [],
  yearly: []
};
```

The options query may return only distinct non-empty `aci_grade` values and distinct production years. It must not return a user, password, token, audit reason or attachment path.

Task 2 replaces the four empty arrays with the calculated arrays after their tests pass.

- [ ] **Step 6: Run core service tests**

Run:

```powershell
node --test server/src/services/summary.service.test.js
node --check server/src/services/summary.service.js
```

Expected: PASS.

- [ ] **Step 7: Stop at the review checkpoint**

Run:

```powershell
git diff -- server/src/services/summary.service.js server/src/services/summary.service.test.js
```

Report the result. Do not stage or commit without a direct user command.

---

### Task 2: Trend, NG Rankings And Year Comparison

**Files:**
- Modify: `server/src/services/summary.service.test.js`
- Modify: `server/src/services/summary.service.js`

**Interfaces:**
- Consumes: normalized filters and shared final-result classification from Task 1
- Produces: `trend`, `topNgTopics`, `topNgModels`, `yearly`
- Produces: `collapseTopTopics(rows)`
- Produces: `collapseTopModels(rows)`

- [ ] **Step 1: Write failing aggregation tests**

Add pure-function coverage for Top 5 plus Other:

```js
import { collapseTopModels } from './summary.service.js';

test('summary keeps top five rows and combines the rest as Other', () => {
  const rows = [
    { modelName: 'A', finalLots: 10, confirmedNgLots: 5 },
    { modelName: 'B', finalLots: 10, confirmedNgLots: 4 },
    { modelName: 'C', finalLots: 10, confirmedNgLots: 3 },
    { modelName: 'D', finalLots: 10, confirmedNgLots: 2 },
    { modelName: 'E', finalLots: 10, confirmedNgLots: 1 },
    { modelName: 'F', finalLots: 4, confirmedNgLots: 1 },
    { modelName: 'G', finalLots: 6, confirmedNgLots: 1 }
  ];

  assert.deepEqual(collapseTopModels(rows).at(-1), {
    modelName: 'อื่น ๆ',
    finalLots: 10,
    confirmedNgLots: 2,
    ngRate: 20,
    isOther: true,
    isLowData: false
  });
});
```

Add query/mapping tests:

```js
test('summary counts each NG Lot once per topic and marks low-data models', async () => {
  const connection = createSummaryTestConnection({
    topics: [
      { source: 'dimension', topic_name: 'ความหนา', ng_lots: 3 },
      { source: 'packing', topic_name: 'สภาพกล่อง', ng_lots: 2 }
    ],
    models: [
      { model_name: 'MODEL-A', final_lots: 4, confirmed_ng_lots: 2 }
    ]
  });

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026'
  }, connection);

  assert.equal(result.topNgTopics[0].ngLots, 3);
  assert.equal(result.topNgModels[0].ngRate, 50);
  assert.equal(result.topNgModels[0].isLowData, true);
});
```

Assert Topic SQL contains:

```js
assert.match(topicSql, /COUNT\(DISTINCT/);
assert.match(topicSql, /pieces_data\s*#>>\s*'\{meta,ngStop,topicName\}'/);
assert.match(topicSql, /jsonb_array_elements/);
assert.match(topicSql, /topic->>'value'\s*=\s*'fail'/);
```

Add annual comparison:

```js
assert.deepEqual(result.yearly, [
  {
    year: 2026,
    finalLots: 100,
    approvedLots: 95,
    confirmedNgLots: 5,
    ngRate: 5,
    ngRateChange: -3
  },
  {
    year: 2025,
    finalLots: 100,
    approvedLots: 92,
    confirmedNgLots: 8,
    ngRate: 8,
    ngRateChange: null
  }
]);
```

- [ ] **Step 2: Run tests and confirm the new assertions fail**

Run:

```powershell
node --test server/src/services/summary.service.test.js
```

Expected: FAIL because rankings and yearly mappings are not implemented.

- [ ] **Step 3: Implement trend grouping**

Use validated grouping only:

```js
const trendTruncUnit = {
  day: 'day',
  week: 'week',
  month: 'month'
}[filters.trendGrouping];
```

Build the SQL with `date_trunc('${trendTruncUnit}', production_date)` only after selecting the value from this internal object. PostgreSQL `date_trunc('week', ...)` starts on Monday, matching the approved Monday-Sunday rule.

Map each row to:

```js
{
  periodKey: '2026-07-01',
  label: '01/07/2026',
  periodStart: '2026-07-01',
  periodEnd: '2026-07-01',
  finalLots: 10,
  approvedLots: 8,
  confirmedNgLots: 2,
  ngRate: 20
}
```

- [ ] **Step 4: Implement NG Topic ranking**

Dimension source:

```sql
SELECT DISTINCT
  lots.id AS lot_id,
  'dimension' AS source,
  NULLIF(BTRIM(dimension_inspections.pieces_data #>> '{meta,ngStop,topicName}'), '') AS topic_name
```

Packing source:

```sql
SELECT DISTINCT
  lots.id AS lot_id,
  'packing' AS source,
  NULLIF(BTRIM(topic->>'topicName'), '') AS topic_name
FROM jsonb_array_elements(
  COALESCE(packing_inspections.results_data->'topics', '[]'::jsonb)
) AS topic
WHERE topic->>'value' = 'fail'
```

Union the two sources, apply `topicSource`, group by source/topic, order by `ng_lots DESC, topic_name ASC`, retain five rows, and combine the rest into:

```js
{
  source: 'all',
  topicName: 'อื่น ๆ',
  ngLots: 7,
  isOther: true
}
```

`collapseTopTopics(rows)` must preserve the first five mapped rows and sum distinct `ngLots` values from the remaining rows into the `อื่น ๆ` row.

- [ ] **Step 5: Implement NG Model ranking**

Group by:

```sql
COALESCE(NULLIF(BTRIM(lots.model_name), ''), '-') AS model_name
```

Order by:

```text
NG rate descending
confirmed NG Lot descending
model name ascending
```

Map rows to:

```js
{
  modelName: 'MODEL-A',
  finalLots: 4,
  confirmedNgLots: 2,
  ngRate: 50,
  isLowData: true,
  isOther: false
}
```

For Other, sum numerator and denominator first and calculate the rate from those sums. Do not average percentages.

`collapseTopModels(rows)` must also set `isLowData: finalLots < 5` on normal rows and `isLowData: false` on the aggregated Other row.

- [ ] **Step 6: Implement calendar-year comparison**

Use 1 January through 31 December for each selected year. Apply only `modelSearch` and `grade`, because the selected Summary date range must not shorten annual totals.

Sort rows newest first for display. Calculate `ngRateChange` against the next older selected year:

```js
const previousRate = rows[index + 1]?.ngRate;
const ngRateChange = Number.isFinite(previousRate)
  ? roundRate(row.ngRate - previousRate)
  : null;
```

- [ ] **Step 7: Run aggregation tests**

Run:

```powershell
node --test server/src/services/summary.service.test.js
node --check server/src/services/summary.service.js
```

Expected: PASS.

- [ ] **Step 8: Stop at the review checkpoint**

Show only the Task 2 diff. Do not stage or commit.

---

### Task 3: Read-Only Lot Drill-Down

**Files:**
- Modify: `server/src/services/summary.service.test.js`
- Modify: `server/src/services/summary.service.js`

**Interfaces:**
- Produces: `getQualitySummaryLots(input, connection)`
- Produces: paginated `items` and `summary`

- [ ] **Step 1: Write failing drill-down validation tests**

```js
import { getQualitySummaryLots } from './summary.service.js';

test('summary drill-down rejects unknown view and invalid page data', async () => {
  await assert.rejects(
    () => getQualitySummaryLots({ view: 'delete' }, noQueryConnection),
    (error) => error.statusCode === 400
  );
});

test('summary drill-down escapes wildcard search and stays paginated', async () => {
  const calls = [];
  const connection = createSummaryLotsConnection(calls);

  const result = await getQualitySummaryLots({
    view: 'final',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: 'A%_\\',
    page: '1',
    pageSize: '50'
  }, connection);

  assert.equal(result.summary.pageSize, 50);
  assert.ok(calls.flatMap((call) => call.params).includes('%A\\%\\_\\\\%'));
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
node --test server/src/services/summary.service.test.js
```

Expected: FAIL because `getQualitySummaryLots()` does not exist.

- [ ] **Step 3: Implement strict drill-down filters**

Allowed values:

```js
const detailViews = [
  'final',
  'approved',
  'confirmed_ng',
  'unfinished',
  'trend',
  'topic',
  'model',
  'year'
];
const unfinishedStatuses = [
  'all',
  'pending',
  'temp',
  'need_fix',
  'waiting_pack',
  'waiting_approve'
];
const summaryPageSizes = [25, 50, 100];
const rankGroups = ['selected', 'other'];
```

Rules:

- `trend` requires valid `periodStart` and `periodEnd`;
- `topic` requires source `dimension` or `packing` and topic name at most 120 characters;
- `model` requires model name at most 200 characters;
- `topic` and `model` accept only `selected` or `other` for `rankGroup`;
- `rankGroup=selected` requires the selected topic/model name;
- `rankGroup=other` recomputes the first five ranked keys and returns only Lots outside those keys;
- `year` requires one year between 2000 and 2100;
- `unfinished` accepts only the known status list;
- page defaults to 1;
- page size defaults to 50 and is capped to the allowed values.

For `unfinishedStatus=waiting_approve`, include both `lots.status = 'waiting_approve'` and `lots.status = 'ng'` without current `confirm_ng` evidence. For `view=year`, use 1 January through 31 December of the selected year instead of the main date range.

- [ ] **Step 4: Implement count and list queries**

Reuse the same final-result classification from Task 1. Select only:

```sql
lots.lot_number,
lots.production_date,
lots.model_name,
lots.dimension,
lots.aci_grade,
final_result
```

For confirmed NG rows, derive topic names from the same dimension and packing snapshots used by the ranking query. Do not select user IDs, names, positions, password hashes, tokens, or audit JSON.

Map to:

```js
{
  lotNumber: row.lot_number,
  productionDate: toDateText(row.production_date),
  modelName: row.model_name || '-',
  dimension: row.dimension || '-',
  grade: row.aci_grade || '-',
  finalResult: row.final_result || '',
  finalResultLabel: mapFinalResultLabel(row.final_result),
  ngTopics: Array.isArray(row.ng_topics) ? row.ng_topics : []
}
```

Order by `production_date DESC, lot_number DESC`.

- [ ] **Step 5: Run drill-down tests**

Run:

```powershell
node --test server/src/services/summary.service.test.js
node --check server/src/services/summary.service.js
```

Expected: PASS.

- [ ] **Step 6: Stop at the review checkpoint**

Show the service/test diff. Do not stage or commit.

---

### Task 4: HTTP Routes, Controller And Permission Boundary

**Files:**
- Create: `server/src/controllers/summary.controller.js`
- Create: `server/src/routes/summary.routes.js`
- Modify: `server/src/app.js`
- Modify: `server/src/routes/permission.routes.test.js`

**Interfaces:**
- Consumes: `getQualitySummary()` and `getQualitySummaryLots()`
- Produces: `GET /api/summary`
- Produces: `GET /api/summary/lots`

- [ ] **Step 1: Add failing permission assertions**

Import `summaryRouter` in the existing parallel route imports, then add:

```js
assertAllowedRoles(getGlobalRoleGuard(summaryRouter), managerRoles);
```

Add frontend permission expectations now so Backend and Frontend cannot drift:

```js
assert.deepEqual(configModule.pagePermissions.summary, managerRoles);
```

Expected menus after the Frontend integration task:

```js
assert.deepEqual(visibleMenuIds('head'), [
  'dashboard', 'barcode', 'importExcel', 'manualLot', 'dimension', 'packing', 'approval',
  'history', 'export', 'exportDimension', 'results', 'summary', 'users', 'settings'
]);
assert.deepEqual(visibleMenuIds('assistant'), [
  'dashboard', 'barcode', 'importExcel', 'manualLot', 'dimension', 'packing', 'approval',
  'history', 'export', 'exportDimension', 'results', 'summary', 'settings'
]);
assert.deepEqual(visibleMenuIds('officer'), [
  'dashboard', 'barcode', 'dimension', 'packing', 'history', 'results'
]);
```

- [ ] **Step 2: Run the permission test and confirm failure**

Run:

```powershell
node --test server/src/routes/permission.routes.test.js
```

Expected: FAIL because router/config/menu do not exist yet.

- [ ] **Step 3: Create the controller**

```js
import {
  getQualitySummary,
  getQualitySummaryLots
} from '../services/summary.service.js';

export async function getQualitySummaryController(req, res, next) {
  try {
    res.json(await getQualitySummary({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      modelSearch: req.query.modelSearch,
      grade: req.query.grade,
      topicSource: req.query.topicSource,
      years: req.query.years
    }));
  } catch (error) {
    next(error);
  }
}

export async function getQualitySummaryLotsController(req, res, next) {
  try {
    res.json(await getQualitySummaryLots({
      view: req.query.view,
      rankGroup: req.query.rankGroup,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      modelSearch: req.query.modelSearch,
      grade: req.query.grade,
      unfinishedStatus: req.query.unfinishedStatus,
      periodStart: req.query.periodStart,
      periodEnd: req.query.periodEnd,
      topicSource: req.query.topicSource,
      topicName: req.query.topicName,
      modelName: req.query.modelName,
      year: req.query.year,
      page: req.query.page,
      pageSize: req.query.pageSize
    }));
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Create the protected router**

```js
import { Router } from 'express';
import {
  getQualitySummaryController,
  getQualitySummaryLotsController
} from '../controllers/summary.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const summaryRouter = Router();

summaryRouter.use(requireAuth);
summaryRouter.use(requireRole(['head', 'assistant']));
summaryRouter.get('/', getQualitySummaryController);
summaryRouter.get('/lots', getQualitySummaryLotsController);
```

- [ ] **Step 5: Mount the router**

In `server/src/app.js`:

```js
import { summaryRouter } from './routes/summary.routes.js';
```

and:

```js
app.use('/api/summary', summaryRouter);
```

- [ ] **Step 6: Run backend checks**

The permission test remains expected to fail only on pending Frontend menu/config assertions:

```powershell
node --test server/src/routes/permission.routes.test.js
node --test server/src/services/summary.service.test.js
node --check server/src/controllers/summary.controller.js
node --check server/src/routes/summary.routes.js
node --check server/src/app.js
```

- [ ] **Step 7: Stop at the review checkpoint**

Report that Backend route protection passes independently and that the combined permission test will turn green in Task 7. Do not stage or commit.

---

### Task 5: Frontend Summary API

**Files:**
- Create: `client/src/services/summary.api.test.mjs`
- Create: `client/src/services/summary.api.js`

**Interfaces:**
- Produces: `buildSummaryQueryString(filters)`
- Produces: `buildSummaryLotsQueryString(filters)`
- Produces: `getQualitySummary(filters)`
- Produces: `getQualitySummaryLots(filters)`

- [ ] **Step 1: Write failing query-string tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSummaryLotsQueryString,
  buildSummaryQueryString
} from './summary.api.js';

test('summary api serializes approved filters without dropping Thai text', () => {
  const params = new URLSearchParams(buildSummaryQueryString({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: 'Isuzu CX',
    grade: '525 A',
    topicSource: 'dimension',
    years: [2026, 2025, 2024]
  }));

  assert.equal(params.get('modelSearch'), 'Isuzu CX');
  assert.equal(params.get('grade'), '525 A');
  assert.equal(params.get('years'), '2026,2025,2024');
});

test('summary lot api keeps strict drill-down fields and pagination', () => {
  const params = new URLSearchParams(buildSummaryLotsQueryString({
    view: 'topic',
    topicSource: 'dimension',
    topicName: 'ความหนา',
    page: 2,
    pageSize: 50
  }));

  assert.equal(params.get('view'), 'topic');
  assert.equal(params.get('topicName'), 'ความหนา');
  assert.equal(params.get('page'), '2');
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
node --test client/src/services/summary.api.test.mjs
```

Expected: FAIL because `summary.api.js` does not exist.

- [ ] **Step 3: Implement the API helper**

```js
import { requestJson } from './auth.api.js';

export function buildSummaryQueryString(filters = {}) {
  return new URLSearchParams({
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    modelSearch: filters.modelSearch || '',
    grade: filters.grade || '',
    topicSource: filters.topicSource || 'all',
    years: Array.isArray(filters.years) ? filters.years.join(',') : ''
  }).toString();
}

export function getQualitySummary(filters) {
  return requestJson(
    `/api/summary?${buildSummaryQueryString(filters)}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลด Summary ได้',
      invalid: 'ข้อมูล Summary จาก server ไม่ถูกต้อง'
    }
  );
}
```

`buildSummaryLotsQueryString()` must include the shared filters plus:

```text
view
rankGroup
unfinishedStatus
periodStart
periodEnd
topicName
modelName
year
page
pageSize
```

`getQualitySummaryLots()` calls `/api/summary/lots`.

- [ ] **Step 4: Run API tests**

Run:

```powershell
node --test client/src/services/summary.api.test.mjs
node --check client/src/services/summary.api.js
```

Expected: PASS.

- [ ] **Step 5: Stop at the review checkpoint**

Show the two-file diff. Do not stage or commit.

---

### Task 6: Summary Page Renderer And Bindings

**Files:**
- Create: `client/src/pages/summary.page.test.mjs`
- Create: `client/src/pages/summary.page.js`

**Interfaces:**
- Produces: `renderSummaryPage(props)`
- Produces: `bindSummaryPage(handlers)`
- Produces: `defaultSummaryPageSize = 50`

- [ ] **Step 1: Write failing render tests**

Use one complete fixture:

```js
const fixture = {
  filters: {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: [2026, 2025, 2024],
    trendGrouping: 'day'
  },
  options: { grades: ['525 A'], years: [2026, 2025, 2024] },
  updatedAt: '2026-07-28T10:30:00.000Z',
  stats: {
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    unfinishedTotal: 3,
    unfinished: {
      waitingInspection: 1,
      inProgress: 1,
      needFix: 0,
      waitingPacking: 0,
      waitingApproval: 1
    }
  },
  trend: [{
    periodKey: '2026-07-01',
    label: '01/07/2026',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-01',
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20
  }],
  topNgTopics: [{
    source: 'dimension',
    topicName: 'ความหนา',
    ngLots: 2,
    isOther: false
  }],
  topNgModels: [{
    modelName: 'MODEL-A',
    finalLots: 4,
    confirmedNgLots: 2,
    ngRate: 50,
    isLowData: true,
    isOther: false
  }],
  yearly: [{
    year: 2026,
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    ngRateChange: null
  }]
};
```

Assertions:

```js
test('summary renders approved KPIs tables and read-only drill actions', () => {
  const html = renderSummaryPage({ data: fixture });

  assert.match(html, /Summary/);
  assert.match(html, /10/);
  assert.match(html, /20%/);
  assert.match(html, /ความหนา/);
  assert.match(html, /MODEL-A/);
  assert.match(html, /ข้อมูลน้อย/);
  assert.match(html, /data-summary-detail-view="topic"/);
  assert.doesNotMatch(html, /data-summary-(approve|confirm-ng|edit)/);
});
```

Add:

```js
test('summary escapes server text and renders loading empty and error states', () => {
  assert.doesNotMatch(
    renderSummaryPage({
      data: {
        ...fixture,
        topNgModels: [{
          modelName: '<img src=x onerror=alert(1)>',
          finalLots: 1,
          confirmedNgLots: 1,
          ngRate: 100,
          isLowData: true
        }]
      }
    }),
    /<img/
  );
  assert.match(renderSummaryPage({ isLoading: true }), /กำลังโหลด/);
  assert.match(renderSummaryPage({ error: 'ไม่สามารถโหลด Summary ได้' }), /ไม่สามารถโหลด/);
  assert.match(renderSummaryPage({ data: { ...fixture, trend: [] } }), /ไม่พบข้อมูล/);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
node --test client/src/pages/summary.page.test.mjs
```

Expected: FAIL because the page module does not exist.

- [ ] **Step 3: Implement reusable safe render helpers**

Implement:

```js
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRate(value) {
  const rate = Number(value);
  return `${Number.isFinite(rate) ? rate.toFixed(2).replace(/\.?0+$/, '') : '0'}%`;
}
```

All server text must pass through `escapeHtml()`.

- [ ] **Step 4: Render the approved sections**

Render in this order:

1. filter band with Refresh and `updatedAt`;
2. five KPI buttons;
3. unfinished breakdown;
4. quality trend table;
5. Top NG Topic and Top NG Model tables;
6. annual comparison;
7. drill-down table when selected.

Use these data attributes:

```text
data-summary-refresh
data-summary-apply
data-summary-start-date
data-summary-end-date
data-summary-model-search
data-summary-grade
data-summary-topic-source
data-summary-year
data-summary-detail-view
data-summary-page
data-summary-open-lot
```

The annual year controls are checkboxes. Disable unchecked years when three years are already selected, but keep checked years enabled so the user can remove one.

- [ ] **Step 5: Implement bindings**

`bindSummaryPage()` receives:

```js
{
  onApplyFilters,
  onRefresh,
  onTopicSourceChange,
  onYearsChange,
  onOpenDetails,
  onDetailPageChange,
  onOpenLot
}
```

Prevent duplicate requests by disabling relevant controls while `isLoading` or `detailLoading` is true.

- [ ] **Step 6: Run page tests**

Run:

```powershell
node --test client/src/pages/summary.page.test.mjs
node --check client/src/pages/summary.page.js
```

Expected: PASS.

- [ ] **Step 7: Stop at the review checkpoint**

Show the page/test diff. Do not stage or commit.

---

### Task 7: Navigation, State And Read-Only Lot Flow

**Files:**
- Create: `client/src/app.summary.test.mjs`
- Modify: `client/src/config/app.config.js`
- Modify: `client/src/components/main-layout.js`
- Modify: `client/src/app.routes.js`
- Modify: `client/src/app.js`
- Modify: `server/src/routes/permission.routes.test.js`

**Interfaces:**
- Consumes: Summary API and page functions from Tasks 5-6
- Produces: `summary` application route and persistent page state

- [ ] **Step 1: Write failing integration assertions**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('app wires Summary navigation and opens Lot details read-only', async () => {
  const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  const routes = await readFile(new URL('./app.routes.js', import.meta.url), 'utf8');

  assert.match(routes, /summary:\s*\{\s*action:\s*'summary'\s*\}/);
  assert.match(source, /import\s*\{\s*getQualitySummary,\s*getQualitySummaryLots\s*\}/);
  assert.match(source, /summary:\s*\(\)\s*=>\s*loadSummary\(\)/);
  assert.match(source, /function handleOpenSummaryLot/);
  assert.match(source, /rememberLastPage\('summary'\)[\s\S]*lotInspectionReadOnly = true/);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
node --test client/src/app.summary.test.mjs
node --test server/src/routes/permission.routes.test.js
```

Expected: FAIL because the Frontend route/menu/config is not wired.

- [ ] **Step 3: Add permission, menu and route**

In `app.config.js`:

```js
summary: ['head', 'assistant'],
```

In the report group after Results:

```js
{ id: 'summary', label: 'Summary', icon: 'Σ' }
```

In `app.routes.js`:

```js
summary: { action: 'summary' },
```

- [ ] **Step 4: Add isolated Summary state**

In `app.js`:

```js
const summaryState = {
  filters: {
    startDate: '',
    endDate: '',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: []
  },
  data: null,
  detail: null,
  detailRequest: null,
  loading: false,
  detailLoading: false,
  error: '',
  detailError: '',
  requestId: 0,
  detailRequestId: 0
};
```

Keep Summary state separate from Dashboard and Results state.

- [ ] **Step 5: Implement show/load/filter handlers**

Add:

```text
showSummary()
loadSummary()
handleSummaryApplyFilters(filters)
handleSummaryRefresh()
handleSummaryTopicSourceChange(source)
handleSummaryYearsChange(years)
handleSummaryOpenDetails(request)
loadSummaryDetails()
handleSummaryDetailPageChange(page)
handleOpenSummaryLot(lotNumber)
```

Use request IDs exactly like Dashboard/Results so a slower old response cannot overwrite a newer filter result:

```js
const requestId = ++summaryState.requestId;
const result = await getQualitySummary(summaryState.filters);
if (requestId !== summaryState.requestId) return;
summaryState.filters = {
  ...summaryState.filters,
  ...result.filters,
  years: [...result.filters.years]
};
summaryState.data = result;
summaryState.detail = null;
```

On 401/403 call the existing `handleApiAccessError()`. For other errors, store only `error.message` produced by the safe API helper.

- [ ] **Step 6: Restore Summary as the last page**

Add Summary to `restoreLastPage()` and `navigationHandlers`:

```js
summary: () => loadSummary(),
```

When opening a Lot:

```js
function handleOpenSummaryLot(lotNumber) {
  if (!lotNumber) return;
  rememberLastPage('summary');
  lotInspectionReadOnly = true;
  loadLotInspection(lotNumber, 'dimension');
}
```

- [ ] **Step 7: Run integration and permission tests**

Run:

```powershell
node --test client/src/app.summary.test.mjs
node --test server/src/routes/permission.routes.test.js
node --check client/src/app.js
node --check client/src/app.routes.js
node --check client/src/config/app.config.js
node --check client/src/components/main-layout.js
```

Expected: PASS. The menu must appear for `head` and `assistant`, and remain absent for `officer`.

- [ ] **Step 8: Stop at the review checkpoint**

Show only files changed by this task. Do not stage or commit.

---

### Task 8: Responsive Styling And Final Verification

**Files:**
- Create: `client/src/styles/summary-style.test.mjs`
- Modify: `client/src/styles/main.css`

**Interfaces:**
- Consumes: `.summary-*` classes from `summary.page.js`
- Produces: readable Desktop, Tablet and Mobile layouts

- [ ] **Step 1: Write failing CSS contract test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('summary uses stable responsive grids and scrollable tables', async () => {
  const css = await readFile(new URL('./main.css', import.meta.url), 'utf8');

  assert.match(css, /\.summary-kpi-grid\s*\{[\s\S]*grid-template-columns/);
  assert.match(css, /\.summary-table-wrap\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*\.summary-kpi-grid/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.summary-filter-grid/);
});
```

- [ ] **Step 2: Run the style test and confirm failure**

Run:

```powershell
node --test client/src/styles/summary-style.test.mjs
```

Expected: FAIL because Summary styles are absent.

- [ ] **Step 3: Add scoped Summary styles**

Add only `.summary-*` selectors. Use existing color variables and no new palette:

```css
.summary-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
}

.summary-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 12px;
}

.summary-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.summary-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}
```

At `900px`, use two KPI columns. At `640px`, use one filter/KPI column and keep tables horizontally scrollable. Keep cards at 8px radius or the existing project radius.

- [ ] **Step 4: Run focused automated checks**

```powershell
node --test server/src/services/summary.service.test.js
node --test server/src/routes/permission.routes.test.js
node --test client/src/services/summary.api.test.mjs
node --test client/src/pages/summary.page.test.mjs
node --test client/src/app.summary.test.mjs
node --test client/src/styles/summary-style.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Run syntax and diff checks**

```powershell
node --check server/src/services/summary.service.js
node --check server/src/controllers/summary.controller.js
node --check server/src/routes/summary.routes.js
node --check server/src/app.js
node --check client/src/services/summary.api.js
node --check client/src/pages/summary.page.js
node --check client/src/app.js
git diff --check
```

Expected: no syntax errors and no whitespace errors.

- [ ] **Step 6: Perform browser verification without real factory data**

Start the existing local server with the approved local/test database:

```powershell
Set-Location server
npm start
```

Verify:

1. `head` and `assistant` see Summary under Reports;
2. a logged-out request to `/api/summary` returns `401`;
3. `officer` does not see it and direct API access returns `403`;
4. current month is the default range;
5. a range over 366 days shows a validation message;
6. KPI totals match test data and Void is excluded;
7. trend switches day/week/month based on the range;
8. Topic source filter changes the Top NG Topic table;
9. Top NG Model shows `ข้อมูลน้อย` under five final Lots;
10. only three years can be selected;
11. clicking KPI/table rows, including `อื่น ๆ`, loads the correct paginated Lots;
12. `ดูข้อมูล` opens the existing Lot page read-only;
13. Loading, Empty and Error states are readable;
14. Desktop 1440px, Tablet 768px and Mobile 390px have no overlapping text.

- [ ] **Step 7: Run a final secret and scope review**

```powershell
git status --short
git diff --name-only
git diff --check
```

Confirm:

- no `.env`, backup, log, SQL dump, attachment or real factory data is in the diff;
- no package file changed;
- no Schema/migration changed;
- no unrelated refactor is included.

- [ ] **Step 8: Report completion and wait for Git approval**

Summarize changed files and test results. Do not run `git add`, commit, push or merge until the user explicitly requests it.
