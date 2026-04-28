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

describe("recordAgentCallRequest / recordAgentCallResponse / getAgentCalls", () => {
  it("recordAgentCallRequest inserts a row with the request JSON and returns its id", async () => {
    const { createEssay, recordAgentCallRequest, getAgentCalls } = await import(
      "./queries"
    );
    const essayId = await createEssay("t", "opinion", 1);

    const id = await recordAgentCallRequest(essayId, "draft", {
      model: "anthropic/claude-opus-4.7",
      messages: [{ role: "user", content: "hi" }],
      toolNames: ["markEssayReady"],
    });
    expect(id).toBeGreaterThan(0);

    const rows = await getAgentCalls(essayId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].current_step).toBe("draft");
    expect(rows[0].request).toEqual({
      model: "anthropic/claude-opus-4.7",
      messages: [{ role: "user", content: "hi" }],
      toolNames: ["markEssayReady"],
    });
    expect(rows[0].response).toEqual({});
  });

  it("recordAgentCallRequest swallows DB errors and returns null instead of throwing", async () => {
    const { recordAgentCallRequest } = await import("./queries");
    // Force a real failure by passing a payload that can't be JSON.stringified.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const id = await recordAgentCallRequest(1, "draft", cyclic);
    expect(id).toBeNull();
  });

  it("recordAgentCallRequest prunes rows older than 30 days on each insert", async () => {
    const { createEssay, recordAgentCallRequest, getAgentCalls } = await import(
      "./queries"
    );
    const essayId = await createEssay("t", "opinion", 1);

    // Seed an old row by hand.
    await db.execute({
      sql: `INSERT INTO agent_calls (essay_id, current_step, request_json, response_json, created_at)
            VALUES (?, 'draft', '{}', '{}', datetime('now', '-31 days'))`,
      args: [essayId],
    });

    expect((await getAgentCalls(essayId)).length).toBe(1);

    await recordAgentCallRequest(essayId, "draft", { ok: true });

    const rows = await getAgentCalls(essayId);
    expect(rows).toHaveLength(1); // old one pruned, new one kept
    expect(rows[0].request).toEqual({ ok: true });
  });

  it("recordAgentCallResponse updates the row's response_json", async () => {
    const {
      createEssay,
      recordAgentCallRequest,
      recordAgentCallResponse,
      getAgentCalls,
    } = await import("./queries");
    const essayId = await createEssay("t", "opinion", 1);
    const id = await recordAgentCallRequest(essayId, "draft", { ok: true });

    await recordAgentCallResponse(id, {
      text: "great job!",
      toolCalls: [{ name: "markEssayReady", input: { reason: "done" } }],
    });

    const rows = await getAgentCalls(essayId);
    expect(rows[0].response).toEqual({
      text: "great job!",
      toolCalls: [{ name: "markEssayReady", input: { reason: "done" } }],
    });
  });

  it("recordAgentCallResponse is a no-op when id is null (logging-failure path)", async () => {
    const { recordAgentCallResponse } = await import("./queries");
    // Should resolve cleanly without touching the DB or throwing.
    await expect(recordAgentCallResponse(null, { text: "x" })).resolves.toBeUndefined();
  });

  it("recordAgentCallResponse swallows JSON.stringify / DB errors", async () => {
    const { createEssay, recordAgentCallRequest, recordAgentCallResponse } =
      await import("./queries");
    const essayId = await createEssay("t", "opinion", 1);
    const id = await recordAgentCallRequest(essayId, "draft", {});

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    await expect(recordAgentCallResponse(id, cyclic)).resolves.toBeUndefined();
  });

  it("flushAgentCalls deletes all rows and returns the count", async () => {
    const { createEssay, recordAgentCallRequest, flushAgentCalls, getAgentCalls } =
      await import("./queries");
    const essayId = await createEssay("t", "opinion", 1);

    await recordAgentCallRequest(essayId, "draft", { a: 1 });
    await recordAgentCallRequest(essayId, "draft", { a: 2 });
    expect((await getAgentCalls(essayId)).length).toBe(2);

    const deleted = await flushAgentCalls();
    expect(deleted).toBe(2);
    expect((await getAgentCalls(essayId)).length).toBe(0);
  });
});
