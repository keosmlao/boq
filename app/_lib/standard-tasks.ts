import { query } from "@/_lib/db";
import { ensureProjectTaskSchema } from "@/_lib/schemas/tasks";

/**
 * Default standard installation checklist — used ONCE to seed the editable
 * `odg_std_install_task` table when it is empty. After that, the live list is
 * read from the table (managed via the ງານຕິດຕັ້ງມາດຕະຖານ page).
 */
export const STANDARD_INSTALL_TASKS: string[] = [
  "ติดตั้ง Support",
  "ติดตั้ง ท่อน้ำยา",
  "ติดตั้งสาย รีโมท",
  "อัดไนโตรเจน รอบที่ 1",
  "ติดตั้งท่อน้ำเสีย",
  "ติดตั้ง สายคอนโทรล",
  "ติดตั้ง กล่องควบคุม PID",
  "ติดตั้ง คอยล์ร้อน ( FCU )",
  "บานแพร่ ท่อน้ำยา",
  "ต่อสายไฟเข้า แผงเย็น",
  "อัดไนโตรเจน รอบที่ 2",
  "ติดตั้ง เซ็นเซอร์คอนโทรล",
  "ติดตั้ง แหล่งจ่าย ( CDU )",
  "ต่อท่อน้ำยาเข้า คอยล์ร้อน ( FCU - CDU )",
  "อัดไนโตรเจน รอบที่ 3",
];

const PHASE = "ຕິດຕັ້ງ";
const stdCode = (i: number) => `STD-${String(i + 1).padStart(2, "0")}`;

/** Editable master table for the standard installation checklist. */
let stdTableReady: Promise<void> | null = null;
export function ensureStdTaskTable(): Promise<void> {
  if (!stdTableReady) {
    stdTableReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_std_install_task (
          id         BIGSERIAL PRIMARY KEY,
          title      TEXT NOT NULL,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      // First run: seed the table from the defaults above.
      const c = await query(`SELECT COUNT(*)::int AS n FROM odg_std_install_task`);
      if (Number(c.rows[0]?.n ?? 0) === 0) {
        const values: unknown[] = [];
        const tuples: string[] = [];
        STANDARD_INSTALL_TASKS.forEach((title, i) => {
          const o = i * 2;
          tuples.push(`($${o + 1}, $${o + 2})`);
          values.push(title, i + 1);
        });
        await query(`INSERT INTO odg_std_install_task (title, sort_order) VALUES ${tuples.join(", ")}`, values);
      }
    })().catch((err) => {
      stdTableReady = null;
      throw err;
    });
  }
  return stdTableReady;
}

/** The live standard checklist titles, in order (from the editable table). */
export async function getStandardTaskTitles(): Promise<string[]> {
  await ensureStdTaskTable();
  const r = await query(`SELECT title FROM odg_std_install_task ORDER BY sort_order ASC, id ASC`);
  return (r.rows as { title: string }[]).map((x) => x.title).filter((t) => t && t.trim());
}

/**
 * Append the standard installation tasks to a project's plan — idempotent:
 * if the project already has STD-* tasks it does nothing. Existing manual tasks
 * are preserved; the standard set is appended after them in order.
 * Returns the number of tasks inserted (0 when already seeded).
 */
export async function seedStandardInstallTasks(projectId: string, contractId: string | null = null): Promise<number> {
  if (!projectId) return 0;
  await ensureProjectTaskSchema();

  const existing = await query(
    `SELECT 1 FROM odg_project_task WHERE project_id = $1 AND task_code LIKE 'STD-%' LIMIT 1`,
    [projectId],
  );
  if (existing.rows.length) return 0; // already seeded

  const titles = await getStandardTaskTitles();
  if (!titles.length) return 0;

  const maxRow = await query(
    `SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM odg_project_task WHERE project_id = $1`,
    [projectId],
  );
  const base = Number(maxRow.rows[0]?.m ?? 0);

  const values: unknown[] = [];
  const tuples: string[] = [];
  titles.forEach((title, i) => {
    const o = i * 6;
    tuples.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`);
    values.push(projectId, contractId, stdCode(i), title, PHASE, base + i + 1);
  });

  await query(
    `INSERT INTO odg_project_task (project_id, contract_id, task_code, title, phase, sort_order)
     VALUES ${tuples.join(", ")}`,
    values,
  );
  return titles.length;
}

/**
 * Apply the standard checklist to EVERY project (idempotent — projects that
 * already have STD-* tasks are skipped). Returns how many projects were seeded
 * and how many task rows were inserted in total.
 */
export async function backfillStandardInstallTasks(): Promise<{ projects: number; tasks: number }> {
  await ensureProjectTaskSchema();
  await ensureStdTaskTable();
  const r = await query(`SELECT id FROM odg_projects WHERE id IS NOT NULL`);
  let projects = 0;
  let tasks = 0;
  for (const row of r.rows as Array<{ id: unknown }>) {
    const n = await seedStandardInstallTasks(String(row.id), null);
    if (n > 0) {
      projects += 1;
      tasks += n;
    }
  }
  return { projects, tasks };
}
