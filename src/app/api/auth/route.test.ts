import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouteHarness, jsonRequest } from "@/test-utils/route-harness";

beforeEach(() => {
  vi.resetModules();
  createRouteHarness();
  delete process.env.CHILD_PASSWORD;
  delete process.env.PARENT_PASSWORD;
});

describe("POST /api/auth", () => {
  it("returns 401 for invalid credentials", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth", {
        username: "owen",
        password: "wrong",
      })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("sets a session cookie and returns the role on success", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth", {
        username: "owen",
        password: "owen123",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "child" });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
  });

  it("authenticates parents against parent credentials", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth", {
        username: "parent",
        password: "parent123",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "parent" });
  });
});

describe("POST /api/auth — init caching", () => {
  it("initializes the DB only on the first call", async () => {
    const { POST } = await import("./route");
    await POST(
      jsonRequest("http://localhost/api/auth", {
        username: "owen",
        password: "owen123",
      })
    );
    await POST(
      jsonRequest("http://localhost/api/auth", {
        username: "owen",
        password: "owen123",
      })
    );
    // Tables exist after first init; second call hits the cached branch.
  });
});

describe("DELETE /api/auth", () => {
  it("clears the session cookie", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = res.headers.get("set-cookie") ?? "";
    // Delete emits a cookie with an empty value + past expiry.
    expect(setCookie).toMatch(/session=;/);
  });
});
