import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelMessage } from "ai";

const sessionRef: { current: { role: string; name: string } | null } = {
  current: { role: "child", name: "Owen" },
};
const addMessageSpy = vi.fn(async () => {});
const initializeDatabaseSpy = vi.fn(async () => {});

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => sessionRef.current),
}));
vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: initializeDatabaseSpy,
}));
vi.mock("@/lib/queries", () => ({
  addMessage: addMessageSpy,
}));
vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn(() => "SYSTEM"),
  buildContextMessage: vi.fn(() => "CONTEXT"),
}));

// Capture what streamText was called with. Re-export the real `tool` helper
// and `convertToModelMessages` so the route code keeps working.
const streamTextSpy = vi.fn();
let onFinishCallback: ((ev: { text: string }) => Promise<void>) | undefined;
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    streamText: (args: Parameters<typeof actual.streamText>[0]) => {
      streamTextSpy(args);
      onFinishCallback = args.onFinish as typeof onFinishCallback;
      return {
        toUIMessageStreamResponse: () => new Response("ok"),
      } as unknown as ReturnType<typeof actual.streamText>;
    },
  };
});

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const baseBody = (overrides: Record<string, unknown> = {}) => ({
  messages: [
    { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
  ],
  essayId: 1,
  essayContent: "x",
  essayTitle: "t",
  brainstormNotes: "",
  outline: "",
  activeTab: "draft",
  currentStep: "draft",
  writingType: "opinion",
  currentLevel: 1,
  ...overrides,
});

describe("POST /api/chat", () => {
  beforeEach(() => {
    streamTextSpy.mockClear();
    addMessageSpy.mockClear();
    initializeDatabaseSpy.mockClear();
    sessionRef.current = { role: "child", name: "Owen" };
    onFinishCallback = undefined;
  });

  it("returns 401 when there is no session", async () => {
    sessionRef.current = null;
    const { POST } = await import("./route");
    const res = await POST(buildRequest(baseBody()));
    expect(res.status).toBe(401);
    expect(streamTextSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when a non-child session hits this route", async () => {
    sessionRef.current = { role: "parent", name: "Parent" };
    const { POST } = await import("./route");
    const res = await POST(buildRequest(baseBody()));
    expect(res.status).toBe(401);
  });

  it("initializes the database on first call, and is cached on subsequent calls", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    await POST(buildRequest(baseBody()));
    // First call triggers init, second hits the cached branch.
    expect(initializeDatabaseSpy).toHaveBeenCalledTimes(1);
  });

  it("saves the user message to the DB before streaming", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    expect(addMessageSpy).toHaveBeenCalledWith(1, "user", "hello", "draft");
  });

  it("does NOT save an empty user message (extracted text is empty)", async () => {
    const { POST } = await import("./route");
    await POST(
      buildRequest(
        baseBody({
          messages: [{ id: "u1", role: "user", parts: [] }],
        })
      )
    );
    // user-save path skipped, but streamText still runs.
    expect(addMessageSpy).not.toHaveBeenCalled();
    expect(streamTextSpy).toHaveBeenCalledTimes(1);
  });

  it("persists the assistant's text via onFinish (ignoring empty text)", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    expect(onFinishCallback).toBeDefined();
    addMessageSpy.mockClear();

    await onFinishCallback!({ text: "great job!" });
    expect(addMessageSpy).toHaveBeenCalledWith(1, "assistant", "great job!", "draft");

    addMessageSpy.mockClear();
    await onFinishCallback!({ text: "" });
    expect(addMessageSpy).not.toHaveBeenCalled();
  });

  it("strips assistant tool-calls that never received a result, so Anthropic doesn't reject the turn", async () => {
    const { POST } = await import("./route");

    // A prior assistant turn that called `markEssayReady` (client-only tool,
    // no execute, no addToolResult) — state is stuck at `input-available`.
    const messages = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Please check my writing!" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Looks great! You can mark it complete." },
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: { reason: "all criteria met" },
          },
        ],
      },
      {
        id: "u2",
        role: "user",
        parts: [
          { type: "text", text: "I've made changes! Can you check again?" },
        ],
      },
    ];

    const res = await POST(
      buildRequest(baseBody({ messages, currentStep: "review" }))
    );
    expect(res.status).toBe(200);

    const modelMessages = streamTextSpy.mock.calls[0][0]
      .messages as ModelMessage[];

    const orphanToolCalls = modelMessages.flatMap((m) =>
      Array.isArray(m.content)
        ? m.content.filter((p: { type: string }) => p.type === "tool-call")
        : []
    );
    expect(orphanToolCalls).toEqual([]);

    const assistantText = modelMessages
      .filter((m) => m.role === "assistant")
      .flatMap((m) =>
        Array.isArray(m.content)
          ? m.content.filter(
              (p): p is { type: "text"; text: string } =>
                (p as { type: string }).type === "text"
            )
          : []
      )
      .map((p) => p.text)
      .join("");
    expect(assistantText).toContain("Looks great");
  });

  it("prepends the volatile context block (current draft) onto the final user turn sent to the model", async () => {
    // Core invariant: the contextBlock built by buildContextMessage — which
    // carries the student's CURRENT draft, tab, and step — must ride on the
    // last user turn so Claude evaluates the latest essay state, not stale
    // history. If this regresses the tutor reviews whatever draft was in
    // place the first time a conversation started.
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    const modelMessages = streamTextSpy.mock.calls[0][0]
      .messages as ModelMessage[];
    const last = modelMessages[modelMessages.length - 1];
    expect(last.role).toBe("user");
    // The prepended part is a "text" part whose text is exactly the
    // buildContextMessage return value (mocked to "CONTEXT" at module top).
    const parts = last.content as Array<{ type: string; text: string }>;
    expect(parts[0]).toEqual({ type: "text", text: "CONTEXT" });
    // And the student's original message is still there after the context.
    expect(parts.slice(1).some((p) => p.text === "hello")).toBe(true);
  });

  it("skips user-save when the last message is not a user message (assistant-only history)", async () => {
    const { POST } = await import("./route");
    await POST(
      buildRequest(
        baseBody({
          messages: [
            {
              id: "a1",
              role: "assistant",
              parts: [{ type: "text", text: "intro" }],
            },
          ],
        })
      )
    );
    expect(addMessageSpy).not.toHaveBeenCalled();
  });

  it("falls back to nullish-coalesced defaults when prompt fields are undefined", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
        ],
        essayId: 1,
        // Deliberately omit essayContent/essayTitle/brainstormNotes/outline —
        // they're all guarded by `?? ""` in the route.
        activeTab: "draft",
        currentStep: "draft",
        writingType: "opinion",
        currentLevel: 1,
      })
    );
    expect(res.status).toBe(200);
    expect(streamTextSpy).toHaveBeenCalledTimes(1);
  });

  it("declares the markEssayReady tool to streamText", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    const tools = streamTextSpy.mock.calls[0][0].tools ?? {};
    expect(Object.keys(tools)).toContain("markEssayReady");
  });
});
