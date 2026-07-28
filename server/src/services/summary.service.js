import { postgresDb } from '../config/database.js';
import { createCurrentNgConfirmationExistsSql } from './lot-approval-evidence.service.js';

const topicSources = ['all', 'dimension', 'packing'];
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

function cleanBoundedText(value, maxLength) {
  const text = String(value || '').trim();

  if (text.length > maxLength) {
    throw createHttpError(400, 'ข้อมูลยาวเกินกำหนด');
  }

  return text;
}

function validateUtcDate(value) {
  const dateText = cleanText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw createHttpError(400, 'วันที่ไม่ถูกต้อง');
  }

  const date = new Date(`${dateText}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) {
    throw createHttpError(400, 'วันที่ไม่ถูกต้อง');
  }

  return dateText;
}

function validateDateRange(startDate, endDate) {
  const rangeDays = Math.floor(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`))
      / 86400000
  ) + 1;

  if (rangeDays < 1 || rangeDays > maxRangeDays) {
    throw createHttpError(400, 'ช่วงวันที่ไม่ถูกต้อง');
  }
}

function getMonthRange(now) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  return {
    startDate: firstDay.toISOString().slice(0, 10),
    endDate: lastDay.toISOString().slice(0, 10)
  };
}

function parseYears(value, now) {
  const currentYear = new Date(now).getUTCFullYear();
  const yearsText = cleanText(value);

  if (!yearsText) {
    return [currentYear, currentYear - 1, currentYear - 2];
  }

  const years = yearsText.split(',').map((yearText) => {
    const trimmedYear = yearText.trim();

    if (!/^\d{4}$/.test(trimmedYear)) {
      throw createHttpError(400, 'ปีไม่ถูกต้อง');
    }

    return Number(trimmedYear);
  });

  if (
    years.length < 1 ||
    years.length > 3 ||
    new Set(years).size !== years.length ||
    years.some((year) => year < 2000 || year > 2100)
  ) {
    throw createHttpError(400, 'ปีไม่ถูกต้อง');
  }

  return years;
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

export function normalizeSummaryFilters(input = {}, now = new Date()) {
  const requestedFilters = input || {};
  const monthRange = getMonthRange(now);
  const startDate = validateUtcDate(cleanText(requestedFilters.startDate) || monthRange.startDate);
  const endDate = validateUtcDate(cleanText(requestedFilters.endDate) || monthRange.endDate);
  const rangeDays = Math.floor(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`))
      / 86400000
  ) + 1;

  if (rangeDays < 1) {
    throw createHttpError(400, 'ช่วงวันที่ไม่ถูกต้อง');
  }

  if (rangeDays > maxRangeDays) {
    throw createHttpError(400, 'ช่วงวันที่ยาวเกินกำหนด');
  }

  const topicSource = cleanText(requestedFilters.topicSource) || 'all';

  if (!topicSources.includes(topicSource)) {
    throw createHttpError(400, 'แหล่งหัวข้อไม่ถูกต้อง');
  }

  return {
    startDate,
    endDate,
    modelSearch: cleanBoundedText(requestedFilters.modelSearch, maxModelSearchLength),
    grade: cleanBoundedText(requestedFilters.grade, maxGradeLength),
    topicSource,
    years: parseYears(requestedFilters.years, now),
    trendGrouping: getTrendGrouping(startDate, endDate)
  };
}

function parsePositiveInteger(value, defaultValue) {
  const text = cleanText(value);

  if (!text) return defaultValue;
  if (!/^\d+$/.test(text) || Number(text) < 1 || !Number.isSafeInteger(Number(text))) {
    throw createHttpError(400, 'หน้าข้อมูลไม่ถูกต้อง');
  }

  return Number(text);
}

function parseDetailYear(value) {
  const yearText = cleanText(value);

  if (!/^\d{4}$/.test(yearText)) {
    throw createHttpError(400, 'ปีไม่ถูกต้อง');
  }

  const year = Number(yearText);
  if (year < 2000 || year > 2100) {
    throw createHttpError(400, 'ปีไม่ถูกต้อง');
  }

  return year;
}

function normalizeQualitySummaryLotsFilters(input = {}) {
  const requestedFilters = input || {};
  const view = cleanText(requestedFilters.view);

  if (!detailViews.includes(view)) {
    throw createHttpError(400, 'มุมมองรายละเอียดไม่ถูกต้อง');
  }

  const summaryFilters = normalizeSummaryFilters(requestedFilters);
  const filters = {
    ...summaryFilters,
    view,
    page: parsePositiveInteger(requestedFilters.page, 1),
    pageSize: parsePositiveInteger(requestedFilters.pageSize, 50),
    periodStart: '',
    periodEnd: '',
    topicName: '',
    modelName: '',
    rankGroup: '',
    unfinishedStatus: '',
    year: null
  };

  if (!summaryPageSizes.includes(filters.pageSize)) {
    throw createHttpError(400, 'ขนาดหน้าข้อมูลไม่ถูกต้อง');
  }

  if (view === 'trend') {
    filters.periodStart = validateUtcDate(cleanText(requestedFilters.periodStart));
    filters.periodEnd = validateUtcDate(cleanText(requestedFilters.periodEnd));
    validateDateRange(filters.periodStart, filters.periodEnd);

    if (
      filters.periodStart < summaryFilters.startDate
      || filters.periodEnd > summaryFilters.endDate
    ) {
      throw createHttpError(400, 'ช่วงวันที่รายละเอียดอยู่นอกช่วง Summary');
    }

    filters.startDate = filters.periodStart;
    filters.endDate = filters.periodEnd;
  }

  if (view === 'topic') {
    filters.topicSource = cleanText(requestedFilters.topicSource);
    filters.rankGroup = cleanText(requestedFilters.rankGroup) || 'selected';
    filters.topicName = cleanBoundedText(requestedFilters.topicName, 120);

    const validTopicSource = filters.rankGroup === 'other'
      ? topicSources.includes(filters.topicSource)
      : ['dimension', 'packing'].includes(filters.topicSource);

    if (!validTopicSource || !rankGroups.includes(filters.rankGroup)) {
      throw createHttpError(400, 'ตัวกรองหัวข้อไม่ถูกต้อง');
    }
    if (filters.rankGroup === 'selected' && !filters.topicName) {
      throw createHttpError(400, 'ต้องระบุหัวข้อ');
    }
  }

  if (view === 'model') {
    filters.rankGroup = cleanText(requestedFilters.rankGroup) || 'selected';
    filters.modelName = cleanBoundedText(requestedFilters.modelName, 200);

    if (!rankGroups.includes(filters.rankGroup)) {
      throw createHttpError(400, 'ตัวกรองรุ่นไม่ถูกต้อง');
    }
    if (filters.rankGroup === 'selected' && !filters.modelName) {
      throw createHttpError(400, 'ต้องระบุรุ่น');
    }
  }

  if (view === 'year') {
    filters.year = parseDetailYear(requestedFilters.year);
    filters.startDate = `${filters.year}-01-01`;
    filters.endDate = `${filters.year}-12-31`;
  }

  if (view === 'unfinished') {
    filters.unfinishedStatus = cleanText(requestedFilters.unfinishedStatus) || 'all';
    if (!unfinishedStatuses.includes(filters.unfinishedStatus)) {
      throw createHttpError(400, 'สถานะงานค้างไม่ถูกต้อง');
    }
  }

  return filters;
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function createSummaryWhereClause(filters, includeDateRange = true) {
  const params = [];
  const conditions = ["lots.status <> 'void'"];

  if (includeDateRange) {
    const startDateParam = addParameter(params, filters.startDate);
    const endDateParam = addParameter(params, filters.endDate);
    conditions.push(`lots.production_date BETWEEN ${startDateParam} AND ${endDateParam}`);
  }

  if (filters.modelSearch) {
    const modelSearchParam = addParameter(params, `%${escapeLikeSearch(filters.modelSearch)}%`);
    conditions.push(`(
      lots.model_name ILIKE ${modelSearchParam} ESCAPE '\\'
      OR lots.dimension ILIKE ${modelSearchParam} ESCAPE '\\'
    )`);
  }

  if (filters.grade) {
    conditions.push(`lots.aci_grade = ${addParameter(params, filters.grade)}`);
  }

  return {
    sql: conditions.join('\n       AND '),
    params
  };
}

function createClassifiedLotsCtes(whereSql) {
  const currentNgConfirmationExistsSql = createCurrentNgConfirmationExistsSql({
    lotIdExpression: 'lots.id',
    confirmationAlias: 'summary_confirmed_ng'
  });

  return `filtered_lots AS (
      SELECT
        lots.id,
        lots.status,
        lots.lot_number,
        lots.production_date,
        lots.model_name,
        lots.dimension,
        lots.aci_grade,
        dimension_inspections.status AS dimension_status,
        dimension_inspections.pieces_data,
        packing_inspections.id AS packing_inspection_id,
        packing_inspections.status AS packing_status,
        packing_inspections.results_data,
        ${currentNgConfirmationExistsSql} AS has_current_ng_confirmation
      FROM lots
      LEFT JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
      LEFT JOIN packing_inspections ON packing_inspections.lot_id = lots.id
      WHERE ${whereSql}
    ),
    classified_lots AS (
      SELECT
        *,
        CASE
          WHEN status = 'approved'
            AND dimension_status = 'completed'
            AND packing_status = 'completed'
            AND EXISTS (
              SELECT 1
              FROM lot_audit_logs approved_logs
              WHERE approved_logs.lot_id = filtered_lots.id
                AND approved_logs.action = 'approve'
            )
          THEN 'approved'
          WHEN status = 'ng'
            AND dimension_status = 'completed'
            AND (
              packing_inspection_id IS NULL
              OR packing_status = 'completed'
            )
            AND has_current_ng_confirmation
          THEN 'confirmed_ng'
          ELSE NULL
        END AS final_result
      FROM filtered_lots
    )`;
}

function createStatsSql(whereSql) {
  return `/* summary:stats */
    WITH ${createClassifiedLotsCtes(whereSql)}
    SELECT
      COUNT(*) FILTER (WHERE final_result IS NOT NULL) AS final_lots,
      COUNT(*) FILTER (WHERE final_result = 'approved') AS approved_lots,
      COUNT(*) FILTER (WHERE final_result = 'confirmed_ng') AS confirmed_ng_lots,
      COUNT(*) FILTER (WHERE status = 'pending') AS waiting_inspection,
      COUNT(*) FILTER (WHERE status = 'temp') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'need_fix') AS need_fix,
      COUNT(*) FILTER (WHERE status = 'waiting_pack') AS waiting_packing,
      COUNT(*) FILTER (
        WHERE status = 'waiting_approve'
          OR (status = 'ng' AND NOT has_current_ng_confirmation)
      ) AS waiting_approval
    FROM classified_lots`;
}

function createTrendSql(filters, whereSql) {
  const trendTruncUnit = {
    day: 'day',
    week: 'week',
    month: 'month'
  }[filters.trendGrouping];

  return `/* summary:trend */
    WITH ${createClassifiedLotsCtes(whereSql)}
    SELECT
      date_trunc('${trendTruncUnit}', production_date)::date AS period_start,
      COUNT(*) FILTER (WHERE final_result IS NOT NULL) AS final_lots,
      COUNT(*) FILTER (WHERE final_result = 'approved') AS approved_lots,
      COUNT(*) FILTER (WHERE final_result = 'confirmed_ng') AS confirmed_ng_lots
    FROM classified_lots
    GROUP BY period_start
    HAVING COUNT(*) FILTER (WHERE final_result IS NOT NULL) > 0
    ORDER BY period_start`;
}

function createTopicsQuery(filters, where) {
  const params = [...where.params];
  const topicSourceSql = filters.topicSource === 'all'
    ? ''
    : `AND source = ${addParameter(params, filters.topicSource)}`;
  const otherSourceParam = addParameter(params, filters.topicSource);

  return {
    sql: `/* summary:topics */
      WITH ${createClassifiedLotsCtes(where.sql)},
      topic_lots AS (
        SELECT DISTINCT
          lots.id AS lot_id,
          'dimension' AS source,
          NULLIF(BTRIM(lots.pieces_data #>> '{meta,ngStop,topicName}'), '') AS topic_name
        FROM classified_lots lots
        WHERE lots.final_result = 'confirmed_ng'

        UNION ALL

        SELECT DISTINCT
          lots.id AS lot_id,
          'packing' AS source,
          NULLIF(BTRIM(topic->>'topicName'), '') AS topic_name
        FROM classified_lots lots
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(lots.results_data->'topics', '[]'::jsonb)
        ) AS topic
        WHERE lots.final_result = 'confirmed_ng'
          AND topic->>'value' = 'fail'
      ),
      scoped_topics AS (
        SELECT lot_id, source, topic_name
        FROM topic_lots
        WHERE topic_name IS NOT NULL
          ${topicSourceSql}
      ),
      topic_counts AS (
        SELECT
          source,
          topic_name,
          COUNT(DISTINCT lot_id) AS ng_lots
        FROM scoped_topics
        GROUP BY source, topic_name
      ),
      ranked_topics AS (
        SELECT
          source,
          topic_name,
          ng_lots,
          ROW_NUMBER() OVER (
            ORDER BY ng_lots DESC, topic_name ASC, source ASC
          ) AS topic_rank
        FROM topic_counts
      ),
      top_topics AS (
        SELECT source, topic_name, ng_lots, topic_rank
        FROM ranked_topics
        WHERE topic_rank <= 5
      ),
      other_lots AS (
        SELECT COUNT(DISTINCT scoped_topics.lot_id) AS ng_lots
        FROM scoped_topics
        WHERE NOT EXISTS (
          SELECT 1
          FROM top_topics
          WHERE top_topics.source = scoped_topics.source
            AND top_topics.topic_name = scoped_topics.topic_name
        )
      )
      SELECT source, topic_name, ng_lots, FALSE AS is_other, topic_rank
      FROM top_topics

      UNION ALL

      SELECT
        ${otherSourceParam} AS source,
        NULL AS topic_name,
        ng_lots,
        TRUE AS is_other,
        6 AS topic_rank
      FROM other_lots
      WHERE ng_lots > 0

      ORDER BY topic_rank, topic_name ASC, source ASC`,
    params
  };
}

function createModelsSql(whereSql) {
  return `/* summary:models */
    WITH ${createClassifiedLotsCtes(whereSql)},
    model_totals AS (
      SELECT
        COALESCE(NULLIF(BTRIM(model_name), ''), '-') AS model_name,
        COUNT(*) AS final_lots,
        COUNT(*) FILTER (WHERE final_result = 'confirmed_ng') AS confirmed_ng_lots
      FROM classified_lots
      WHERE final_result IS NOT NULL
      GROUP BY COALESCE(NULLIF(BTRIM(model_name), ''), '-')
    )
    SELECT model_name, final_lots, confirmed_ng_lots
    FROM model_totals
    ORDER BY
      (confirmed_ng_lots::numeric / NULLIF(final_lots, 0)) DESC,
      confirmed_ng_lots DESC,
      model_name ASC`;
}

function createDetailTopicCtes() {
  return `topic_lots AS (
      SELECT DISTINCT
        classified_lots.id AS lot_id,
        'dimension' AS source,
        NULLIF(BTRIM(classified_lots.pieces_data #>> '{meta,ngStop,topicName}'), '') AS topic_name
      FROM classified_lots
      WHERE classified_lots.final_result = 'confirmed_ng'

      UNION ALL

      SELECT DISTINCT
        classified_lots.id AS lot_id,
        'packing' AS source,
        NULLIF(BTRIM(topic->>'topicName'), '') AS topic_name
      FROM classified_lots
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(classified_lots.results_data->'topics', '[]'::jsonb)
      ) AS topic
      WHERE classified_lots.final_result = 'confirmed_ng'
        AND topic->>'value' = 'fail'
    ),
    ng_topic_lists AS (
      SELECT lot_id, array_agg(topic_name ORDER BY topic_name) AS ng_topics
      FROM (
        SELECT DISTINCT lot_id, topic_name
        FROM topic_lots
        WHERE topic_name IS NOT NULL
      ) AS distinct_topics
      GROUP BY lot_id
    )`;
}

function createDetailViewCondition(filters, params) {
  if (filters.view === 'final') return { sql: 'classified_lots.final_result IS NOT NULL', ctes: '' };
  if (filters.view === 'approved') return { sql: "classified_lots.final_result = 'approved'", ctes: '' };
  if (filters.view === 'confirmed_ng') return { sql: "classified_lots.final_result = 'confirmed_ng'", ctes: '' };

  if (filters.view === 'unfinished') {
    if (filters.unfinishedStatus === 'all') {
      return {
        sql: `(classified_lots.status IN ('pending', 'temp', 'need_fix', 'waiting_pack', 'waiting_approve')
          OR (classified_lots.status = 'ng' AND NOT classified_lots.has_current_ng_confirmation))`,
        ctes: ''
      };
    }
    if (filters.unfinishedStatus === 'waiting_approve') {
      return {
        sql: `(classified_lots.status = 'waiting_approve'
          OR (classified_lots.status = 'ng' AND NOT classified_lots.has_current_ng_confirmation))`,
        ctes: ''
      };
    }
    return {
      sql: `classified_lots.status = ${addParameter(params, filters.unfinishedStatus)}`,
      ctes: ''
    };
  }

  if (filters.view === 'topic') {
    if (filters.rankGroup === 'selected') {
      const topicSourceParam = addParameter(params, filters.topicSource);
      const topicNameParam = addParameter(params, filters.topicName);
      return {
        sql: `classified_lots.final_result = 'confirmed_ng'
          AND EXISTS (
            SELECT 1
            FROM topic_lots
            WHERE topic_lots.lot_id = classified_lots.id
              AND topic_lots.source = ${topicSourceParam}
              AND topic_lots.topic_name = ${topicNameParam}
          )`,
        ctes: ''
      };
    }

    const topicSourceCondition = filters.topicSource === 'all'
      ? ''
      : `AND topic_lots.source = ${addParameter(params, filters.topicSource)}`;

    return {
      sql: `classified_lots.final_result = 'confirmed_ng'
        AND EXISTS (
          SELECT 1
          FROM topic_lots
          WHERE topic_lots.lot_id = classified_lots.id
            ${topicSourceCondition}
            AND topic_lots.topic_name IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM top_ranked_topics
              WHERE top_ranked_topics.source = topic_lots.source
                AND top_ranked_topics.topic_name = topic_lots.topic_name
            )
        )`,
      ctes: `,
    top_ranked_topics AS (
      SELECT source, topic_name
      FROM topic_lots
      WHERE topic_name IS NOT NULL
        ${topicSourceCondition}
      GROUP BY source, topic_name
      ORDER BY COUNT(DISTINCT lot_id) DESC, topic_name ASC, source ASC
      LIMIT 5
    )`
    };
  }

  if (filters.view === 'model') {
    const normalizedModel = "COALESCE(NULLIF(BTRIM(classified_lots.model_name), ''), '-')";
    if (filters.rankGroup === 'selected') {
      return {
        sql: `classified_lots.final_result IS NOT NULL
          AND ${normalizedModel} = ${addParameter(params, filters.modelName)}`,
        ctes: ''
      };
    }

    return {
      sql: `classified_lots.final_result IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM top_ranked_models
          WHERE top_ranked_models.model_name = ${normalizedModel}
        )`,
      ctes: `,
    top_ranked_models AS (
      SELECT
        COALESCE(NULLIF(BTRIM(model_name), ''), '-') AS model_name,
        COUNT(*) AS final_lots,
        COUNT(*) FILTER (WHERE final_result = 'confirmed_ng') AS confirmed_ng_lots
      FROM classified_lots
      WHERE final_result IS NOT NULL
      GROUP BY COALESCE(NULLIF(BTRIM(model_name), ''), '-')
      ORDER BY
        (COUNT(*) FILTER (WHERE final_result = 'confirmed_ng')::numeric / NULLIF(COUNT(*), 0)) DESC,
        COUNT(*) FILTER (WHERE final_result = 'confirmed_ng') DESC,
        model_name ASC
      LIMIT 5
    )`
    };
  }

  return { sql: 'TRUE', ctes: '' };
}

function createQualitySummaryLotsQuery(filters, queryType) {
  const where = createSummaryWhereClause(filters);
  const params = [...where.params];
  const detailView = createDetailViewCondition(filters, params);
  const ctes = `${createClassifiedLotsCtes(where.sql)},
    ${createDetailTopicCtes()}${detailView.ctes}`;

  if (queryType === 'count') {
    return {
      sql: `/* summary:lots:count */
        WITH ${ctes}
        SELECT COUNT(*) AS total_lots
        FROM classified_lots
        WHERE ${detailView.sql}`,
      params
    };
  }

  const limitParam = addParameter(params, filters.pageSize);
  const offsetParam = addParameter(params, (filters.page - 1) * filters.pageSize);

  return {
    sql: `/* summary:lots:list */
      WITH ${ctes}
      SELECT
        classified_lots.lot_number,
        classified_lots.production_date,
        classified_lots.model_name,
        classified_lots.dimension,
        classified_lots.aci_grade,
        classified_lots.final_result,
        COALESCE(ng_topic_lists.ng_topics, ARRAY[]::text[]) AS ng_topics
      FROM classified_lots
      LEFT JOIN ng_topic_lists ON ng_topic_lists.lot_id = classified_lots.id
      WHERE ${detailView.sql}
      ORDER BY production_date DESC, lot_number DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  };
}

function createYearlyQuery(filters) {
  const where = createSummaryWhereClause(filters, false);
  const params = [...where.params];
  const yearRangesSql = filters.years.map((year) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return `(${addParameter(params, year)}::integer, ${addParameter(params, startDate)}::date, ${addParameter(params, endDate)}::date)`;
  }).join(',\n        ');

  return {
    sql: `/* summary:yearly */
      WITH ${createClassifiedLotsCtes(where.sql)},
      selected_years (year, start_date, end_date) AS (
        VALUES
          ${yearRangesSql}
      )
      SELECT
        selected_years.year,
        COUNT(classified_lots.id) FILTER (
          WHERE classified_lots.final_result IS NOT NULL
        ) AS final_lots,
        COUNT(classified_lots.id) FILTER (
          WHERE classified_lots.final_result = 'approved'
        ) AS approved_lots,
        COUNT(classified_lots.id) FILTER (
          WHERE classified_lots.final_result = 'confirmed_ng'
        ) AS confirmed_ng_lots
      FROM selected_years
      LEFT JOIN classified_lots
        ON classified_lots.production_date BETWEEN selected_years.start_date AND selected_years.end_date
      GROUP BY selected_years.year
      ORDER BY selected_years.year DESC`,
    params
  };
}

function createOptionsSql() {
  return `/* summary:options */
    SELECT
      ARRAY(
        SELECT DISTINCT aci_grade
        FROM lots
        WHERE status <> 'void'
          AND aci_grade IS NOT NULL
          AND BTRIM(aci_grade) <> ''
        ORDER BY aci_grade
      ) AS grades,
      ARRAY(
        SELECT DISTINCT EXTRACT(YEAR FROM production_date)::integer
        FROM lots
        WHERE status <> 'void'
          AND production_date IS NOT NULL
        ORDER BY EXTRACT(YEAR FROM production_date)::integer DESC
      ) AS years`;
}

function mapStats(row) {
  const finalLots = Number(row.final_lots || 0);
  const approvedLots = Number(row.approved_lots || 0);
  const confirmedNgLots = Number(row.confirmed_ng_lots || 0);
  const unfinished = {
    waitingInspection: Number(row.waiting_inspection || 0),
    inProgress: Number(row.in_progress || 0),
    needFix: Number(row.need_fix || 0),
    waitingPacking: Number(row.waiting_packing || 0),
    waitingApproval: Number(row.waiting_approval || 0)
  };

  return {
    finalLots,
    approvedLots,
    confirmedNgLots,
    ngRate: calculateNgRate(finalLots, confirmedNgLots),
    unfinishedTotal: Object.values(unfinished).reduce((total, value) => total + value, 0),
    unfinished
  };
}

function roundRate(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateNgRate(finalLots, confirmedNgLots) {
  return finalLots ? roundRate((confirmedNgLots / finalLots) * 100) : 0;
}

function mapTopicRow(row) {
  const isOther = Boolean(row.is_other);

  return {
    source: row.source,
    topicName: isOther ? 'อื่น ๆ' : row.topic_name,
    ngLots: Number(row.ng_lots || 0),
    isOther
  };
}

function mapModelRow(row) {
  const finalLots = Number(row.finalLots ?? row.final_lots ?? 0);
  const confirmedNgLots = Number(row.confirmedNgLots ?? row.confirmed_ng_lots ?? 0);

  return {
    modelName: row.modelName ?? row.model_name,
    finalLots,
    confirmedNgLots,
    ngRate: calculateNgRate(finalLots, confirmedNgLots),
    isLowData: finalLots < 5,
    isOther: false
  };
}

export function collapseTopModels(rows) {
  const mappedRows = rows.map(mapModelRow);
  const topModels = mappedRows.slice(0, 5);
  const remainingModels = mappedRows.slice(5);

  if (!remainingModels.length) return topModels;

  const finalLots = remainingModels.reduce((total, row) => total + row.finalLots, 0);
  const confirmedNgLots = remainingModels.reduce((total, row) => total + row.confirmedNgLots, 0);

  return [...topModels, {
    modelName: 'อื่น ๆ',
    finalLots,
    confirmedNgLots,
    ngRate: calculateNgRate(finalLots, confirmedNgLots),
    isOther: true,
    isLowData: false
  }];
}

function toDateText(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapFinalResultLabel(finalResult) {
  if (finalResult === 'approved') return 'Approved';
  if (finalResult === 'confirmed_ng') return 'Confirmed NG';
  return '';
}

function mapSummaryLotRow(row) {
  return {
    lotNumber: row.lot_number,
    productionDate: toDateText(row.production_date),
    modelName: row.model_name || '-',
    dimension: row.dimension || '-',
    grade: row.aci_grade || '-',
    finalResult: row.final_result || '',
    finalResultLabel: mapFinalResultLabel(row.final_result),
    ngTopics: Array.isArray(row.ng_topics) ? row.ng_topics : []
  };
}

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTrendPeriodEnd(periodStart, trendGrouping) {
  if (trendGrouping === 'week') return addUtcDays(periodStart, 6);
  if (trendGrouping === 'month') {
    const date = new Date(`${periodStart}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  }
  return periodStart;
}

function formatDateLabel(dateText) {
  const [year, month, day] = dateText.split('-');
  return `${day}/${month}/${year}`;
}

function mapTrendRow(row, trendGrouping, filters) {
  const rawPeriodStart = toDateText(row.period_start);
  const rawPeriodEnd = getTrendPeriodEnd(rawPeriodStart, trendGrouping);
  const periodStart = rawPeriodStart < filters.startDate ? filters.startDate : rawPeriodStart;
  const periodEnd = rawPeriodEnd > filters.endDate ? filters.endDate : rawPeriodEnd;
  const finalLots = Number(row.final_lots || 0);
  const approvedLots = Number(row.approved_lots || 0);
  const confirmedNgLots = Number(row.confirmed_ng_lots || 0);

  return {
    periodKey: rawPeriodStart,
    label: formatDateLabel(periodStart),
    periodStart,
    periodEnd,
    finalLots,
    approvedLots,
    confirmedNgLots,
    ngRate: calculateNgRate(finalLots, confirmedNgLots)
  };
}

function mapYearlyRows(rows) {
  const mappedRows = rows.map((row) => {
    const finalLots = Number(row.final_lots || 0);
    const confirmedNgLots = Number(row.confirmed_ng_lots || 0);

    return {
      year: Number(row.year),
      finalLots,
      approvedLots: Number(row.approved_lots || 0),
      confirmedNgLots,
      ngRate: calculateNgRate(finalLots, confirmedNgLots)
    };
  }).sort((first, second) => second.year - first.year);

  return mappedRows.map((row, index) => {
    const previousRate = mappedRows[index + 1]?.ngRate;
    return {
      ...row,
      ngRateChange: Number.isFinite(previousRate)
        ? roundRate(row.ngRate - previousRate)
        : null
    };
  });
}

export async function getQualitySummary(input = {}, connection = postgresDb) {
  const filters = normalizeSummaryFilters(input);
  const where = createSummaryWhereClause(filters);
  const topicsQuery = createTopicsQuery(filters, where);
  const yearlyQuery = createYearlyQuery(filters);
  const [
    { rows: statRows },
    { rows: optionRows },
    { rows: trendRows },
    { rows: topicRows },
    { rows: modelRows },
    { rows: yearlyRows }
  ] = await Promise.all([
    connection.query(createStatsSql(where.sql), where.params),
    connection.query(createOptionsSql(), []),
    connection.query(createTrendSql(filters, where.sql), where.params),
    connection.query(topicsQuery.sql, topicsQuery.params),
    connection.query(createModelsSql(where.sql), where.params),
    connection.query(yearlyQuery.sql, yearlyQuery.params)
  ]);

  return {
    ok: true,
    filters,
    options: {
      grades: optionRows[0]?.grades || [],
      years: optionRows[0]?.years || []
    },
    updatedAt: new Date().toISOString(),
    stats: mapStats(statRows[0] || {}),
    trend: trendRows.map((row) => mapTrendRow(row, filters.trendGrouping, filters)),
    topNgTopics: topicRows.map(mapTopicRow),
    topNgModels: collapseTopModels(modelRows),
    yearly: mapYearlyRows(yearlyRows)
  };
}

export async function getQualitySummaryLots(input = {}, connection = postgresDb) {
  const filters = normalizeQualitySummaryLotsFilters(input);
  const countQuery = createQualitySummaryLotsQuery(filters, 'count');
  const listQuery = createQualitySummaryLotsQuery(filters, 'list');
  const [{ rows: countRows }, { rows: lotRows }] = await Promise.all([
    connection.query(countQuery.sql, countQuery.params),
    connection.query(listQuery.sql, listQuery.params)
  ]);
  const total = Number(countRows[0]?.total_lots || 0);

  return {
    items: lotRows.map(mapSummaryLotRow),
    summary: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize)
    }
  };
}
