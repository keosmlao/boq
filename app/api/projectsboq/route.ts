export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { query } from "@/_lib/db";
import { ok, serverError, cleanText, isTruthyFlag } from "@/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const projectId = cleanText(params.get("project_id"));
    const summary = isTruthyFlag(params.get("summary"));
    const contracts = isTruthyFlag(params.get("contracts"));

    if (projectId) {
      const result = await query(
        `
        WITH boq_by_contract AS (
          SELECT
            contract_id,
            json_agg(
              json_build_object(
                'doc_no', doc_no,
                'doc_date', doc_date,
                'approve_status', approve_status
              )
              ORDER BY doc_no DESC
            ) AS boq_list
          FROM odg_projects_boq
          WHERE contract_id IS NOT NULL
          GROUP BY contract_id
        )
        SELECT
          p.*,
          pv.name_1 AS province_name,
          d.name_1 AS district_name,
          v.name_1 AS village_name,
          json_agg(
            json_build_object(
              'contract_no', c.contract_no,
              'contract_name', c.contract_name,
              'amount', c.amount,
              'contract_value', c.amount,
              'project_id', c.project_id,
              'cust_code', c.cust_code,
              'roworder', c.roworder,
              'contract_id', c.roworder,
              'approve_status_1', c.approve_status_1,
              'approve_status_2', c.approve_status_2,
              'acc_approve', c.acc_approve,
              'has_boq', b.contract_id IS NOT NULL,
              'boq_status', CASE WHEN b.contract_id IS NOT NULL THEN 'done' ELSE 'pending' END,
              'boq_list', COALESCE(b.boq_list, '[]'::json)
            )
            ORDER BY c.created_at DESC, c.roworder DESC
          ) FILTER (WHERE c.contract_no IS NOT NULL) AS contractlist
        FROM odg_projects p
        LEFT JOIN erp_province pv ON pv.code = p.province
        LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
        LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
        LEFT JOIN odg_projects_contract c ON c.project_id::int = p.id
        LEFT JOIN boq_by_contract b ON b.contract_id = c.roworder
        WHERE p.id = $1
        GROUP BY p.id, pv.name_1, d.name_1, v.name_1
        `,
        [projectId]
      );
      return ok({ data: result.rows });
    }

    if (contracts) {
      // Flat contract list joined with project info — drives the service-admin
      // BOQ workflow where each row is one contract (a project may own several).
      const result = await query(`
        WITH boq_contracts AS (
          SELECT DISTINCT contract_id
          FROM odg_projects_boq
          WHERE contract_id IS NOT NULL
        )
        SELECT
          c.contract_no,
          c.contract_name,
          c.amount,
          c.amount AS contract_value,
          c.cust_code,
          c.roworder,
          c.roworder AS contract_id,
          c.approve_status_1,
          c.approve_status_2,
          c.acc_approve,
          c.created_at AS contract_created_at,
          (bc.contract_id IS NOT NULL) AS has_boq,
          CASE WHEN bc.contract_id IS NOT NULL THEN 'done' ELSE 'pending' END AS boq_status,
          p.id AS project_id,
          p.project_name,
          p.sml_code,
          p.project_status,
          p.coordinator,
          p.phone,
          pv.name_1 AS province_name,
          d.name_1 AS district_name,
          v.name_1 AS village_name
        FROM odg_projects_contract c
        INNER JOIN odg_projects p ON p.id = c.project_id::int
        LEFT JOIN erp_province pv ON pv.code = p.province
        LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
        LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
        LEFT JOIN boq_contracts bc ON bc.contract_id = c.roworder
        WHERE p.project_status IN (
          'ຂັ້ນຕອນດຳເນີນໂຄງການ',
          'ສາມາດເບີກຂອງໃດ້',
          'ດຳເນີນການຕິດຕັ້ງ',
          'ລໍຖ້າອະນຸມັດປິດໂຄງການ'
        )
        ORDER BY p.id DESC, c.created_at DESC, c.roworder DESC
      `);
      return ok({ data: result.rows });
    }

    if (summary) {
      const result = await query(`
        WITH boq_contracts AS (
          SELECT DISTINCT contract_id
          FROM odg_projects_boq
          WHERE contract_id IS NOT NULL
        )
        SELECT
          p.id,
          p.project_name,
          p.sml_code,
          p.project_status,
          p.coordinator,
          p.phone,
          p.province,
          p.district,
          p.village,
          pv.name_1 AS province_name,
          d.name_1 AS district_name,
          v.name_1 AS village_name,
          COUNT(c.contract_no)::int AS contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
          )::int AS ready_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE NOT (
              COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
            )
          )::int AS waiting_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
              AND boq_contracts.contract_id IS NULL
          )::int AS waiting_boq_count,
          COUNT(c.contract_no) FILTER (
            WHERE boq_contracts.contract_id IS NOT NULL
          )::int AS boq_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE NOT (
              COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
            )
          ) > 0 AS waiting_contract,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
              AND boq_contracts.contract_id IS NULL
          ) > 0 AS waiting_boq,
          COUNT(c.contract_no) FILTER (
            WHERE boq_contracts.contract_id IS NOT NULL
          ) > 0 AS has_boq
        FROM odg_projects p
        LEFT JOIN erp_province pv ON pv.code = p.province
        LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
        LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
        LEFT JOIN odg_projects_contract c ON c.project_id::int = p.id
        LEFT JOIN boq_contracts ON boq_contracts.contract_id = c.roworder
        WHERE p.project_status IN (
          'ຂັ້ນຕອນດຳເນີນໂຄງການ',
          'ສາມາດເບີກຂອງໃດ້',
          'ດຳເນີນການຕິດຕັ້ງ',
          'ລໍຖ້າອະນຸມັດປິດໂຄງການ'
        )
        GROUP BY p.id, pv.name_1, d.name_1, v.name_1
        ORDER BY p.id DESC
      `);
      return ok({ data: result.rows });
    }

    const result = await query(`
      SELECT p.*, pv.name_1 AS province_name, d.name_1 AS district_name, v.name_1 AS village_name
      FROM odg_projects p
      LEFT JOIN erp_province pv ON pv.code = p.province
      LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
      LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
      ORDER BY p.id DESC
    `);
    return ok({ data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}
