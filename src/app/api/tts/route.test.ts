import { describe, it, expect, beforeEach, vi } from "vitest";

const sessionRef: { current: { role: string; name: string } | null } = {
  current: { role: "child", name: "Owen" },
};

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => sessionRef.current),
}));

let fetchSpy: ReturnType<typeof vi.fn>;

function buildRequest(body: string, signal?: AbortSignal) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  sessionRef.current = { role: "child", name: "Owen" };
  process.env.OPENAI_API_KEY = "sk-test";
  // Default: happy upstream response streams back as mp3.
  fetchSpy = vi.fn(async () =>
    new Response("MP3BYTES", {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    })
  );
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
});

describe("POST /api/tts", () => {
  it("returns 401 when there is no session", async () => {
    sessionRef.current = null;
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-child sessions (this endpoint is child-only)", async () => {
    sessionRef.current = { role: "parent", name: "Parent" };
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(401);
  });

  it("returns 500 when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "TTS is not configured" });
    spy.mockRestore();
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest("not-json{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 when text is missing or empty whitespace", async () => {
    const { POST } = await import("./route");
    const r1 = await POST(buildRequest(JSON.stringify({})));
    expect(r1.status).toBe(400);
    const r2 = await POST(buildRequest(JSON.stringify({ text: "   " })));
    expect(r2.status).toBe(400);
    const r3 = await POST(buildRequest(JSON.stringify({ text: 12 })));
    expect(r3.status).toBe(400);
  });

  it("returns 413 when text exceeds OpenAI's 4096-char limit", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest(JSON.stringify({ text: "a".repeat(4097) }))
    );
    expect(res.status).toBe(413);
  });

  it("forwards to OpenAI with the expected body + headers and streams the result back", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hello" })));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://api.openai.com/v1/audio/speech");
    const init = call[1] as RequestInit & { headers: Record<string, string> };
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toMatchObject({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: "hello",
      response_format: "mp3",
    });
  });

  it("returns 502 when OpenAI returns a non-OK response", async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () =>
      new Response("quota exceeded", { status: 429 })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "TTS upstream error" });
    spy.mockRestore();
  });

  it("falls back to empty detail when reading the upstream error body itself throws", async () => {
    // Return a response whose .text() rejects — covers the `.catch(() => "")`
    // defensive fallback in the error-detail read.
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      body: null,
      text: () => Promise.reject(new Error("body broken")),
    }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route");
    const res = await POST(buildRequest(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(502);
    spy.mockRestore();
  });
});
