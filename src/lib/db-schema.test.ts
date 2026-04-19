import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Client } from "@libsql/client";
import { createInMemoryDb } from "../test-utils/in-memory-db";

let db: Client;
vi.mock("./db", () => ({
  get default() {
    return db;
  },
}));

beforeEach(() => {
  db = createInMemoryDb();
  vi.resetModules();
});

describe("initializeDatabase", () => {
  it("creates the four tables used by the app", async () => {
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();

    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const names = tables.rows.map(
      (r) => (r as unknown as { name: string }).name
    );
    expect(names).toContain("skill_progress");
    expect(names).toContain("essays");
    expect(names).toContain("messages");
    expect(names).toContain("settings");
  });

  it("seeds one skill_progress row per writing type", async () => {
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();

    const rows = await db.execute(
      "SELECT writing_type FROM skill_progress ORDER BY writing_type"
    );
    const types = rows.rows.map(
      (r) => (r as unknown as { writing_type: string }).writing_type
    );
    expect(types).toEqual(["creative", "informational", "opinion"]);
  });

  it("seeds default settings (tts_essay, tts_tutor, dyslexia_font)", async () => {
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();

    const rows = await db.execute("SELECT key, value FROM settings");
    const map = new Map(
      rows.rows.map((r) => {
        const row = r as unknown as { key: string; value: string };
        return [row.key, row.value] as const;
      })
    );
    expect(map.get("tts_essay")).toBe("true");
    expect(map.get("tts_tutor")).toBe("true");
    expect(map.get("dyslexia_font")).toBe("false");
  });

  it("is idempotent — running twice doesn't duplicate seed rows or throw on 'duplicate column'", async () => {
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();
    await initializeDatabase();

    const rows = await db.execute("SELECT COUNT(*) AS c FROM skill_progress");
    const count = Number(
      (rows.rows[0] as unknown as { c: number }).c
    );
    expect(count).toBe(3);
  });

  it("handles migration errors with an undefined message (defaults to empty string, then rethrows)", async () => {
    db = {
      batch: async () => {},
      execute: vi.fn(async (sql: unknown) => {
        const s = typeof sql === "string" ? sql : (sql as { sql: string }).sql;
        if (s.startsWith("ALTER TABLE")) {
          // Throw something with no `.message` so the `?? ""` fallback fires.
          throw Object.assign(new Error(), { message: undefined });
        }
        return { rows: [] };
      }),
    } as unknown as Client;

    const { initializeDatabase } = await import("./db-schema");
    // An empty message doesn't include "duplicate column", so it rethrows.
    await expect(initializeDatabase()).rejects.toBeDefined();
  });

  it("rethrows non-duplicate-column errors from ALTER TABLE migrations", async () => {
    // Replace the shared mocked db with one that throws a non-duplicate error
    // for ALTER statements — covers the rethrow branch of the migration loop.
    db = {
      batch: async () => {},
      execute: vi.fn(async (sql: unknown) => {
        const s = typeof sql === "string" ? sql : (sql as { sql: string }).sql;
        if (s.startsWith("ALTER TABLE")) {
          throw new Error("table locked: some other error");
        }
        return { rows: [] };
      }),
    } as unknown as Client;

    const { initializeDatabase } = await import("./db-schema");
    await expect(initializeDatabase()).rejects.toThrow(/table locked/);
  });

  it("heals drift: recomputeSkillLevel snaps current_level to the essay count, even if stored value was inflated", async () => {
    // Simulate a pre-existing inflated level by seeding data BEFORE running
    // initializeDatabase's healing pass.
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();

    // Manually inflate level without the matching essays.
    await db.execute(
      "UPDATE skill_progress SET current_level = 5 WHERE writing_type = 'opinion'"
    );

    // Re-running initializeDatabase should call recomputeSkillLevel and snap
    // level back to 1 since zero essays are completed.
    await initializeDatabase();

    const row = await db.execute(
      "SELECT current_level FROM skill_progress WHERE writing_type = 'opinion'"
    );
    const level = Number(
      (row.rows[0] as unknown as { current_level: number }).current_level
    );
    expect(level).toBe(1);
  });
});
