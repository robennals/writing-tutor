import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ModelMessage } from "ai";

// Same collaborator mocks as route.test.ts — EXCEPT we do NOT mock
// @/lib/prompts, so buildSystemPrompt / buildContextMessage run for real.
// That lets us assert on the actual strings Claude would receive.

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ role: "child", name: "Owen" })),
}));
vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: vi.fn(async () => {}),
}));
vi.mock("@/lib/queries", () => ({
  addMessage: vi.fn(async () => {}),
  recordAgentCallRequest: vi.fn(async () => null as number | null),
  recordAgentCallResponse: vi.fn(async () => {}),
}));

const streamTextSpy = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    streamText: (args: Parameters<typeof actual.streamText>[0]) => {
      streamTextSpy(args);
      return {
        toUIMessageStreamResponse: () => new Response("ok"),
      } as unknown as ReturnType<typeof actual.streamText>;
    },
  };
});

function jsonPost(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  streamTextSpy.mockClear();
});

function findSystemMessage(messages: ModelMessage[]): ModelMessage {
  const sys = messages.find((m) => m.role === "system");
  if (!sys) throw new Error("no system message");
  return sys;
}

function collectText(messages: ModelMessage[], role: "user" | "assistant") {
  return messages
    .filter((m) => m.role === role)
    .flatMap((m) => {
      if (typeof m.content === "string") return [m.content];
      if (Array.isArray(m.content)) {
        return m.content
          .filter(
            (p): p is { type: "text"; text: string } =>
              (p as { type: string }).type === "text"
          )
          .map((p) => p.text);
      }
      return [];
    })
    .join("\n");
}

describe("POST /api/chat — system prompt is cached; volatile context is in messages", () => {
  it("the system message carries Anthropic cache_control so the stable prefix is cached", async () => {
    const { POST } = await import("./route");
    await POST(
      jsonPost({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
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
      })
    );

    const { messages } = streamTextSpy.mock.calls[0][0];
    const sys = findSystemMessage(messages);
    expect(sys.providerOptions?.anthropic?.cacheControl).toEqual({
      type: "ephemeral",
    });
  });

  it("the system prompt is byte-stable across users at the same level — prompt-caching invariant", async () => {
    // If the system prompt embedded volatile state (student name, essay
    // draft, current step/tab), caches would diverge per-user and prompt
    // caching would deliver ~no savings. This is the regression guard.
    const { POST } = await import("./route");

    await POST(
      jsonPost({
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
        ],
        essayId: 1,
        essayContent: "<p>Draft A — cat</p>",
        essayTitle: "Cat",
        brainstormNotes: "",
        outline: "",
        activeTab: "draft",
        currentStep: "draft",
        writingType: "opinion",
        currentLevel: 1,
      })
    );
    const sysA = findSystemMessage(streamTextSpy.mock.calls[0][0].messages);

    streamTextSpy.mockClear();
    await POST(
      jsonPost({
        messages: [
          { id: "u2", role: "user", parts: [{ type: "text", text: "yo" }] },
        ],
        essayId: 2,
        essayContent: "<p>Draft B — dog, pizza, thunder</p>",
        essayTitle: "Dog",
        brainstormNotes: "some notes",
        outline: "",
        activeTab: "draft",
        currentStep: "review",
        writingType: "opinion",
        currentLevel: 1,
      })
    );
    const sysB = findSystemMessage(streamTextSpy.mock.calls[0][0].messages);

    expect(sysB.content).toBe(sysA.content);
  });

  it("the CURRENT essay draft is delivered in the user message array, not the system prompt", async () => {
    const { POST } = await import("./route");
    await POST(
      jsonPost({
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Please check my writing!" }],
          },
          {
            id: "a1",
            role: "assistant",
            parts: [
              {
                type: "text",
                text: "You have two complete sentences — try adding one more!",
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
        ],
        essayId: 42,
        essayContent:
          "<p>I like my cat. My cat is called buffy. She is snuggly.</p>",
        essayTitle: "My cat Buffy",
        brainstormNotes: "",
        outline: "",
        activeTab: "draft",
        currentStep: "revise",
        writingType: "opinion",
        currentLevel: 1,
      })
    );

    expect(streamTextSpy).toHaveBeenCalledTimes(1);
    const { messages } = streamTextSpy.mock.calls[0][0];
    const sys = findSystemMessage(messages);

    // Essay content must NOT appear in the cached system prefix — that would
    // invalidate the cache on every keystroke.
    expect(sys.content).not.toContain("She is snuggly");

    // It DOES appear somewhere in the user message array — prepended to the
    // latest turn so Claude reads the current draft alongside the request.
    const userText = collectText(messages, "user");
    expect(userText).toContain("She is snuggly");
    expect(userText).toContain("Current Step:** REVISE");

    // Prior-turn assistant text is still passed through so Claude has a
    // baseline to compare against.
    const assistantText = collectText(messages, "assistant");
    expect(assistantText).toContain("two complete sentences");
  });

  it("the 'revise' step guidance lives in the cached system prompt as a reference, and the volatile context names the step — anti-hallucination anchor", async () => {
    const { POST } = await import("./route");
    await POST(
      jsonPost({
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "I've made changes!" }],
          },
        ],
        essayId: 1,
        essayContent: "<p>some draft.</p>",
        essayTitle: "t",
        brainstormNotes: "",
        outline: "",
        activeTab: "draft",
        currentStep: "revise",
        writingType: "opinion",
        currentLevel: 1,
      })
    );

    const { messages } = streamTextSpy.mock.calls[0][0];
    const sysContent = String(findSystemMessage(messages).content).toLowerCase();
    const userText = collectText(messages, "user").toLowerCase();

    // The revise-step guardrails still live in the system prompt (so they're
    // cached, not re-shipped every turn).
    expect(sysContent).toMatch(/do not rely|don't rely/);
    expect(sysContent).toMatch(/never claim you can.?t see|do not say.*save/);
    expect(sysContent).toMatch(/quote/);

    // The volatile context pins the current step so Claude picks the right
    // section of the system-prompt reference.
    expect(userText).toContain("current step:** revise");
  });
});
