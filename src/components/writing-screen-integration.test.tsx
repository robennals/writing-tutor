import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { Essay, Message } from "@/lib/queries";

// ——— Mocks —————————————————————————————————————————————————————————————
//
// Notably we do NOT mock @ai-sdk/react or `ai` — this test exercises the
// real useChat + DefaultChatTransport path, intercepting the outbound POST
// to /api/chat so we can inspect exactly what body gets sent after an edit.

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
}));

// Swap the Tiptap-backed editor for a simple textarea. Callers drive edits
// through its onChange; we expose its value via a data-testid.
vi.mock("./editor", () => ({
  EssayEditor: ({
    content,
    onUpdate,
    editable,
  }: {
    content: string;
    onUpdate: (html: string, text: string) => void;
    editable: boolean;
  }) => {
    function stripHtml(h: string) {
      return h.replace(/<[^>]+>/g, "").trim();
    }
    return (
      <textarea
        data-testid="essay-editor"
        defaultValue={stripHtml(content)}
        disabled={!editable}
        onChange={(e) =>
          onUpdate(`<p>${e.target.value}</p>`, e.target.value)
        }
      />
    );
  },
}));

import { WritingScreen } from "./writing-screen";

function makeEssay(overrides: Partial<Essay> = {}): Essay {
  return {
    id: 42,
    title: "My cat Buffy",
    content: "<p>Buffy is my cat. She is very soft.</p>",
    brainstorm_notes: "",
    outline: "",
    writing_type: "opinion",
    level: 1,
    current_step: "review",
    active_tab: "draft",
    status: "in-progress",
    word_count: 7,
    created_at: "2026-01-01",
    updated_at: "2026-04-18",
    completed_at: null,
    ...overrides,
  };
}

interface ChatCall {
  url: string;
  body: Record<string, unknown>;
}

let chatCalls: ChatCall[];
let fetchSpy: ReturnType<typeof vi.fn>;

function makeEmptyStreamResponse() {
  // An empty AI SDK UI-message stream response is valid — useChat will just
  // see no chunks and finish. That's enough for our body-inspection test.
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    }
  );
}

beforeEach(() => {
  chatCalls = [];
  pushSpy.mockClear();
  fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/chat") {
      chatCalls.push({
        url,
        body: JSON.parse(init!.body as string),
      });
      return makeEmptyStreamResponse();
    }
    // /api/essays/:id PATCH (step/save) — benign 200.
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  // @ts-expect-error — override for observation.
  globalThis.fetch = fetchSpy;
});

describe("WritingScreen — body sent to /api/chat reflects the latest edit", () => {
  it("after the user edits the draft and clicks 'I've Made Changes!', the POST body contains the new content", async () => {
    const essay = makeEssay({ current_step: "review" });
    const priorMessages: Message[] = [
      {
        id: 1,
        essay_id: 42,
        role: "user",
        content: "Please check my writing!",
        step: "review",
        created_at: "2026-04-18T00:00:00Z",
      },
      {
        id: 2,
        essay_id: 42,
        role: "assistant",
        content:
          "I love Buffy! You have two complete sentences. Try adding one more!",
        step: "review",
        created_at: "2026-04-18T00:00:01Z",
      },
    ];

    render(
      <WritingScreen
        essay={essay}
        initialMessages={priorMessages}
        currentLevel={1}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );

    // Wait for initial render + greeting path (no greeting fires here because
    // initialMessages is non-empty), then drive an edit on the editor.
    const editor = screen.getByTestId("essay-editor") as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(editor, {
        target: {
          value: "Buffy is my cat. She is very soft. She loves tuna treats.",
        },
      });
    });

    // "I've Made Changes!" is visible because current_step is 'review'.
    // Let React commit the draftContent state update + the bodyStateRef
    // effect before we click.
    await act(async () => {
      await Promise.resolve();
    });

    const changesBtn = screen.getByRole("button", {
      name: /I've Made Changes/,
    });
    await act(async () => {
      fireEvent.click(changesBtn);
    });

    // Wait for the POST /api/chat to fire.
    await waitFor(() => expect(chatCalls.length).toBeGreaterThan(0));

    const body = chatCalls[chatCalls.length - 1].body;

    // The new sentence must be in the body's essayContent so the AI can see
    // the edit.
    expect(body.essayContent).toContain("tuna treats");

    // The step on a "made changes" submit must be `revise`, not `review`.
    // The revise prompt specifically tells the AI to re-read and check if
    // the suggestion was addressed; the review prompt doesn't — sending a
    // revise message with a review prompt causes the AI to say "I can't
    // see your changes" even though the new content is present.
    expect(body.currentStep).toBe("revise");

    // And sanity-check the accompanying fields so a future regression in how
    // state is marshalled doesn't slip through.
    expect(body.essayId).toBe(42);
    expect(body.writingType).toBe("opinion");
    expect(body.currentLevel).toBe(1);

    // Finally: the user's turn must appear in the messages array, ending
    // with the "I've made changes!" prompt. Prior messages seeded from the
    // DB should also be present.
    const messages = body.messages as Array<{
      role: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    expect(messages.length).toBeGreaterThanOrEqual(3);
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(
      lastMsg.parts?.find((p) => p.type === "text")?.text
    ).toMatch(/made changes/i);
  });

  it("'Check My Writing!' after an edit sends the new content with step=review", async () => {
    const essay = makeEssay({ current_step: "draft" });
    render(
      <WritingScreen
        essay={essay}
        initialMessages={[
          {
            id: 1,
            essay_id: 42,
            role: "assistant",
            content: "Nice start! Keep writing.",
            step: "draft",
            created_at: "2026-04-18T00:00:00Z",
          },
        ]}
        currentLevel={1}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );

    const editor = screen.getByTestId("essay-editor") as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(editor, {
        target: { value: "Brand new first draft with enough words." },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Check My Writing/ })
      );
    });
    await waitFor(() => expect(chatCalls.length).toBeGreaterThan(0));

    const body = chatCalls[chatCalls.length - 1].body;
    expect(body.essayContent).toContain("Brand new first draft");
    expect(body.currentStep).toBe("review");
    const messages = body.messages as Array<{
      role: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    expect(
      messages[messages.length - 1].parts?.find((p) => p.type === "text")?.text
    ).toMatch(/check my writing/i);
  });

  it("brainstorm-help sends the edited brainstorm notes in the body", async () => {
    const essay = makeEssay({
      current_step: "brainstorm",
      active_tab: "brainstorm",
      brainstorm_notes: "old notes",
    });
    render(
      <WritingScreen
        essay={essay}
        initialMessages={[
          {
            id: 1,
            essay_id: 42,
            role: "assistant",
            content: "What do you already know?",
            step: "brainstorm",
            created_at: "2026-04-18T00:00:00Z",
          },
        ]}
        currentLevel={11}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );

    // Find the brainstorm textarea by its placeholder copy.
    const brainstorm = screen.getByPlaceholderText(
      /bullet points/i
    ) as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(brainstorm, {
        target: { value: "Buffy chases squirrels. She purrs loudly." },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Help me brainstorm/ })
      );
    });
    await waitFor(() => expect(chatCalls.length).toBeGreaterThan(0));

    const body = chatCalls[chatCalls.length - 1].body;
    expect(body.brainstormNotes).toContain("chases squirrels");
    expect(body.activeTab).toBe("brainstorm");
    expect(body.currentStep).toBe("brainstorm");
  });

  it("outline-help sends the edited outline in the body", async () => {
    const essay = makeEssay({
      current_step: "organize",
      active_tab: "outline",
      outline: "1. intro",
    });
    render(
      <WritingScreen
        essay={essay}
        initialMessages={[
          {
            id: 1,
            essay_id: 42,
            role: "assistant",
            content: "What's your main idea?",
            step: "organize",
            created_at: "2026-04-18T00:00:00Z",
          },
        ]}
        currentLevel={13}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );

    const outline = screen.getByPlaceholderText(
      /First I'll write about/i
    ) as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(outline, {
        target: { value: "1. intro\n2. body about fur\n3. end" },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Help me plan/ })
      );
    });
    await waitFor(() => expect(chatCalls.length).toBeGreaterThan(0));

    const body = chatCalls[chatCalls.length - 1].body;
    expect(body.outline).toContain("body about fur");
    expect(body.activeTab).toBe("outline");
    expect(body.currentStep).toBe("organize");
  });

  it("chat input sends latest edited content as context", async () => {
    const essay = makeEssay({ current_step: "draft" });
    render(
      <WritingScreen
        essay={essay}
        initialMessages={[
          {
            id: 1,
            essay_id: 42,
            role: "assistant",
            content: "How's it going?",
            step: "draft",
            created_at: "2026-04-18T00:00:00Z",
          },
        ]}
        currentLevel={1}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );

    const editor = screen.getByTestId("essay-editor") as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(editor, {
        target: { value: "Cats are neat creatures who like tuna." },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    const chatBox = screen.getByPlaceholderText(/Ask me anything/);
    fireEvent.change(chatBox, { target: { value: "am I doing ok?" } });
    await act(async () => {
      fireEvent.keyDown(chatBox, { key: "Enter" });
    });
    await waitFor(() => expect(chatCalls.length).toBeGreaterThan(0));

    const body = chatCalls[chatCalls.length - 1].body;
    expect(body.essayContent).toContain("Cats are neat creatures");
    const messages = body.messages as Array<{
      role: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    expect(
      messages[messages.length - 1].parts?.find((p) => p.type === "text")?.text
    ).toBe("am I doing ok?");
  });
});
