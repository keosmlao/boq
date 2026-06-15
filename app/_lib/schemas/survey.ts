import { query } from "@/_lib/db";

let schemaReady: Promise<void> | null = null;

/**
 * Lazily creates the odg_survey table on first request (same pattern as
 * odg_quotation). Survey is pipeline stage 2 (ສຳຫຼວດ), between project
 * registration and quotation. Additive — never touches existing tables.
 */
export function ensureSurveySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(
        `
        CREATE TABLE IF NOT EXISTS odg_survey (
          id             BIGSERIAL PRIMARY KEY,
          project_id     TEXT,
          survey_date    DATE,
          surveyor       TEXT,
          status         TEXT DEFAULT 'done',
          findings       TEXT,
          data           JSONB DEFAULT '{}'::jsonb,
          created_at     TIMESTAMPTZ DEFAULT now(),
          updated_at     TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS odg_survey_project_id_idx ON odg_survey(project_id);
        CREATE INDEX IF NOT EXISTS odg_survey_created_idx     ON odg_survey(created_at DESC);
        `,
        [],
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
