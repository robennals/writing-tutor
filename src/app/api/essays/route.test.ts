import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouteHarness, jsonRequest } from "@/test-utils/route-harness";

let harness: ReturnType<typeof createRouteHarness>;

beforeEach(() => {
  vi.resetModules();
  harness = createRouteHarness();
});

describe("GET /api/essays", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns [] when no essays exist and a session is present", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns existing essays", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { POST, GET } = await import("./route");

    await POST(
      jsonRequest("http://localhost/api/essays", {
        title: "First topic",
        writingType: "opinion",
      })
    );
    await POST(
      jsonRequest("http://localhost/api/essays", {
        title: "Second topic",
        writingType: "creative",
      })
    );

    const res = await GET();
    const body = (await res.json()) as Array<{ title: string }>;
    const titles = body.map((e) => e.title);
    expect(titles).toContain("First topic");
    expect(titles).toContain("Second topic");
  });
});

describe("POST /api/essays", () => {
  it("returns 401 for parents (only children create essays)", async () => {
    harness.session.current = { role: "parent", name: "Parent" };
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/essays", {
        title: "x",
        writingType: "opinion",
      })
    );
    expect(res.status).toBe(401);
  });

  it("creates an essay at the child's current level for that writing type", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/essays", {
        title: "My essay",
        writingType: "opinion",
      })
    );
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: number };
    expect(typeof id).toBe("number");

    const row = await harness.db.execute({
      sql: "SELECT title, writing_type, level FROM essays WHERE id = ?",
      args: [id],
    });
    expect(row.rows[0]).toMatchObject({
      title: "My essay",
      writing_type: "opinion",
      level: 1,
    });
  });
});
