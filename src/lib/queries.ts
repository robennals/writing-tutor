import db from "./db";
import type { WritingType } from "./levels";

export interface SkillProgress {
  writing_type: WritingType;
  current_level: number;
  essays_completed_at_level: number;
  level_earned_at: string | null;
}

export interface Essay {
  id: number;
  title: string;
  content: string;
  brainstorm_notes: string;
  outline: string;
  writing_type: WritingType;
  level: number;
  current_step: string;
  active_tab: string;
  status: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Message {
  id: number;
  essay_id: number;
  role: string;
  content: string;
  step: string;
  created_at: string;
}

// libsql Row objects have non-serializable methods. Convert to plain objects
// so they can cross the Server Component → Client Component boundary.
function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export async function getSkillProgress(): Promise<SkillProgress[]> {
  // essays_completed_at_level is derived from the essays table (the source of
  // truth), not a stored counter — makes completion idempotent and heals any
  // drift between the two tables.
  const result = await db.execute(
    `SELECT sp.writing_type,
            sp.current_level,
            sp.level_earned_at,
            COALESCE(e.c, 0) AS essays_completed_at_level
     FROM skill_progress sp
     LEFT JOIN (
       SELECT writing_type, level, COUNT(*) AS c
       FROM essays
       WHERE status = 'completed'
       GROUP BY writing_type, level
     ) e ON e.writing_type = sp.writing_type AND e.level = sp.current_level
     WHERE sp.user_role = 'child'`
  );
  return result.rows.map((r) => toPlain<SkillProgress>(r));
}

export async function getEssays(): Promise<Essay[]> {
  const result = await db.execute(
    "SELECT * FROM essays ORDER BY updated_at DESC"
  );
  return result.rows.map((r) => toPlain<Essay>(r));
}

export async function getEssay(id: number): Promise<Essay | null> {
  const result = await db.execute({
    sql: "SELECT * FROM essays WHERE id = ?",
    args: [id],
  });
  if (!result.rows[0]) return null;
  return toPlain<Essay>(result.rows[0]);
}

export async function createEssay(
  title: string,
  writingType: WritingType,
  level: number
): Promise<number> {
  const result = await db.execute({
    sql: "INSERT INTO essays (title, writing_type, level, current_step, status) VALUES (?, ?, ?, 'brainstorm', 'in-progress')",
    args: [title, writingType, level],
  });
  return Number(result.lastInsertRowid);
}

export async function updateEssay(
  id: number,
  updates: Partial<
    Pick<
      Essay,
      | "title"
      | "content"
      | "brainstorm_notes"
      | "outline"
      | "current_step"
      | "active_tab"
      | "status"
      | "word_count"
      | "completed_at"
    >
  >
) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const args: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    sets.push(`${key} = ?`);
    args.push(value as string | number | null);
  }
  args.push(id);

  await db.execute({
    sql: `UPDATE essays SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function getMessages(essayId: number): Promise<Message[]> {
  const result = await db.execute({
    sql: "SELECT * FROM messages WHERE essay_id = ? ORDER BY created_at ASC",
    args: [essayId],
  });
  return result.rows.map((r) => toPlain<Message>(r));
}

export async function addMessage(
  essayId: number,
  role: string,
  content: string,
  step: string
) {
  await db.execute({
    sql: "INSERT INTO messages (essay_id, role, content, step) VALUES (?, ?, ?, ?)",
    args: [essayId, role, content, step],
  });
}

export async function getSettings(): Promise<Record<string, string>> {
  const result = await db.execute("SELECT * FROM settings");
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    const r = row as unknown as { key: string; value: string };
    settings[r.key] = r.value;
  }
  return settings;
}

export async function updateSetting(key: string, value: string) {
  await db.execute({
    sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    args: [key, value],
  });
}

/**
 * Atomically flips an essay from in-progress to completed. Returns true if
 * THIS call performed the transition. Used to ensure skill progress is only
 * incremented once even if the client double-submits the completion request.
 */
export async function completeEssayIfInProgress(id: number): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE essays
          SET status = 'completed',
              current_step = 'complete',
              completed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ? AND status != 'completed'`,
    args: [id],
  });
  return result.rowsAffected > 0;
}

/**
 * Idempotently recomputes the child's current level for a writing type from
 * the essays table (the source of truth). Returns whether the stored level
 * changed and the new level. Safe to call multiple times — counting essays
 * produces the same result regardless of how many times it runs.
 */
export async function recomputeSkillLevel(
  writingType: WritingType
): Promise<{ leveledUp: boolean; newLevel: number }> {
  const stored = await db.execute({
    sql: "SELECT current_level FROM skill_progress WHERE user_role = 'child' AND writing_type = ?",
    args: [writingType],
  });
  if (!stored.rows[0]) return { leveledUp: false, newLevel: 1 };
  const oldLevel = Number(
    (stored.rows[0] as unknown as { current_level: number }).current_level
  );

  const countsResult = await db.execute({
    sql: "SELECT level, COUNT(*) AS c FROM essays WHERE writing_type = ? AND status = 'completed' GROUP BY level",
    args: [writingType],
  });
  const countByLevel = new Map<number, number>();
  for (const row of countsResult.rows) {
    const r = row as unknown as { level: number; c: number };
    countByLevel.set(Number(r.level), Number(r.c));
  }

  const { LEVELS } = await import("./levels");
  let newLevel = 1;
  while (newLevel < LEVELS.length) {
    const needed = LEVELS[newLevel - 1].essaysToPass;
    const done = countByLevel.get(newLevel) ?? 0;
    if (done < needed) break;
    newLevel += 1;
  }

  if (newLevel !== oldLevel) {
    await db.execute({
      sql: "UPDATE skill_progress SET current_level = ?, level_earned_at = datetime('now') WHERE user_role = 'child' AND writing_type = ?",
      args: [newLevel, writingType],
    });
  }
  return { leveledUp: newLevel > oldLevel, newLevel };
}

export interface AgentCall {
  id: number;
  essay_id: number;
  current_step: string;
  request: unknown;
  response: unknown;
  created_at: string;
}

const RETENTION_DAYS = 30;

/**
 * Records the outgoing chat-route payload before streamText runs. Returns the
 * inserted row id so the caller can pair the response back via
 * recordAgentCallResponse. Swallows DB / JSON errors — logging must never
 * break the chat endpoint.
 */
export async function recordAgentCallRequest(
  essayId: number,
  currentStep: string,
  request: unknown
): Promise<number | null> {
  try {
    const json = JSON.stringify(request);
    // Piggyback prune: 30-day retention, no cron needed.
    await db.execute({
      sql: `DELETE FROM agent_calls WHERE created_at < datetime('now', ?)`,
      args: [`-${RETENTION_DAYS} days`],
    });
    const result = await db.execute({
      sql: `INSERT INTO agent_calls (essay_id, current_step, request_json) VALUES (?, ?, ?)`,
      args: [essayId, currentStep, json],
    });
    return Number(result.lastInsertRowid);
  } catch (err) {
    console.error("recordAgentCallRequest failed:", err);
    return null;
  }
}

/**
 * Updates the row created by recordAgentCallRequest with the assembled
 * assistant output ({ text, toolCalls }). No-op if `id` is null (the request
 * record failed) or the DB update throws — logging must never break the chat
 * endpoint.
 */
export async function recordAgentCallResponse(
  id: number | null,
  response: unknown
): Promise<void> {
  if (id == null) return;
  try {
    const json = JSON.stringify(response);
    await db.execute({
      sql: `UPDATE agent_calls SET response_json = ? WHERE id = ?`,
      args: [json, id],
    });
  } catch (err) {
    console.error("recordAgentCallResponse failed:", err);
  }
}

export async function getAgentCalls(essayId: number): Promise<AgentCall[]> {
  const result = await db.execute({
    sql: `SELECT id, essay_id, current_step, request_json, response_json, created_at
          FROM agent_calls
          WHERE essay_id = ?
          ORDER BY created_at ASC, id ASC`,
    args: [essayId],
  });
  return result.rows.map((row) => {
    const r = row as unknown as {
      id: number;
      essay_id: number;
      current_step: string;
      request_json: string;
      response_json: string;
      created_at: string;
    };
    return {
      id: Number(r.id),
      essay_id: Number(r.essay_id),
      current_step: r.current_step,
      request: r.request_json ? JSON.parse(r.request_json) : null,
      response: r.response_json ? JSON.parse(r.response_json) : {},
      created_at: r.created_at,
    };
  });
}

export async function flushAgentCalls(): Promise<number> {
  const result = await db.execute("DELETE FROM agent_calls");
  return result.rowsAffected;
}
