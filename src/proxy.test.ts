import { describe, it, expect, vi } from "vitest";

// NextResponse has platform-specific internals; stub to capture intent only.
vi.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    next: vi.fn(() => ({ kind: "next" })),
    redirect: vi.fn((url: URL) => ({ kind: "redirect", url: url.toString() })),
  },
}));

function makeRequest(
  pathname: string,
  { sessionCookie }: { sessionCookie?: string } = {}
) {
  return {
    nextUrl: { pathname },
    url: `http://localhost${pathname}`,
    cookies: {
      get: (name: string) =>
        name === "session" && sessionCookie !== undefined
          ? { value: sessionCookie }
          : undefined,
    },
  } as unknown as import("next/server").NextRequest;
}

describe("proxy()", () => {
  it("passes public routes through without a session cookie", async () => {
    const { default: proxy } = await import("./proxy");
    expect(proxy(makeRequest("/login"))).toEqual({ kind: "next" });
    expect(proxy(makeRequest("/api/auth/login"))).toEqual({ kind: "next" });
    expect(proxy(makeRequest("/api/admin/agent-log"))).toEqual({ kind: "next" });
    expect(proxy(makeRequest("/_next/static/foo.js"))).toEqual({
      kind: "next",
    });
    expect(proxy(makeRequest("/favicon.ico"))).toEqual({ kind: "next" });
  });

  it("redirects to /login when a protected route has no session cookie", async () => {
    const { default: proxy } = await import("./proxy");
    const res = proxy(makeRequest("/essays/1")) as unknown as {
      kind: string;
      url: string;
    };
    expect(res.kind).toBe("redirect");
    expect(res.url).toBe("http://localhost/login");
  });

  it("allows protected routes through when a session cookie is present", async () => {
    const { default: proxy } = await import("./proxy");
    expect(
      proxy(makeRequest("/essays/1", { sessionCookie: "anything" }))
    ).toEqual({ kind: "next" });
  });
});
