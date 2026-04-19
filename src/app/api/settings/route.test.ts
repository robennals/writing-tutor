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

describe("GET /api/settings", () => {
  it("returns 401 when there is no session", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the seeded settings for any logged-in user", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tts_essay).toBe("true");
  });
});

describe("POST /api/settings", () => {
  it("returns 401 for non-parent sessions (child can read, but not write)", async () => {
    harness.session.current = { role: "child", name: "Owen" };
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/settings", {
        key: "tts_essay",
        value: "false",
      })
    );
    expect(res.status).toBe(401);
  });

  it("upserts a setting when the parent writes", async () => {
    harness.session.current = { role: "parent", name: "Parent" };
    const { POST, GET } = await import("./route");

    await POST(
      jsonRequest("http://localhost/api/settings", {
        key: "tts_essay",
        value: "false",
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.tts_essay).toBe("false");
  });

  it("returns 401 when no session at all", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({ key: "x", value: "y" }),
      })
    );
    expect(res.status).toBe(401);
  });
});
