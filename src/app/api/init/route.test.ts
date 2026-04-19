import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouteHarness } from "@/test-utils/route-harness";

let harness: ReturnType<typeof createRouteHarness>;

beforeEach(() => {
  vi.resetModules();
  harness = createRouteHarness();
});

describe("GET /api/init", () => {
  it("initializes the DB and returns { ok: true }", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // Tables exist after init.
    const tables = await harness.db.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    expect(tables.rows.length).toBeGreaterThan(0);
  });

  it("is safe to call multiple times (handler gates init with a module flag)", async () => {
    const { GET } = await import("./route");
    const r1 = await GET();
    const r2 = await GET();
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
