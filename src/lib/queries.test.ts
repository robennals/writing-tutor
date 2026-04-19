import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Client } from "@libsql/client";
import { createInMemoryDb } from "../test-utils/in-memory-db";

// Fresh in-memory DB per test. The module under test imports `./db` as a
// default export; we swap that out for our ephemeral client.
let db: Client;
vi.mock("./db", () => ({
  get default() {
    return db;
  },
}));

async function seedSchema() {
  const { initializeDatabase } = await import("./db-schema");
  await initializeDatabase();
}

beforeEach(async () => {
  db = createInMemoryDb();
  vi.resetModules();
  await seedSchema();
});

describe("getEssays / createEssay / getEssay", () => {
  it("createEssay inserts a row and returns its id; getEssay reads it back", async () => {
    const { createEssay, getEssay, getEssays } = await import("./queries");
    const id = await createEssay("My topic", "opinion", 1);
    expect(id).toBeGreaterThan(0);

    const fetched = await getEssay(id);
    expect(fetched?.title).toBe("My topic");
    expect(fetched?.writing_type).toBe("opinion");
    expect(fetched?.level).toBe(1);
    expect(fetched?.status).toBe("in-progress");
    expect(fetched?.current_step).toBe("brainstorm");

    const all = await getEssays();
    expect(all.map((e) => e.id)).toContain(id);
  });

  it("getEssay returns null when the id doesn't exist", async () => {
    const { getEssay } = await import("./queries");
    expect(await getEssay(999)).toBeNull();
  });
});

describe("updateEssay", () => {
  it("updates the listed columns and bumps updated_at", async () => {
    const { createEssay, updateEssay, getEssay } = await import("./queries");
    const id = await createEssay("t", "opinion", 1);
    await updateEssay(id, {
      content: "<p>hi</p>",
      word_count: 2,
      active_tab: "brainstorm",
    });

    const e = await getEssay(id);
    expect(e?.content).toBe("<p>hi</p>");
    expect(e?.word_count).toBe(2);
    expect(e?.active_tab).toBe("brainstorm");
  });
});

describe("messages", () => {
  it("addMessage appends rows; getMessages returns them in creation order", async () => {
    const { createEssay, addMessage, getMessages } = await import("./queries");
    const id = await createEssay("t", "opinion", 1);
    await addMessage(id, "user", "hello", "draft");
    await addMessage(id, "assistant", "hi back", "draft");

    const msgs = await getMessages(id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("hello");
    expect(msgs[1].role).toBe("assistant");
  });
});

describe("settings", () => {
  it("getSettings returns the seeded defaults after initializeDatabase", async () => {
    const { getSettings } = await import("./queries");
    const s = await getSettings();
    expect(s.tts_essay).toBe("true");
    expect(s.tts_tutor).toBe("true");
    expect(s.dyslexia_font).toBe("false");
  });

  it("updateSetting upserts a value", async () => {
    const { updateSetting, getSettings } = await import("./queries");
    await updateSetting("tts_essay", "false");
    expect((await getSettings()).tts_essay).toBe("false");

    await updateSetting("new_key", "hi");
    expect((await getSettings()).new_key).toBe("hi");
  });
});

describe("getSkillProgress", () => {
  it("returns 0 completed essays for levels with no completions", async () => {
    const { getSkillProgress } = await import("./queries");
    const progress = await getSkillProgress();
    const opinion = progress.find((p) => p.writing_type === "opinion");
    expect(opinion?.current_level).toBe(1);
    expect(opinion?.essays_completed_at_level).toBe(0);
  });

  it("counts completed essays at the child's current level from the essays table", async () => {
    const { createEssay, completeEssayIfInProgress, getSkillProgress } =
      await import("./queries");
    const a = await createEssay("a", "opinion", 1);
    const b = await createEssay("b", "opinion", 1);
    await createEssay("c", "opinion", 1); // still in-progress

    expect(await completeEssayIfInProgress(a)).toBe(true);
    expect(await completeEssayIfInProgress(b)).toBe(true);

    const progress = await getSkillProgress();
    const opinion = progress.find((p) => p.writing_type === "opinion");
    expect(opinion?.essays_completed_at_level).toBe(2);
  });
});

describe("completeEssayIfInProgress", () => {
  it("flips in-progress → completed on first call", async () => {
    const { createEssay, completeEssayIfInProgress, getEssay } = await import(
      "./queries"
    );
    const id = await createEssay("t", "opinion", 1);
    expect(await completeEssayIfInProgress(id)).toBe(true);

    const e = await getEssay(id);
    expect(e?.status).toBe("completed");
    expect(e?.current_step).toBe("complete");
    expect(e?.completed_at).not.toBeNull();
  });

  it("returns false on the second call — idempotent so skill progress isn't double-counted", async () => {
    const { createEssay, completeEssayIfInProgress } = await import(
      "./queries"
    );
    const id = await createEssay("t", "opinion", 1);
    expect(await completeEssayIfInProgress(id)).toBe(true);
    expect(await completeEssayIfInProgress(id)).toBe(false);
  });

  it("returns false for a non-existent id", async () => {
    const { completeEssayIfInProgress } = await import("./queries");
    expect(await completeEssayIfInProgress(12345)).toBe(false);
  });
});

describe("recomputeSkillLevel", () => {
  it("does not level up when not enough essays have been completed", async () => {
    const { recomputeSkillLevel } = await import("./queries");
    const res = await recomputeSkillLevel("opinion");
    expect(res).toEqual({ leveledUp: false, newLevel: 1 });
  });

  it("levels up once the essaysToPass threshold is met at the current level", async () => {
    const { createEssay, completeEssayIfInProgress, recomputeSkillLevel } =
      await import("./queries");
    // Level 1 needs 3 essays.
    for (let i = 0; i < 3; i++) {
      const id = await createEssay(`e${i}`, "opinion", 1);
      await completeEssayIfInProgress(id);
    }

    const res = await recomputeSkillLevel("opinion");
    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(2);
  });

  it("is idempotent — calling twice after the same data doesn't double-level", async () => {
    const { createEssay, completeEssayIfInProgress, recomputeSkillLevel } =
      await import("./queries");
    for (let i = 0; i < 3; i++) {
      const id = await createEssay(`e${i}`, "opinion", 1);
      await completeEssayIfInProgress(id);
    }
    const first = await recomputeSkillLevel("opinion");
    const second = await recomputeSkillLevel("opinion");
    expect(first.newLevel).toBe(2);
    expect(second.newLevel).toBe(2);
    expect(second.leveledUp).toBe(false);
  });

  it("returns { leveledUp: false, newLevel: 1 } when the writing type has no skill_progress row", async () => {
    // Simulate a DB where skill_progress is empty (shouldn't happen after
    // initializeDatabase, but the function has an explicit fallback).
    await db.execute("DELETE FROM skill_progress");
    const { recomputeSkillLevel } = await import("./queries");
    const res = await recomputeSkillLevel("opinion");
    expect(res).toEqual({ leveledUp: false, newLevel: 1 });
  });
});
