import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRouteHarness,
  buildRequest,
  jsonRequest,
} from "@/test-utils/route-harness";

let harness: ReturnType<typeof createRouteHarness>;

beforeEach(() => {
  vi.resetModules();
  harness = createRouteHarness();
});

function paramsFor(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

async function seedEssay(title = "t", type = "opinion", level = 1) {
  const { initializeDatabase } = await import("@/lib/db-schema");
  await initializeDatabase();
  const res = await harness.db.execute({
    sql: "INSERT INTO essays (title, writing_type, level, current_step, status) VALUES (?, ?, ?, 'draft', 'in-progress')",
    args: [title, type, level],
  });
  return Number(res.lastInsertRowid);
}

describe("GET /api/essays/[id]", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/essays/1"),
      paramsFor(1)
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the essay doesn't exist", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/essays/999"),
      paramsFor(999)
    );
    expect(res.status).toBe(404);
  });

  it("returns the essay and its messages", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay();
    await harness.db.execute({
      sql: "INSERT INTO messages (essay_id, role, content, step) VALUES (?, 'user', 'hello', 'draft')",
      args: [id],
    });

    const { GET } = await import("./route");
    const res = await GET(
      buildRequest(`http://localhost/api/essays/${id}`),
      paramsFor(id)
    );
    const body = (await res.json()) as {
      essay: { id: number };
      messages: { content: string }[];
    };
    expect(body.essay.id).toBe(id);
    expect(body.messages[0].content).toBe("hello");
  });
});

describe("PATCH /api/essays/[id]", () => {
  it("returns 401 without a child session", async () => {
    harness.session.current = { role: "parent", name: "Parent" };
    const id = await seedEssay();
    const { PATCH } = await import("./route");
    const res = await PATCH(
      jsonRequest(`http://localhost/api/essays/${id}`, { content: "x" }),
      paramsFor(id)
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the essay doesn't exist", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    await seedEssay();
    const { PATCH } = await import("./route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/essays/999", { content: "x" }),
      paramsFor(999)
    );
    expect(res.status).toBe(404);
  });

  it("updates normal fields on the essay", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay();
    const { PATCH } = await import("./route");
    const res = await PATCH(
      jsonRequest(`http://localhost/api/essays/${id}`, {
        content: "<p>hi</p>",
        word_count: 1,
      }),
      paramsFor(id)
    );
    expect(res.status).toBe(200);
    const row = await harness.db.execute({
      sql: "SELECT content, word_count FROM essays WHERE id = ?",
      args: [id],
    });
    expect(row.rows[0]).toMatchObject({ content: "<p>hi</p>", word_count: 1 });
  });

  it("completes the essay idempotently when status=completed is sent", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay("x", "opinion", 1);
    const { PATCH } = await import("./route");

    // First completion: updates status; no level-up yet (needs 3 essays).
    const r1 = await PATCH(
      jsonRequest(`http://localhost/api/essays/${id}`, {
        status: "completed",
        current_step: "complete",
      }),
      paramsFor(id)
    );
    const b1 = (await r1.json()) as {
      ok: boolean;
      leveledUp: boolean;
      newLevel: number;
    };
    expect(b1).toEqual({ ok: true, leveledUp: false, newLevel: 1 });

    // Second completion (double-submit): level still doesn't inflate.
    const r2 = await PATCH(
      jsonRequest(`http://localhost/api/essays/${id}`, {
        status: "completed",
      }),
      paramsFor(id)
    );
    const b2 = (await r2.json()) as { leveledUp: boolean; newLevel: number };
    expect(b2.newLevel).toBe(1);
    expect(b2.leveledUp).toBe(false);
  });

  it("reports leveledUp: true when the child crosses the threshold on this completion", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    // Complete two essays directly (bypassing the route), then use the route
    // for the third so we see the leveledUp signal.
    await seedEssay("a", "opinion", 1);
    await seedEssay("b", "opinion", 1);
    const id = await seedEssay("c", "opinion", 1);
    await harness.db.execute(
      "UPDATE essays SET status='completed' WHERE id IN (SELECT id FROM essays WHERE status='in-progress' LIMIT 2)"
    );

    const { PATCH } = await import("./route");
    const res = await PATCH(
      jsonRequest(`http://localhost/api/essays/${id}`, {
        status: "completed",
      }),
      paramsFor(id)
    );
    const body = (await res.json()) as {
      leveledUp: boolean;
      newLevel: number;
    };
    expect(body.leveledUp).toBe(true);
    expect(body.newLevel).toBe(2);
  });
});
