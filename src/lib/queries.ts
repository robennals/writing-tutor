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
  const result = await db.execute(
    "SELECT * FROM skill_progress WHERE user_role = 'child'"
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

export async function incrementSkillProgress(
  writingType: WritingType
): Promise<{ leveledUp: boolean; newLevel: number }> {
  const result = await db.execute({
    sql: "SELECT * FROM skill_progress WHERE user_role = 'child' AND writing_type = ?",
    args: [writingType],
  });
  if (!result.rows[0]) return { leveledUp: false, newLevel: 1 };
  const progress = toPlain<SkillProgress>(result.rows[0]);

  const { getLevel } = await import("./levels");
  const levelDef = getLevel(progress.current_level);
  const newCount = progress.essays_completed_at_level + 1;

  if (newCount >= levelDef.essaysToPass && progress.current_level < 10) {
    // Level up!
    await db.execute({
      sql: "UPDATE skill_progress SET current_level = ?, essays_completed_at_level = 0, level_earned_at = datetime('now') WHERE user_role = 'child' AND writing_type = ?",
      args: [progress.current_level + 1, writingType],
    });
    return { leveledUp: true, newLevel: progress.current_level + 1 };
  } else {
    await db.execute({
      sql: "UPDATE skill_progress SET essays_completed_at_level = ? WHERE user_role = 'child' AND writing_type = ?",
      args: [newCount, writingType],
    });
    return { leveledUp: false, newLevel: progress.current_level };
  }
}
