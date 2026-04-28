import { describe, it, expect, beforeEach, vi } from "vitest";

const initializeDatabaseSpy = vi.fn(async () => {});
const getAgentCallsSpy = vi.fn(async () => [] as unknown[]);
const flushAgentCallsSpy = vi.fn(async () => 0);

vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: initializeDatabaseSpy,
}));
vi.mock("@/lib/queries", () => ({
  getAgentCalls: getAgentCallsSpy,
  flushAgentCalls: flushAgentCallsSpy,
}));

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as import("next/server").NextRequest;
}

describe("GET /api/admin/agent-log", () => {
  beforeEach(() => {
    initializeDatabaseSpy.mockClear();
    getAgentCallsSpy.mockClear();
    flushAgentCallsSpy.mockClear();
    vi.resetModules();
    delete process.env.ADMIN_LOG_KEY;
  });

  it("returns 503 when ADMIN_LOG_KEY is not configured", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
        headers: { "x-admin-key": "anything" },
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when the supplied key has the wrong length", async () => {
    // Length mismatch is rejected before timingSafeEqual runs.
    process.env.ADMIN_LOG_KEY = "correct";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
        headers: { "x-admin-key": "wrong-key" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when no header is supplied", async () => {
    process.env.ADMIN_LOG_KEY = "right-key";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when essayId is missing or non-numeric", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    const { GET } = await import("./route");

    const noQuery = await GET(
      buildRequest("http://localhost/api/admin/agent-log", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(noQuery.status).toBe(400);

    const badQuery = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=abc", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(badQuery.status).toBe(400);
  });

  it("returns 401 when a wrong key of the same length goes through timingSafeEqual", async () => {
    // Same-length keys reach timingSafeEqual; this exercises the false branch.
    process.env.ADMIN_LOG_KEY = "right-key";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
        headers: { "x-admin-key": "wrong-key" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("does not re-initialize the DB on subsequent requests", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    getAgentCallsSpy.mockResolvedValue([]);
    const { GET } = await import("./route");
    const req = buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
      headers: { "x-admin-key": "k" },
    });
    await GET(req);
    await GET(req);
    expect(initializeDatabaseSpy).toHaveBeenCalledTimes(1);
  });

  it("returns the rows from getAgentCalls when the key is correct", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    getAgentCallsSpy.mockResolvedValue([
      {
        id: 1,
        essay_id: 7,
        current_step: "draft",
        request: { model: "x" },
        response: { text: "hi" },
        created_at: "2026-04-27 12:00:00",
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=7", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(getAgentCallsSpy).toHaveBeenCalledWith(7);
    expect(body).toHaveLength(1);
    expect(body[0].request.model).toBe("x");
  });
});
