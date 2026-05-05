import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouteHarness, jsonRequest, buildRequest } from "@/test-utils/route-harness";

let harness: ReturnType<typeof createRouteHarness>;

async function seedEssay(): Promise<number> {
  const { initializeDatabase } = await import("@/lib/db-schema");
  await initializeDatabase();
  const { createEssay } = await import("@/lib/queries");
  return createEssay("My topic", "opinion", 1);
}

beforeEach(() => {
  vi.resetModules();
  harness = createRouteHarness();
});

describe("POST /api/essays/[id]/snapshots", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/x", { content: "<p>hi</p>" }),
      { params: Promise.resolve({ id: "1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for parents", async () => {
    harness.session.current = { role: "parent", name: "Parent" };
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/x", { content: "<p>hi</p>" }),
      { params: Promise.resolve({ id: "1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("inserts a snapshot for the child and returns its id", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay();
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/x", { content: "<p>v1</p>" }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; created_at: string };
    expect(typeof body.id).toBe("number");
    expect(typeof body.created_at).toBe("string");

    const row = await harness.db.execute({
      sql: "SELECT essay_id, content FROM essay_snapshots WHERE id = ?",
      args: [body.id],
    });
    expect(row.rows[0]).toMatchObject({ essay_id: id, content: "<p>v1</p>" });
  });
});

describe("GET /api/essays/[id]/snapshots", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/x", { method: "GET" }),
      { params: Promise.resolve({ id: "1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns snapshots for the essay in chronological order", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay();
    const { createSnapshot } = await import("@/lib/queries");
    const { id: a } = await createSnapshot(id, "<p>a</p>");
    const { id: b } = await createSnapshot(id, "<p>b</p>");
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/x", { method: "GET" }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      snapshots: Array<{ id: number; content: string; created_at: string }>;
    };
    expect(body.snapshots.map((s) => s.id)).toEqual([a, b]);
    expect(body.snapshots[0].content).toBe("<p>a</p>");
  });

  it("allows parents to read snapshots", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const id = await seedEssay();
    const { createSnapshot } = await import("@/lib/queries");
    await createSnapshot(id, "<p>a</p>");

    harness.session.current = { role: "parent", name: "Parent" };
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/x", { method: "GET" }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);
  });
});
