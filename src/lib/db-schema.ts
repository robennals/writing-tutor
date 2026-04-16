import db from "./db";

export async function initializeDatabase() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS skill_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_role TEXT NOT NULL DEFAULT 'child',
        writing_type TEXT NOT NULL,
        current_level INTEGER NOT NULL DEFAULT 1,
        essays_completed_at_level INTEGER NOT NULL DEFAULT 0,
        level_earned_at TEXT,
        UNIQUE(user_role, writing_type)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS essays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        brainstorm_notes TEXT NOT NULL DEFAULT '',
        outline TEXT NOT NULL DEFAULT '',
        writing_type TEXT NOT NULL,
        level INTEGER NOT NULL,
        current_step TEXT NOT NULL DEFAULT 'topic',
        active_tab TEXT NOT NULL DEFAULT 'draft',
        status TEXT NOT NULL DEFAULT 'in-progress',
        word_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        essay_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        step TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (essay_id) REFERENCES essays(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      args: [],
    },
  ]);

  // Migrations: add columns that may not exist on older DBs. SQLite errors
  // on duplicate columns, so each ALTER is run independently.
  const migrations = [
    "ALTER TABLE essays ADD COLUMN brainstorm_notes TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE essays ADD COLUMN outline TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE essays ADD COLUMN active_tab TEXT NOT NULL DEFAULT 'draft'",
  ];
  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch (err) {
      // Column already exists — ignore
      const msg = (err as Error).message ?? "";
      if (!msg.includes("duplicate column")) throw err;
    }
  }

  // Seed default skill progress
  for (const type of ["opinion", "creative", "informational"]) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO skill_progress (user_role, writing_type, current_level, essays_completed_at_level) VALUES ('child', ?, 1, 0)`,
      args: [type],
    });
  }

  // Seed default settings
  for (const [key, value] of [
    ["tts_essay", "true"],
    ["tts_tutor", "true"],
    ["dyslexia_font", "false"],
  ]) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      args: [key, value],
    });
  }
}
