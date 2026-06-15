"use server";

/**
 * Odoo-style scheduled Activities (to-dos) on document records — distinct from
 * the discussion/log timeline (chatter.ts). An activity has a type, an
 * assignee, a due date and a state (planned → done / cancelled). Marking one
 * done logs a line to the record's chatter timeline. Stored in the app-owned
 * public.odg_record_activities table.
 */
import { query } from "@/_lib/db";
import { cleanText } from "@/_lib/http";
import { getSessionUser } from "@/_lib/server-auth";
import { isManager } from "@/_lib/permissions";
import { logActivity } from "./chatter";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; message: string };
function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function fail(message: string): Fail { return { success: false, message }; }

const ENTITY_TYPES = ["project", "contract", "quotation", "boq", "request", "work_order"] as const;
const ACTIVITY_TYPES = ["todo", "call", "meeting", "email", "document"] as const;

export type Activity = {
  id: string;
  entity_type: string;
  entity_id: string;
  activity_type: string;
  summary: string | null;
  note: string | null;
  assignee_username: string | null;
  assignee_name: string | null;
  due_date: string | null;
  state: "planned" | "done" | "cancelled";
  created_by_name: string | null;
  created_at: string;
  done_at: string | null;
  done_by_name: string | null;
};

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS public.odg_record_activities (
          id                 bigserial PRIMARY KEY,
          entity_type        text NOT NULL,
          entity_id          text NOT NULL,
          activity_type      text NOT NULL DEFAULT 'todo',
          summary            text,
          note               text,
          assignee_username  text,
          assignee_name      text,
          due_date           date,
          state              text NOT NULL DEFAULT 'planned',
          created_by_username text,
          created_by_name    text,
          created_at         timestamptz NOT NULL DEFAULT now(),
          done_at            timestamptz,
          done_by_username   text,
          done_by_name       text
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_odg_activities_record ON public.odg_record_activities (entity_type, entity_id, state)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_odg_activities_assignee ON public.odg_record_activities (assignee_username, state, due_date)`);
      await query(`COMMENT ON TABLE public.odg_record_activities IS 'ODG Project Management (BOQ2026 v2) — scheduled activities / to-dos. App-owned; do not modify from ERP.'`);
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}

const COLS = `id::text, entity_type, entity_id, activity_type, summary, note,
  assignee_username, assignee_name, to_char(due_date, 'YYYY-MM-DD') AS due_date,
  state, created_by_name, created_at, done_at, done_by_name`;

function normType(t: unknown): string | null {
  const v = cleanText(t);
  return (ENTITY_TYPES as readonly string[]).includes(v) ? v : null;
}

/** Users that can be assigned an activity (any logged-in user may read this). */
export async function getAssignableUsers(): Promise<Ok<{ username: string; name: string }[]> | Fail> {
  try {
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const byName = new Map<string, { username: string; name: string }>();
    try {
      const v2 = await query(`SELECT username, name FROM odg_app_user WHERE active IS NOT FALSE ORDER BY username`);
      for (const r of v2.rows as any[]) byName.set(String(r.username), { username: String(r.username), name: r.name || r.username });
    } catch { /* table may not exist yet */ }
    try {
      const erp = await query(`SELECT username, name_1 FROM odg_project_manager_user ORDER BY username`);
      for (const r of erp.rows as any[]) {
        const u = String(r.username);
        if (!byName.has(u)) byName.set(u, { username: u, name: r.name_1 || u });
      }
    } catch { /* ERP unreachable */ }
    if (!byName.has(me.username)) byName.set(me.username, { username: me.username, name: me.name });
    return ok([...byName.values()]);
  } catch (e) { return fail((e as Error).message); }
}

/** Activities for one record (planned first by due date, then done). */
export async function getActivities(entityType: string, entityId: string): Promise<Ok<Activity[]> | Fail> {
  try {
    await ensureTable();
    const type = normType(entityType);
    const id = cleanText(entityId);
    if (!type || !id) return ok([]);
    const r = await query(
      `SELECT ${COLS} FROM public.odg_record_activities
        WHERE entity_type = $1 AND entity_id = $2 AND state <> 'cancelled'
        ORDER BY CASE state WHEN 'planned' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, id DESC
        LIMIT 200`,
      [type, id],
    );
    return ok(r.rows as Activity[]);
  } catch (e) { return fail((e as Error).message); }
}

export async function scheduleActivity(input: {
  entityType: string;
  entityId: string;
  activityType?: string;
  summary: string;
  note?: string;
  assigneeUsername?: string;
  assigneeName?: string;
  dueDate?: string;
}): Promise<Ok<Activity> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const type = normType(input.entityType);
    const id = cleanText(input.entityId);
    const summary = cleanText(input.summary);
    if (!type || !id) return fail("entity invalid");
    if (!summary) return fail("ກະລຸນາໃສ່ຫົວข้อกิจกรรม");
    const atype = (ACTIVITY_TYPES as readonly string[]).includes(cleanText(input.activityType)) ? cleanText(input.activityType) : "todo";
    const assigneeU = cleanText(input.assigneeUsername) || me.username;
    const assigneeN = cleanText(input.assigneeName) || me.name;
    const due = cleanText(input.dueDate) || null;
    const r = await query(
      `INSERT INTO public.odg_record_activities
         (entity_type, entity_id, activity_type, summary, note, assignee_username, assignee_name, due_date, created_by_username, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${COLS}`,
      [type, id, atype, summary, cleanText(input.note) || null, assigneeU, assigneeN, due, me.username, me.name],
    );
    return ok(r.rows[0] as Activity);
  } catch (e) { return fail((e as Error).message); }
}

/** Mark an activity done — records done metadata and logs it to the timeline. */
export async function markActivityDone(id: string | number): Promise<Ok<true> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    const r = await query(
      `UPDATE public.odg_record_activities
          SET state = 'done', done_at = now(), done_by_username = $2, done_by_name = $3
        WHERE id = $1 AND state = 'planned'
        RETURNING entity_type, entity_id, activity_type, summary`,
      [Number(id), me.username, me.name],
    );
    const row = r.rows[0];
    if (row) {
      await logActivity(String(row.entity_type), String(row.entity_id), "ເຮັດกิจกรรมສຳເລັດ", String(row.summary ?? ""));
    }
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}

/** Cancel (soft-delete) an activity — creator, assignee, or a manager. */
export async function cancelActivity(id: string | number): Promise<Ok<true> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return fail("ກະລຸນາເຂົ້າສູ່ລະບົບ");
    if (isManager(me)) {
      await query(`UPDATE public.odg_record_activities SET state = 'cancelled' WHERE id = $1`, [Number(id)]);
    } else {
      await query(
        `UPDATE public.odg_record_activities SET state = 'cancelled'
          WHERE id = $1 AND (created_by_username = $2 OR assignee_username = $2)`,
        [Number(id), me.username],
      );
    }
    return ok(true);
  } catch (e) { return fail((e as Error).message); }
}

/** Planned activities assigned to the current user (for the topbar badge). */
export async function getMyActivities(): Promise<Ok<Activity[]> | Fail> {
  try {
    await ensureTable();
    const me = await getSessionUser();
    if (!me) return ok([]);
    const r = await query(
      `SELECT ${COLS} FROM public.odg_record_activities
        WHERE assignee_username = $1 AND state = 'planned'
        ORDER BY due_date ASC NULLS LAST, id DESC
        LIMIT 100`,
      [me.username],
    );
    return ok(r.rows as Activity[]);
  } catch (e) { return fail((e as Error).message); }
}
