import { query, withTransaction } from "@/_lib/db";
import {
  buildCoordinate,
  cleanOptionalText,
  cleanText,
  formatDateOnly,
  parseDateInput,
  splitCoordinate,
  toNumber,
} from "@/_lib/http";
import { saveBase64File } from "@/_lib/uploads";

const DEFAULT_PROJECT_STATUS = "ລໍຖ້າດຳເນີນ";
const READY_FOR_WITHDRAWAL_STATUS = "ສາມາດເບີກຂອງໃດ້";

const PROJECT_SELECT = `
  SELECT
    p.id,
    p.project_name,
    p.project_description,
    p.province,
    prov.name_1 AS province_name,
    p.district,
    dist.name_1 AS district_name,
    p.village,
    vill.name_1 AS village_name,
    p.coordinator,
    p.phone,
    p.image_url,
    p.sale_code,
    sale.name_1 AS sale_name,
    p.sml_code,
    ar.name_1 AS customer_name,
    p.office_lg,
    p.project_lg,
    p.project_type,
    pt.name_1 AS project_type_name,
    p.created_at,
    p.status AS status_code,
    p.project_status,
    p.close_date,
    p.approve_status,
    p.approver,
    p.closer,
    p.date_register,
    p.business_type_id,
    bt.name_1 AS business_type_name,
    p.business_model_id,
    bm.name_1 AS business_model_name
  FROM odg_projects p
  LEFT JOIN erp_province prov
    ON prov.code = p.province
  LEFT JOIN erp_amper dist
    ON dist.code = p.district
   AND dist.province = p.province
  LEFT JOIN erp_tambon vill
    ON vill.code = p.village
   AND vill.amper = p.district
   AND vill.province = p.province
  LEFT JOIN ar_customer ar
    ON ar.code = p.sml_code
  LEFT JOIN odg_project_business_type bt
    ON bt.code = p.business_type_id
  LEFT JOIN odg_project_business_model bm
    ON bm.code = p.business_model_id
  LEFT JOIN odg_project_type pt
    ON pt.code = p.project_type
  LEFT JOIN biotime_employee sale
    ON sale.code = p.sale_code
`;

let ensureStatusHistoryTablePromise = null;
let ensureContractColumnsPromise = null;
let quotationTableExistsPromise = null;
const MINUTE_IN_MS = 60 * 1000;

async function ensureProjectContractCurrencyColumn(client = null) {
  // Once these ALTERs succeed (in any session), the columns exist for everyone.
  // Cache so subsequent list-loads don't pay the DDL lock + round-trip.
  if (ensureContractColumnsPromise) {
    return ensureContractColumnsPromise;
  }

  const runner = client ? client.query.bind(client) : query;
  ensureContractColumnsPromise = (async () => {
    await runner(`
      ALTER TABLE odg_projects_contract
      ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16)
    `);
    await runner(`
      ALTER TABLE odg_projects_contract
      ADD COLUMN IF NOT EXISTS quotation_id BIGINT
    `);
  })().catch((err) => {
    // Reset on failure so the next request retries instead of being stuck.
    ensureContractColumnsPromise = null;
    throw err;
  });

  return ensureContractColumnsPromise;
}

function normalizeHistoryValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return String(value);
}

async function runHistoryQuery(client, text, params = []) {
  if (client) {
    return client.query(text, params);
  }
  return query(text, params);
}

async function ensureStatusHistoryTable(client = null) {
  if (client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS odg_project_status_history (
        id BIGSERIAL PRIMARY KEY,
        project_id TEXT NOT NULL,
        contract_no TEXT,
        entity_type VARCHAR(32) NOT NULL,
        field_name VARCHAR(64) NOT NULL,
        action_name VARCHAR(64) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT,
        note TEXT,
        extra_payload JSONB,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_odg_project_status_history_project_id
       ON odg_project_status_history (project_id, changed_at DESC, id DESC)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_odg_project_status_history_contract_no
       ON odg_project_status_history (contract_no, changed_at DESC, id DESC)`,
    );
    return;
  }

  if (!ensureStatusHistoryTablePromise) {
    ensureStatusHistoryTablePromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_project_status_history (
          id BIGSERIAL PRIMARY KEY,
          project_id TEXT NOT NULL,
          contract_no TEXT,
          entity_type VARCHAR(32) NOT NULL,
          field_name VARCHAR(64) NOT NULL,
          action_name VARCHAR(64) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by TEXT,
          note TEXT,
          extra_payload JSONB,
          changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(
        `CREATE INDEX IF NOT EXISTS idx_odg_project_status_history_project_id
         ON odg_project_status_history (project_id, changed_at DESC, id DESC)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_odg_project_status_history_contract_no
         ON odg_project_status_history (contract_no, changed_at DESC, id DESC)`,
      );
    })();
  }

  await ensureStatusHistoryTablePromise;
}

async function insertStatusHistoryEntries(client, entries) {
  const validEntries = Array.isArray(entries)
    ? entries.filter(Boolean).filter((entry) => {
        const oldValue = normalizeHistoryValue(entry.oldValue);
        const newValue = normalizeHistoryValue(entry.newValue);
        return oldValue !== newValue;
      })
    : [];

  if (!validEntries.length) return;

  await ensureStatusHistoryTable(client);

  for (const entry of validEntries) {
    await runHistoryQuery(
      client,
      `
        INSERT INTO odg_project_status_history (
          project_id,
          contract_no,
          entity_type,
          field_name,
          action_name,
          old_value,
          new_value,
          changed_by,
          note,
          extra_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
        )
      `,
      [
        cleanText(entry.projectId),
        cleanOptionalText(entry.contractNo),
        cleanText(entry.entityType || "project"),
        cleanText(entry.fieldName),
        cleanText(entry.actionName || "status_update"),
        normalizeHistoryValue(entry.oldValue),
        normalizeHistoryValue(entry.newValue),
        cleanOptionalText(entry.changedBy),
        cleanOptionalText(entry.note),
        entry.extraPayload ? JSON.stringify(entry.extraPayload) : null,
      ],
    );
  }
}

function parseTrackingDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDurationLabel(totalMinutes) {
  const minutes = Math.max(0, Math.round(toNumber(totalMinutes)));
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts = [];

  if (days > 0) parts.push(`${days} ມື້`);
  if (hours > 0) parts.push(`${hours} ຊົ່ວໂມງ`);
  if (days === 0 && mins > 0) parts.push(`${mins} ນາທີ`);

  return parts.length ? parts.slice(0, 2).join(" ") : "0 ນາທີ";
}

function buildProjectTiming(project, historyRows) {
  const startedAt =
    parseTrackingDate(project?.date_register) ||
    parseTrackingDate(project?.created_at);
  const endedAt = parseTrackingDate(project?.close_date) || new Date();

  if (!startedAt) {
    return {
      project_elapsed_minutes: 0,
      project_elapsed_label: "0 ນາທີ",
      current_status_elapsed_minutes: 0,
      current_status_elapsed_label: "0 ນາທີ",
      current_status_since: null,
      status_durations: [],
    };
  }

  const statusChanges = (Array.isArray(historyRows) ? historyRows : [])
    .filter((row) => cleanText(row?.field_name) === "project_status")
    .map((row) => ({
      oldValue: cleanOptionalText(row?.old_value),
      newValue: cleanOptionalText(row?.new_value),
      changedAt: parseTrackingDate(row?.changed_at),
    }))
    .filter((row) => row.changedAt)
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

  const segments = [];

  if (!statusChanges.length) {
    segments.push({
      status:
        cleanOptionalText(project?.project_status) || DEFAULT_PROJECT_STATUS,
      startedAt,
      endedAt,
      isCurrent: true,
    });
  } else {
    const firstChange = statusChanges[0];
    const initialStatus =
      cleanOptionalText(firstChange.oldValue) ||
      cleanOptionalText(project?.project_status) ||
      DEFAULT_PROJECT_STATUS;

    segments.push({
      status: initialStatus,
      startedAt,
      endedAt: firstChange.changedAt,
      isCurrent: false,
    });

    statusChanges.forEach((change, index) => {
      const nextChange = statusChanges[index + 1];
      segments.push({
        status:
          cleanOptionalText(change.newValue) ||
          cleanOptionalText(project?.project_status) ||
          DEFAULT_PROJECT_STATUS,
        startedAt: change.changedAt,
        endedAt: nextChange?.changedAt || endedAt,
        isCurrent: !nextChange,
      });
    });
  }

  const aggregates = new Map();
  let currentSegment = null;

  for (const segment of segments) {
    const from = segment.startedAt;
    const to =
      segment.endedAt && segment.endedAt.getTime() > from.getTime()
        ? segment.endedAt
        : from;
    const minutes = Math.max(
      0,
      Math.round((to.getTime() - from.getTime()) / MINUTE_IN_MS),
    );
    const key = segment.status;

    if (!aggregates.has(key)) {
      aggregates.set(key, {
        status: key,
        minutes: 0,
        label: "0 ນາທີ",
        entries: 0,
        is_current: false,
        current_started_at: null,
        last_ended_at: null,
      });
    }

    const entry = aggregates.get(key);
    entry.minutes += minutes;
    entry.entries += 1;
    entry.label = formatDurationLabel(entry.minutes);

    if (segment.isCurrent) {
      entry.is_current = true;
      entry.current_started_at = from.toISOString();
      currentSegment = {
        minutes,
        label: formatDurationLabel(minutes),
        since: from.toISOString(),
      };
    } else {
      entry.last_ended_at = to.toISOString();
    }
  }

  const totalMinutes = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / MINUTE_IN_MS),
  );

  return {
    project_elapsed_minutes: totalMinutes,
    project_elapsed_label: formatDurationLabel(totalMinutes),
    current_status_elapsed_minutes: currentSegment?.minutes || 0,
    current_status_elapsed_label: currentSegment?.label || "0 ນາທີ",
    current_status_since: currentSegment?.since || null,
    status_durations: Array.from(aggregates.values()),
  };
}

function normalizeInstallmentItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    amount: toNumber(item?.amount),
    item_index: toNumber(item?.item_index),
  }));
}

function getEffectiveAccountingApproval(contract) {
  return Math.max(
    toNumber(contract?.approve_status_2),
    toNumber(contract?.acc_approve),
  );
}

function makeStatusText(contract) {
  const approve1 = toNumber(contract.approve_status_1);
  const approve2 = getEffectiveAccountingApproval(contract);

  if (approve1 === 1 && approve2 === 1) return "ສຳເລັດແລ້ວ";
  if (approve1 === 1) return "ລໍຖ້າຝ່າຍບັນຊີກວດສອບ";
  return "ລໍຖ້າອະນຸມັດ";
}

function mapContractRow(
  contract,
  detailMap,
  installmentMap,
  attachmentMap,
  boqContractIdSet = null,
  boqListByContract = null,
) {
  const contractNo = cleanText(contract.contract_no);
  const contractId = toNumber(contract.roworder);
  const hasBoq = boqContractIdSet ? boqContractIdSet.has(contractId) : false;
  const boqList = boqListByContract ? boqListByContract.get(contractId) || [] : [];
  return {
    id: contractId || contract.roworder,
    roworder: contract.roworder,
    project_id: cleanText(contract.project_id),
    quotation_id: contract.quotation_id ?? null,
    contract_name: contract.contract_name,
    contract_no: contract.contract_no,
    contract_date: formatDateOnly(contract.contract_date),
    estimated_date_start: formatDateOnly(contract.estimated_date_start),
    cust_code: contract.cust_code || "",
    currency_code: cleanOptionalText(contract.currency_code) || "LAK",
    amount: toNumber(contract.amount),
    total_amount: toNumber(contract.amount),
    payment_type: contract.payment_type || "",
    brand: contract.brand || "",
    start_date: formatDateOnly(contract.start_date),
    end_date: formatDateOnly(contract.end_date),
    approve_status_1: toNumber(contract.approve_status_1),
    approve_status_2: getEffectiveAccountingApproval(contract),
    approver_1: contract.approver_1,
    approver_2: contract.approver_2,
    acc_approve: toNumber(contract.acc_approve),
    acc_approver: contract.acc_approver,
    has_boq: hasBoq,
    boq_status: hasBoq ? "done" : "pending",
    boq_list: boqList,
    created_at: contract.created_at,
    contract_status: contract.contract_status,
    att_list: attachmentMap.get(contractNo) || [],
    contract_detail: detailMap.get(contractNo) || [],
    installment_schedule: installmentMap.get(contractNo) || [],
    p_status: makeStatusText(contract),
  };
}

function mapProjectSummaryRow(row, contractlist = null) {
  return {
    bussiness_model: row.business_model_name || null,
    bussiness_type: row.business_type_name || null,
    close_date: row.close_date || null,
    contractlist,
    coordinator: row.coordinator || null,
    contract_count: toNumber(row.contract_count),
    approved_contract_count: toNumber(row.approved_contract_count),
    pending_contract_count: toNumber(row.pending_contract_count),
    acc_approved_contract_count: toNumber(row.acc_approved_contract_count),
    boq_contract_count: toNumber(row.boq_contract_count),
    boq_count: toNumber(row.boq_count),
    quotation_count: toNumber(row.quotation_count),
    approved_quotation_count: toNumber(row.approved_quotation_count),
    waiting_contract: toNumber(row.pending_contract_count) > 0,
    has_fully_approved_contract: toNumber(row.approved_contract_count) > 0,
    created_at: row.created_at,
    date_register: row.date_register,
    district: row.district,
    district_name: row.district_name,
    id: row.id,
    image_gallery:
      contractlist === null ? null : row.image_url ? [row.image_url] : [],
    image_url: row.image_url || null,
    office_lg: row.office_lg || "",
    phone: row.phone || "",
    project_description: row.project_description || "",
    project_lg: row.project_lg || "",
    project_name: row.project_name,
    project_status: row.project_status || DEFAULT_PROJECT_STATUS,
    project_type: row.project_type_name || row.project_type || null,
    province: row.province,
    province_name: row.province_name,
    sale_code: row.sale_code || null,
    sale_name: row.sale_name || null,
    sml_code: row.sml_code || null,
    customer_name: row.customer_name || null,
    village: row.village,
    village_name: row.village_name,
  };
}

function mapProjectDetailRow(row, { includeContracts = false } = {}) {
  const office = splitCoordinate(row.office_lg);
  const project = splitCoordinate(row.project_lg);

  return {
    approve_status: toNumber(row.approve_status),
    approver: row.approver,
    business_model_id: row.business_model_id,
    business_model_name: row.business_model_name,
    business_type_id: row.business_type_id,
    business_type_name: row.business_type_name,
    close_date: row.close_date,
    closer: row.closer,
    contractlist: includeContracts ? [] : null,
    coordinator: row.coordinator || null,
    created_at: row.created_at,
    date_register: row.date_register,
    district: row.district,
    district_name: row.district_name,
    id: row.id,
    image_gallery: row.image_url ? [row.image_url] : [],
    image_url: row.image_url || null,
    office_lg: row.office_lg || "",
    office_lat: office.lat,
    office_lng: office.lng,
    phone: row.phone || "",
    project_description: row.project_description || "",
    project_lg: row.project_lg || "",
    project_lat: project.lat,
    project_lng: project.lng,
    project_name: row.project_name,
    project_status: row.project_status || DEFAULT_PROJECT_STATUS,
    project_type: row.project_type || null,
    project_type_name: row.project_type_name || null,
    province: row.province,
    province_name: row.province_name,
    sale_code: row.sale_code || null,
    sale_name: row.sale_name || null,
    sml_code: row.sml_code || null,
    customer_name: row.customer_name || null,
    status: row.status_code ?? 0,
    status_code: row.status_code ?? 0,
    village: row.village,
    village_name: row.village_name,
  };
}

async function getContractData(contractNos) {
  if (!contractNos.length) {
    return {
      detailMap: new Map(),
      installmentMap: new Map(),
      attachmentMap: new Map(),
    };
  }

  const [detailResult, installmentResult, attachmentResult] = await Promise.all(
    [
      query(
        `
        SELECT contract_no, item_name, amount, paymentfrequency, averageperpayment
        FROM odg_projects_contract_detail
        WHERE contract_no = ANY($1::text[])
        ORDER BY roworder ASC
      `,
        [contractNos],
      ),
      query(
        `
        SELECT contract_no, installment_no, total_amount, items
        FROM odg_projects_item
        WHERE contract_no = ANY($1::text[])
        ORDER BY installment_no ASC
      `,
        [contractNos],
      ),
      query(
        `
        SELECT contract_no, file_name, file_path
        FROM odg_project_request_attachments
        WHERE contract_no = ANY($1::text[])
        ORDER BY uploaded_at ASC, id ASC
      `,
        [contractNos],
      ),
    ],
  );

  const detailMap = new Map();
  for (const row of detailResult.rows) {
    const list = detailMap.get(row.contract_no) || [];
    list.push({
      amount: toNumber(row.amount),
      averageperpayment: toNumber(row.averageperpayment),
      item_name: row.item_name,
      paymentfrequency: toNumber(row.paymentfrequency),
    });
    detailMap.set(row.contract_no, list);
  }

  const installmentMap = new Map();
  for (const row of installmentResult.rows) {
    const list = installmentMap.get(row.contract_no) || [];
    list.push({
      installment_no: toNumber(row.installment_no),
      total_amount: toNumber(row.total_amount),
      items: normalizeInstallmentItems(row.items),
    });
    installmentMap.set(row.contract_no, list);
  }

  const attachmentMap = new Map();
  for (const row of attachmentResult.rows) {
    const list = attachmentMap.get(row.contract_no) || [];
    list.push({
      file_name: row.file_name,
      file_path: String(row.file_path || "").replace(/^\/+/, ""),
    });
    attachmentMap.set(row.contract_no, list);
  }

  return {
    detailMap,
    installmentMap,
    attachmentMap,
  };
}

async function getContractsByProjectIds(projectIds) {
  if (!projectIds.length) return new Map();

  await ensureProjectContractCurrencyColumn();

  const contractResult = await query(
    `
      SELECT *
      FROM odg_projects_contract
      WHERE project_id = ANY($1::text[])
      ORDER BY created_at DESC, roworder DESC
    `,
    [projectIds],
  );

  const contractNos = contractResult.rows
    .map((row) => cleanText(row.contract_no))
    .filter(Boolean);
  const contractIds = contractResult.rows
    .map((row) => toNumber(row.roworder))
    .filter((roworder) => roworder > 0);
  const { detailMap, installmentMap, attachmentMap } =
    await getContractData(contractNos);
  const boqContractIdSet = new Set();
  const boqListByContract = new Map();

  if (contractIds.length > 0) {
    const boqResult = await query(
      `
        SELECT
          contract_id,
          doc_no,
          doc_date,
          approve_status
        FROM odg_projects_boq
        WHERE contract_id = ANY($1::int[])
        ORDER BY doc_no DESC
      `,
      [contractIds],
    );

    for (const row of boqResult.rows) {
      const cid = toNumber(row.contract_id);
      if (!cid) continue;
      boqContractIdSet.add(cid);
      const list = boqListByContract.get(cid) || [];
      list.push({
        doc_no: row.doc_no,
        doc_date: formatDateOnly(row.doc_date),
        approve_status: toNumber(row.approve_status),
      });
      boqListByContract.set(cid, list);
    }
  }

  const projectMap = new Map();
  for (const row of contractResult.rows) {
    const key = cleanText(row.project_id);
    const list = projectMap.get(key) || [];
    list.push(
      mapContractRow(
        row,
        detailMap,
        installmentMap,
        attachmentMap,
        boqContractIdSet,
        boqListByContract,
      ),
    );
    projectMap.set(key, list);
  }

  return projectMap;
}

async function getProjectContractSummaryMap(projectIds) {
  if (!projectIds.length) return new Map();

  const result = await query(
    `
      WITH boq_contracts AS (
        SELECT DISTINCT contract_id
        FROM odg_projects_boq
        WHERE contract_id IS NOT NULL
      ),
      boq_counts AS (
        SELECT project_id::text AS project_id, count(*)::int AS boq_count
        FROM odg_projects_boq
        WHERE project_id IS NOT NULL
        GROUP BY project_id::text
      )
      SELECT
        c.project_id,
        count(*)::int AS contract_count,
        count(*) FILTER (
          WHERE coalesce(c.approve_status_1, 0) = 1
        )::int AS approved_contract_count,
        count(*) FILTER (
          WHERE coalesce(c.approve_status_1, 0) <> 1
        )::int AS pending_contract_count,
        count(*) FILTER (
          WHERE coalesce(c.approve_status_1, 0) = 1
            AND greatest(
              coalesce(c.approve_status_2, 0),
              coalesce(c.acc_approve, 0)
            ) = 1
        )::int AS acc_approved_contract_count,
        count(*) FILTER (
          WHERE boq_contracts.contract_id IS NOT NULL
        )::int AS boq_contract_count,
        coalesce(max(boq_counts.boq_count), 0)::int AS boq_count
      FROM odg_projects_contract c
      LEFT JOIN boq_contracts
        ON boq_contracts.contract_id = c.roworder
      LEFT JOIN boq_counts
        ON boq_counts.project_id = c.project_id
      WHERE c.project_id = ANY($1::text[])
      GROUP BY c.project_id
    `,
    [projectIds],
  );

  const summaryMap = new Map();
  for (const row of result.rows) {
    summaryMap.set(cleanText(row.project_id), {
      contract_count: toNumber(row.contract_count),
      approved_contract_count: toNumber(row.approved_contract_count),
      pending_contract_count: toNumber(row.pending_contract_count),
      acc_approved_contract_count: toNumber(row.acc_approved_contract_count),
      boq_contract_count: toNumber(row.boq_contract_count),
      boq_count: toNumber(row.boq_count),
    });
  }

  return summaryMap;
}

async function getProjectQuotationSummaryMap(projectIds) {
  if (!projectIds.length) return new Map();

  // Cache the "does odg_quotation exist?" check. It's created lazily by
  // ensureQuotationSchema(); once it exists it doesn't get dropped, so a single
  // confirmation is good for the process lifetime.
  if (!quotationTableExistsPromise) {
    quotationTableExistsPromise = query(
      `SELECT to_regclass('public.odg_quotation') AS table_name`,
      [],
    )
      .then((res) => Boolean(res.rows[0]?.table_name))
      .catch((err) => {
        quotationTableExistsPromise = null;
        throw err;
      });
  }

  const exists = await quotationTableExistsPromise;
  if (!exists) {
    // Re-check next time in case the schema gets created later in the session.
    quotationTableExistsPromise = null;
    return new Map();
  }

  const result = await query(
    `
      SELECT
        project_id,
        count(*)::int AS quotation_count,
        count(*) FILTER (WHERE status = 'ອະນຸມັດແລ້ວ')::int AS approved_quotation_count
      FROM odg_quotation
      WHERE project_id = ANY($1::text[])
      GROUP BY project_id
    `,
    [projectIds],
  );

  const summaryMap = new Map();
  for (const row of result.rows) {
    summaryMap.set(cleanText(row.project_id), {
      quotation_count: toNumber(row.quotation_count),
      approved_quotation_count: toNumber(row.approved_quotation_count),
    });
  }

  return summaryMap;
}

async function getProjectStatusHistoryMap(projectIds) {
  if (!projectIds.length) return new Map();

  await ensureStatusHistoryTable();
  const result = await query(
    `
      SELECT project_id, field_name, old_value, new_value, changed_at, id
      FROM odg_project_status_history
      WHERE project_id = ANY($1::text[])
        AND field_name = 'project_status'
      ORDER BY changed_at ASC, id ASC
    `,
    [projectIds],
  );

  const historyMap = new Map();
  for (const row of result.rows) {
    const key = cleanText(row.project_id);
    const list = historyMap.get(key) || [];
    list.push(row);
    historyMap.set(key, list);
  }

  return historyMap;
}

async function attachProjectTiming(projects) {
  if (!Array.isArray(projects) || !projects.length) return projects;

  const historyMap = await getProjectStatusHistoryMap(
    projects.map((project) => cleanText(project.id)).filter(Boolean),
  );

  return projects.map((project) => ({
    ...project,
    ...buildProjectTiming(project, historyMap.get(cleanText(project.id)) || []),
  }));
}

export async function listProjects({ summary = false } = {}) {
  const result = await query(`${PROJECT_SELECT} ORDER BY p.id DESC`);
  const projectIds = result.rows.map((row) => String(row.id));
  // Run the dependent lookups concurrently instead of sequentially — on a
  // remote DB this turns 3 serial round-trips into 1.
  const [contractSummaryMap, quotationSummaryMap, contractMap] = await Promise.all([
    getProjectContractSummaryMap(projectIds),
    getProjectQuotationSummaryMap(projectIds),
    summary ? Promise.resolve(new Map()) : getContractsByProjectIds(projectIds),
  ]);

  const projects = result.rows.map((row) =>
    mapProjectSummaryRow(
      {
        ...row,
        ...(contractSummaryMap.get(String(row.id)) || {}),
        ...(quotationSummaryMap.get(String(row.id)) || {}),
      },
      summary ? null : contractMap.get(String(row.id)) || null,
    ),
  );

  return attachProjectTiming(projects);
}

export async function getProjectById(
  projectId,
  { includeContracts = false } = {},
) {
  const result = await query(`${PROJECT_SELECT} WHERE p.id = $1 LIMIT 1`, [
    projectId,
  ]);
  const row = result.rows[0];
  if (!row) return null;

  const project = mapProjectDetailRow(row, { includeContracts });
  if (includeContracts) {
    const contracts = await getContractsByProjectIds([String(projectId)]);
    project.contractlist = contracts.get(String(projectId)) || null;
  }

  const historyRows = await listProjectStatusHistory(String(projectId));
  Object.assign(project, buildProjectTiming(project, historyRows));

  return project;
}

export async function listSaleStaffs() {
  const result = await query(
    `
      SELECT code, name_1
      FROM biotime_employee
      WHERE coalesce(status, 0) = 0
        AND coalesce(trim(name_1), '') <> ''
        AND code ~ '^[0-9]+$'
        AND code NOT IN ('00000', '00001')
      ORDER BY name_1 ASC
    `,
  );

  return result.rows;
}

export async function listBusinessTypes() {
  const result = await query(
    `
      SELECT code, name_1
      FROM odg_project_business_type
      ORDER BY roworder ASC, code ASC
    `,
  );
  return result.rows;
}

export async function listBusinessModels(businessType) {
  const params = [];
  let where = "";

  if (cleanText(businessType)) {
    params.push(cleanText(businessType));
    where = `WHERE business_type_id = $${params.length}`;
  }

  const result = await query(
    `
      SELECT code, name_1
      FROM odg_project_business_model
      ${where}
      ORDER BY roworder ASC, code ASC
    `,
    params,
  );
  return result.rows;
}

export async function listProjectTypes({ businessType, businessModel }) {
  const params = [];
  const conditions = [];

  if (cleanText(businessType)) {
    params.push(cleanText(businessType));
    conditions.push(`business_type_id = $${params.length}`);
  }

  if (cleanText(businessModel)) {
    params.push(cleanText(businessModel));
    conditions.push(`business_model_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `
      SELECT code, name_1
      FROM odg_project_type
      ${where}
      ORDER BY roworder ASC, code ASC
    `,
    params,
  );
  return result.rows;
}

export async function listProvinces() {
  const result = await query(
    `
      SELECT code, name_1
      FROM erp_province
      ORDER BY code ASC
    `,
  );
  return result.rows;
}

export async function listDistricts(province) {
  const result = await query(
    `
      SELECT code, name_1
      FROM erp_amper
      WHERE province = $1
      ORDER BY code ASC
    `,
    [province],
  );
  return result.rows;
}

export async function listVillages({ province, district }) {
  const result = await query(
    `
      SELECT code, name_1
      FROM erp_tambon
      WHERE province = $1
        AND amper = $2
      ORDER BY code ASC
    `,
    [province, district],
  );
  return result.rows;
}

export async function updateProjectStage(projectId, payload) {
  const projectStatus =
    cleanOptionalText(payload.project_status) ||
    (typeof payload.status === "string"
      ? cleanOptionalText(payload.status)
      : null);
  const statusCode =
    typeof payload.status === "number" ||
    cleanText(payload.status).match(/^\d+$/)
      ? toNumber(payload.status, 0)
      : null;

  const updates = [];
  const params = [];

  if (projectStatus) {
    params.push(projectStatus);
    updates.push(`project_status = $${params.length}`);
  }

  if (statusCode !== null) {
    params.push(statusCode);
    updates.push(`status = $${params.length}`);
  }

  if (!updates.length) {
    return false;
  }

  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `
        SELECT id, project_status, status
        FROM odg_projects
        WHERE id = $1
        LIMIT 1
      `,
      [projectId],
    );

    const current = currentResult.rows[0];
    if (!current) return false;

    params.push(projectId);
    const result = await client.query(
      `
        UPDATE odg_projects
        SET ${updates.join(", ")}
        WHERE id = $${params.length}
      `,
      params,
    );

    if (!result.rowCount) return false;

    await insertStatusHistoryEntries(client, [
      projectStatus
        ? {
            projectId,
            entityType: "project",
            fieldName: "project_status",
            actionName: "project_status_updated",
            oldValue: current.project_status,
            newValue: projectStatus,
            changedBy: payload?.username,
          }
        : null,
      statusCode !== null
        ? {
            projectId,
            entityType: "project",
            fieldName: "status",
            actionName: "status_code_updated",
            oldValue: current.status,
            newValue: statusCode,
            changedBy: payload?.username,
          }
        : null,
    ]);

    return true;
  });
}

export async function updateProjectLocations(projectId, payload) {
  const office = buildCoordinate(payload.office_lat, payload.office_lng);
  const project = buildCoordinate(payload.project_lat, payload.project_lng);

  await query(
    `
      UPDATE odg_projects
      SET office_lg = $1,
          project_lg = $2
      WHERE id = $3
    `,
    [office, project, projectId],
  );
}

export async function updateProjectEdit(projectId, values) {
  const nextProjectStatus =
    cleanOptionalText(values.projectStatus) || DEFAULT_PROJECT_STATUS;
  const params = [
    cleanText(values.projectName),
    cleanOptionalText(values.projectDescription),
    cleanText(values.province),
    cleanText(values.district),
    cleanText(values.village),
    cleanOptionalText(values.coordinator),
    cleanOptionalText(values.coordinatorPhone),
    cleanOptionalText(values.imageUrl),
    cleanOptionalText(values.saleStaffId),
    cleanOptionalText(values.smlCode),
    cleanOptionalText(values.officeCoord),
    cleanOptionalText(values.projectCoord),
    cleanOptionalText(values.projectType),
    parseDateInput(values.registrationDate),
    cleanOptionalText(values.businessType),
    cleanOptionalText(values.businessModel),
    nextProjectStatus,
    projectId,
  ];

  await withTransaction(async (client) => {
    const currentResult = await client.query(
      `
        SELECT project_status
        FROM odg_projects
        WHERE id = $1
        LIMIT 1
      `,
      [projectId],
    );
    const current = currentResult.rows[0];

    await client.query(
      `
        UPDATE odg_projects
        SET project_name = $1,
            project_description = $2,
            province = $3,
            district = $4,
            village = $5,
            coordinator = $6,
            phone = $7,
            image_url = COALESCE($8, image_url),
            sale_code = $9,
            sml_code = $10,
            office_lg = $11,
            project_lg = $12,
            project_type = $13,
            date_register = $14,
            business_type_id = $15,
            business_model_id = $16,
            project_status = $17
        WHERE id = $18
      `,
      params,
    );

    await insertStatusHistoryEntries(client, [
      {
        projectId,
        entityType: "project",
        fieldName: "project_status",
        actionName: "project_edited",
        oldValue: current?.project_status,
        newValue: nextProjectStatus,
        changedBy: values?.username,
      },
    ]);
  });
}

export async function createProject(values) {
  const result = await query(
    `
      INSERT INTO odg_projects (
        project_name,
        project_description,
        province,
        district,
        village,
        coordinator,
        phone,
        image_url,
        sale_code,
        sml_code,
        office_lg,
        project_lg,
        project_type,
        created_at,
        status,
        project_status,
        approve_status,
        date_register,
        business_type_id,
        business_model_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, NOW(), 0, $14, 0, $15, $16, $17
      )
      RETURNING id
    `,
    [
      cleanText(values.projectName),
      cleanOptionalText(values.projectDescription),
      cleanText(values.province),
      cleanText(values.district),
      cleanText(values.village),
      cleanText(values.coordinator),
      cleanText(values.coordinatorPhone),
      cleanOptionalText(values.imageUrl),
      cleanOptionalText(values.saleStaffId),
      cleanOptionalText(values.smlCode),
      cleanOptionalText(values.officeCoord),
      cleanOptionalText(values.projectCoord),
      cleanOptionalText(values.projectType),
      cleanOptionalText(values.projectStatus) || DEFAULT_PROJECT_STATUS,
      parseDateInput(values.registrationDate),
      cleanOptionalText(values.businessType),
      cleanOptionalText(values.businessModel),
    ],
  );

  return result.rows[0]?.id || null;
}

export async function deleteProjectCascade(projectId) {
  await withTransaction(async (client) => {
    const projectIdNumber = toNumber(projectId);
    const contractResult = await client.query(
      `
        SELECT roworder, contract_no
        FROM odg_projects_contract
        WHERE project_id = $1
      `,
      [String(projectId)],
    );

    const contractIds = contractResult.rows
      .map((row) => toNumber(row.roworder))
      .filter((id) => id > 0);
    const contractNos = contractResult.rows
      .map((row) => cleanText(row.contract_no))
      .filter(Boolean);

    const boqResult = await client.query(
      `
        SELECT doc_no
        FROM odg_projects_boq
        WHERE contract_id = ANY($1::int[])
           OR project_id = $2
      `,
      [contractIds, String(projectId)],
    );
    const boqDocNos = boqResult.rows
      .map((row) => cleanText(row.doc_no))
      .filter(Boolean);

    if (boqDocNos.length) {
      await client.query(
        `
          DELETE FROM odg_projects_boq_detail
          WHERE doc_no = ANY($1::text[])
        `,
        [boqDocNos],
      );
    }

    await client.query(
      `
        DELETE FROM odg_projects_boq_detail
        WHERE contract_id = ANY($1::int[])
           OR ($2::int > 0 AND project_id = $2::int)
      `,
      [contractIds, projectIdNumber],
    );

    await client.query(
      `
        DELETE FROM odg_projects_boq
        WHERE contract_id = ANY($1::int[])
           OR project_id = $2
      `,
      [contractIds, String(projectId)],
    );

    if (contractNos.length) {
      await client.query(
        `
          DELETE FROM odg_project_request_attachments
          WHERE contract_no = ANY($1::text[])
        `,
        [contractNos],
      );
      await client.query(
        `
          DELETE FROM odg_projects_item
          WHERE contract_no = ANY($1::text[])
        `,
        [contractNos],
      );
      await client.query(
        `
          DELETE FROM odg_projects_contract_detail
          WHERE contract_no = ANY($1::text[])
        `,
        [contractNos],
      );
    }

    await client.query(
      `
        DELETE FROM odg_projects_contract
        WHERE project_id = $1
      `,
      [String(projectId)],
    );

    await client.query(
      `
        DELETE FROM odg_projects
        WHERE id = $1
      `,
      [projectId],
    );
  });
}

export async function deleteProjectContractCascade(projectId, contractNo) {
  const cleanProjectId = cleanText(projectId);
  const cleanContractNo = cleanText(contractNo);
  if (!cleanProjectId || !cleanContractNo) return null;

  return withTransaction(async (client) => {
    const contractResult = await client.query(
      `
        SELECT roworder, contract_no
        FROM odg_projects_contract
        WHERE project_id = $1
          AND contract_no = $2
        LIMIT 1
      `,
      [cleanProjectId, cleanContractNo],
    );

    const contract = contractResult.rows[0];
    if (!contract) return null;

    const contractId = toNumber(contract.roworder);
    const boqResult = await client.query(
      `
        SELECT doc_no
        FROM odg_projects_boq
        WHERE contract_id = $1
      `,
      [contractId],
    );
    const boqDocNos = boqResult.rows
      .map((row) => cleanText(row.doc_no))
      .filter(Boolean);

    if (boqDocNos.length) {
      await client.query(
        `
          DELETE FROM odg_projects_boq_detail
          WHERE doc_no = ANY($1::text[])
        `,
        [boqDocNos],
      );
    }

    await client.query(
      `
        DELETE FROM odg_projects_boq_detail
        WHERE contract_id = $1
      `,
      [contractId],
    );

    await client.query(
      `
        DELETE FROM odg_projects_boq
        WHERE contract_id = $1
      `,
      [contractId],
    );

    await client.query(
      `
        DELETE FROM odg_project_request_attachments
        WHERE contract_no = $1
      `,
      [cleanContractNo],
    );
    await client.query(
      `
        DELETE FROM odg_projects_item
        WHERE contract_no = $1
      `,
      [cleanContractNo],
    );
    await client.query(
      `
        DELETE FROM odg_projects_contract_detail
        WHERE contract_no = $1
      `,
      [cleanContractNo],
    );

    await client.query(
      `
        DELETE FROM odg_projects_contract
        WHERE project_id = $1
          AND contract_no = $2
      `,
      [cleanProjectId, cleanContractNo],
    );

    return {
      projectId: cleanProjectId,
      contractNo: cleanContractNo,
    };
  });
}

export async function listPendingProjectApprovals() {
  const contractResult = await query(
    `
      SELECT
        c.*,
        p.project_name,
        p.image_url,
        p.office_lg,
        p.project_lg,
        p.province,
        prov.name_1 AS province_name,
        p.district,
        dist.name_1 AS district_name,
        p.village,
        vill.name_1 AS village_name,
        sale.name_1 AS sale_name
      FROM odg_projects_contract c
      LEFT JOIN odg_projects p
        ON p.id::text = c.project_id
      LEFT JOIN erp_province prov
        ON prov.code = p.province
      LEFT JOIN erp_amper dist
        ON dist.code = p.district
       AND dist.province = p.province
      LEFT JOIN erp_tambon vill
        ON vill.code = p.village
       AND vill.amper = p.district
       AND vill.province = p.province
      LEFT JOIN biotime_employee sale
        ON sale.code = p.sale_code
      WHERE greatest(coalesce(c.approve_status_2, 0), coalesce(c.acc_approve, 0)) = 0
      ORDER BY c.created_at DESC, c.roworder DESC
    `,
  );

  const contractNos = contractResult.rows
    .map((row) => cleanText(row.contract_no))
    .filter(Boolean);
  const { detailMap, installmentMap, attachmentMap } =
    await getContractData(contractNos);

  return contractResult.rows.map((row) => {
    const contract = mapContractRow(
      row,
      detailMap,
      installmentMap,
      attachmentMap,
    );
    return {
      ...contract,
      amount: contract.amount,
      brand: contract.brand,
      contract_date: contract.contract_date,
      contract_detail: contract.contract_detail,
      contract_name: contract.contract_name,
      contract_no: contract.contract_no,
      cust_code: contract.cust_code,
      district: row.district,
      district_name: row.district_name,
      end_date: contract.end_date,
      estimated_date_start: contract.estimated_date_start,
      image_url: row.image_url,
      installment_schedule: contract.installment_schedule,
      office_lg: row.office_lg,
      p_status: contract.p_status,
      payment_type: contract.payment_type,
      project_id: cleanText(row.project_id),
      project_lg: row.project_lg,
      project_name: row.project_name,
      province_name: row.province_name,
      roworder: row.roworder,
      sale_name: row.sale_name,
      start_date: contract.start_date,
      total_amount: contract.amount,
      village: row.village,
      village_name: row.village_name,
      att_list: contract.att_list,
      items: contract.contract_detail,
    };
  });
}

export async function approveProjectRequest(
  projectId,
  { username, contractNo }: { username?: string; contractNo?: string } = {},
) {
  return withTransaction(async (client) => {
    const projectResult = await client.query(
      `
        SELECT project_status
        FROM odg_projects
        WHERE id = $1
        LIMIT 1
      `,
      [String(projectId)],
    );
    const previousProjectStatus = projectResult.rows[0]?.project_status ?? null;
    const params = [String(projectId)];
    const contractWhere = contractNo
      ? `AND contract_no = $${params.push(cleanText(contractNo))}`
      : "";

    const pendingResult = await client.query(
      `
        SELECT project_id, contract_no, approve_status_1
        FROM odg_projects_contract
        WHERE project_id = $1
          AND coalesce(approve_status_1, 0) = 0
          ${contractWhere}
      `,
      params,
    );

    if (!pendingResult.rowCount) return 0;

    const updateParams = [String(projectId), cleanOptionalText(username)];
    const updateContractWhere = contractNo
      ? `AND contract_no = $${updateParams.push(cleanText(contractNo))}`
      : "";

    const result = await client.query(
      `
        UPDATE odg_projects_contract
        SET approve_status_1 = 1,
            approver_1 = $2
        WHERE project_id = $1
          AND coalesce(approve_status_1, 0) = 0
          ${updateContractWhere}
        RETURNING roworder
      `,
      updateParams,
    );

    await client.query(
      `
        UPDATE odg_projects
        SET project_status = $2
        WHERE id = $1
      `,
      [String(projectId), READY_FOR_WITHDRAWAL_STATUS],
    );

    await insertStatusHistoryEntries(client, [
      ...pendingResult.rows.map((row) => ({
        projectId: cleanText(row.project_id || projectId),
        contractNo: cleanText(row.contract_no),
        entityType: "contract",
        fieldName: "approve_status_1",
        actionName: "sale_approval",
        oldValue: row.approve_status_1 ?? 0,
        newValue: 1,
        changedBy: username,
      })),
      {
        projectId: cleanText(projectId),
        entityType: "project",
        fieldName: "project_status",
        actionName: "sale_approval",
        oldValue: previousProjectStatus,
        newValue: READY_FOR_WITHDRAWAL_STATUS,
        changedBy: username,
      },
    ]);

    return result.rowCount;
  });
}

export async function approveAccounting(contractNo, { username, projectId }) {
  return withTransaction(async (client) => {
    const contractResult = await client.query(
      `
        SELECT project_id, contract_no, approve_status_2, acc_approve
        FROM odg_projects_contract
        WHERE contract_no = $1
        LIMIT 1
      `,
      [contractNo],
    );

    const currentContract = contractResult.rows[0];
    if (!currentContract) return 0;

    const resolvedProjectId = cleanText(
      projectId || currentContract.project_id,
    );
    let previousProjectStatus = null;

    if (resolvedProjectId) {
      const projectResult = await client.query(
        `
          SELECT project_status
          FROM odg_projects
          WHERE id = $1
          LIMIT 1
        `,
        [resolvedProjectId],
      );
      previousProjectStatus = projectResult.rows[0]?.project_status ?? null;
    }

    const result = await client.query(
      `
        UPDATE odg_projects_contract
        SET approve_status_2 = 1,
            approver_2 = $2,
            acc_approve = 1,
            acc_approver = $2
        WHERE contract_no = $1
        RETURNING project_id
      `,
      [contractNo, cleanOptionalText(username)],
    );

    if (resolvedProjectId) {
      await client.query(
        `
          UPDATE odg_projects
          SET project_status = $2
          WHERE id = $1
        `,
        [resolvedProjectId, READY_FOR_WITHDRAWAL_STATUS],
      );
    }

    await insertStatusHistoryEntries(client, [
      {
        projectId: resolvedProjectId || cleanText(currentContract.project_id),
        contractNo: cleanText(currentContract.contract_no || contractNo),
        entityType: "contract",
        fieldName: "approve_status_2",
        actionName: "accounting_approval",
        oldValue: currentContract.approve_status_2 ?? 0,
        newValue: 1,
        changedBy: username,
      },
      {
        projectId: resolvedProjectId || cleanText(currentContract.project_id),
        contractNo: cleanText(currentContract.contract_no || contractNo),
        entityType: "contract",
        fieldName: "acc_approve",
        actionName: "accounting_approval",
        oldValue: currentContract.acc_approve ?? 0,
        newValue: 1,
        changedBy: username,
      },
      resolvedProjectId
        ? {
            projectId: resolvedProjectId,
            contractNo: cleanText(currentContract.contract_no || contractNo),
            entityType: "project",
            fieldName: "project_status",
            actionName: "accounting_approval",
            oldValue: previousProjectStatus,
            newValue: READY_FOR_WITHDRAWAL_STATUS,
            changedBy: username,
          }
        : null,
    ]);

    return result.rowCount;
  });
}

export async function createProjectRequest(payload) {
  const projectId = cleanText(
    payload.existing_project_id || payload.project_id,
  );
  const contractNo = cleanText(payload.contract_no);

  return withTransaction(async (client) => {
    await ensureProjectContractCurrencyColumn(client);

    await client.query(
      `
        INSERT INTO odg_projects_contract (
          project_id,
          quotation_id,
          contract_name,
          contract_no,
          contract_date,
          estimated_date_start,
          cust_code,
          amount,
          currency_code,
          payment_type,
          brand,
          start_date,
          end_date,
          approve_status_1,
          approve_status_2,
          acc_approve,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NULL, 0, 0, 0, NOW()
        )
      `,
      [
        projectId,
        payload.quotation_id ? toNumber(payload.quotation_id) : null,
        cleanOptionalText(payload.contract_name),
        contractNo,
        parseDateInput(payload.contract_date),
        parseDateInput(payload.start_date),
        cleanOptionalText(payload.cust_code),
        toNumber(payload.total_amount),
        cleanOptionalText(payload.currency_code) || "LAK",
        cleanOptionalText(payload.sales_type),
        cleanOptionalText(payload.product_brand),
      ],
    );

    const productItems = Array.isArray(payload.product_items)
      ? payload.product_items
      : [];
    for (const item of productItems) {
      await client.query(
        `
          INSERT INTO odg_projects_contract_detail (
            project_id,
            contract_date,
            item_code,
            item_name,
            amount,
            paymentfrequency,
            averageperpayment,
            created_date_time_now,
            contract_no
          ) VALUES (
            $1, $2, NULL, $3, $4, $5, $6, NOW(), $7
          )
        `,
        [
          projectId,
          parseDateInput(payload.contract_date),
          cleanOptionalText(item.category_label || item.category),
          toNumber(item.value),
          toNumber(item.paymentFrequency || item.installments?.length || 1),
          toNumber(item.averagePerPayment),
          contractNo,
        ],
      );
    }

    const installmentSchedule = Array.isArray(payload.installment_schedule)
      ? payload.installment_schedule
      : [];

    for (const installment of installmentSchedule) {
      await client.query(
        `
          INSERT INTO odg_projects_item (
            project_id,
            contract_no,
            installment_no,
            total_amount,
            items,
            created_at
          ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        `,
        [
          toNumber(projectId),
          contractNo,
          toNumber(installment.installment_no),
          toNumber(installment.total || installment.total_amount),
          JSON.stringify(normalizeInstallmentItems(installment.items)),
        ],
      );
    }

    const attachments = Array.isArray(payload.attachments)
      ? payload.attachments
      : [];
    for (const attachment of attachments) {
      const filePath = await saveBase64File({
        base64: attachment.base64,
        fileName: attachment.fileName,
        relativeDir: "uploads/project_requests",
      });

      if (!filePath) continue;

      await client.query(
        `
          INSERT INTO odg_project_request_attachments (
            request_id,
            file_name,
            file_path,
            uploaded_at,
            contract_no
          ) VALUES ($1, $2, $3, NOW(), $4)
        `,
        [
          toNumber(projectId),
          cleanOptionalText(attachment.fileName),
          filePath.replace(/^\/+/, ""),
          contractNo,
        ],
      );
    }

    await client.query(
      `
        UPDATE odg_projects
        SET project_description = $1,
            sml_code = COALESCE($2, sml_code)
        WHERE id = $3
      `,
      [
        cleanOptionalText(payload.project_description),
        cleanOptionalText(payload.cust_code),
        projectId,
      ],
    );

    return {
      projectId,
      contractNo,
    };
  });
}

export async function listProjectStatusHistory(projectId) {
  await ensureStatusHistoryTable();
  const result = await query(
    `
      SELECT
        id,
        project_id,
        contract_no,
        entity_type,
        field_name,
        action_name,
        old_value,
        new_value,
        changed_by,
        note,
        extra_payload,
        changed_at
      FROM odg_project_status_history
      WHERE project_id = $1
      ORDER BY changed_at DESC, id DESC
    `,
    [cleanText(projectId)],
  );

  return result.rows;
}

export async function getDashboardStats() {
  const [
    projectStats,
    recentProjects,
    monthlyContracts,
    statusCounts,
    pendingContracts,
  ] = await Promise.all([
    query(
      `
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE project_status = 'ຂັ້ນຕອນດຳເນີນໂຄງການ')::int AS active,
          count(*) FILTER (WHERE project_status = 'ປິດໂຄງການ')::int AS completed
        FROM odg_projects
      `,
    ),
    query(
      `
        ${PROJECT_SELECT}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 5
      `,
    ),
    query(
      `
        SELECT
          count(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE))::int AS this_month,
          count(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE - interval '1 month'))::int AS last_month
        FROM odg_projects_contract
      `,
    ),
    query(
      `
        SELECT project_status, count(*)::int AS total
        FROM odg_projects
        GROUP BY project_status
      `,
    ),
    query(
      `
        SELECT count(*)::int AS pending
        FROM odg_projects_contract
        WHERE greatest(coalesce(approve_status_2, 0), coalesce(acc_approve, 0)) = 0
      `,
    ),
  ]);

  const byStatus = {};
  for (const row of statusCounts.rows || []) {
    byStatus[row.project_status || DEFAULT_PROJECT_STATUS] = toNumber(
      row.total,
    );
  }

  const pending = toNumber(pendingContracts.rows[0]?.pending);
  const thisMonth = toNumber(monthlyContracts.rows[0]?.this_month);
  const lastMonth = toNumber(monthlyContracts.rows[0]?.last_month);

  return {
    total: toNumber(projectStats.rows[0]?.total),
    active: toNumber(projectStats.rows[0]?.active),
    completed: toNumber(projectStats.rows[0]?.completed),
    pending,
    recent: recentProjects.rows.map((row) => mapProjectSummaryRow(row, null)),
    byStatus,
    performance: {
      thisMonth,
      lastMonth,
      growth:
        lastMonth > 0
          ? Number((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2))
          : 0,
    },
  };
}

export async function getRevenueStats() {
  const result = await query(
    `
      SELECT
        coalesce(sum(amount), 0) AS total,
        coalesce(sum(amount) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)), 0) AS monthly
      FROM odg_projects_contract
    `,
  );

  return {
    total: toNumber(result.rows[0]?.total),
    monthly: toNumber(result.rows[0]?.monthly),
  };
}

export async function getSalesStats() {
  const result = await query(
    `
      SELECT
        count(*)::int AS total_sales,
        count(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE))::int AS monthly_sales,
        count(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE - interval '1 month'))::int AS last_month_sales
      FROM odg_projects_contract
    `,
  );

  const monthlySales = toNumber(result.rows[0]?.monthly_sales);
  const lastMonthSales = toNumber(result.rows[0]?.last_month_sales);

  return {
    totalSales: toNumber(result.rows[0]?.total_sales),
    monthlySales,
    lastMonthSales,
    salesGrowth:
      lastMonthSales > 0
        ? Number(
            (((monthlySales - lastMonthSales) / lastMonthSales) * 100).toFixed(
              2,
            ),
          )
        : 0,
  };
}
