import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Same collaborator mocks as route.test.ts — EXCEPT we do NOT mock
// @/lib/prompts, so buildSystemPrompt runs for real. That lets us assert on
// the actual system prompt string Claude would receive.

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ role: "child", name: "Owen" })),
}));
vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: vi.fn(async () => {}),
}));
vi.mock("@/lib/queries", () => ({
  addMessage: vi.fn(async () => {}),
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

describe("POST /api/chat — system prompt reflects latest edit", () => {
  it("the real system prompt sent to streamText contains the CURRENT essay content and the 'revise' step instructions", async () => {
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
    const { system, messages } = streamTextSpy.mock.calls[0][0];

    // The draft's new third sentence must literally appear in the system
    // prompt — otherwise Claude can't see it.
    expect(system).toContain("She is snuggly");

    // The revise step's instruction must be in the prompt so Claude knows to
    // re-read (and not rely on the previous evaluation).
    expect(system).toContain("Current Step: REVISE");

    // The conversation history passed to Claude preserves the prior
    // evaluation so Claude has a baseline to compare against.
    const assistantText = messages
      .filter((m: { role: string }) => m.role === "assistant")
      .flatMap((m: { content: unknown }) =>
        Array.isArray(m.content) ? m.content : []
      )
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("\n");
    expect(assistantText).toContain("two complete sentences");
  });

  it("the 'revise' step prompt anchors the AI on the CURRENT draft and forbids 'I can't see your changes' hedges", async () => {
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

    const { system } = streamTextSpy.mock.calls[0][0];
    const lower = system.toLowerCase();

    // The prior failure: AI saw 3 sentences in the system prompt but
    // replied "I'm not seeing any new words in your draft yet — can you
    // save it?". These guards force the prompt to anchor Claude on the
    // CURRENT draft, tell it NOT to say that, and demand it quote a new
    // phrase so we know it actually read the updated essay.
    expect(lower).toContain("current");
    expect(lower).toMatch(/do not rely|don't rely/);
    expect(lower).toMatch(/never claim you can.?t see|do not say.*save/);
    expect(lower).toMatch(/quote/);
  });
});
