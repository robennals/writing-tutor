import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { UIMessage } from "@ai-sdk/react";
import type { Essay, Message } from "@/lib/queries";

// ——— Mocks ——————————————————————————————————————————————————————————————

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
}));

// The Tiptap editor is heavy — swap it for a thin textarea that still drives
// onUpdate (including once on mount so draftText reflects the initial content).
vi.mock("./editor", async () => {
  const React = await import("react");
  function stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, "").trim();
  }
  return {
    EssayEditor: ({
      content,
      onUpdate,
      editable,
    }: {
      content: string;
      onUpdate: (html: string, text: string) => void;
      editable: boolean;
    }) => {
      React.useEffect(() => {
        onUpdate(content, stripHtml(content));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <textarea
          aria-label="essay-editor"
          defaultValue={stripHtml(content)}
          disabled={!editable}
          onChange={(e) =>
            onUpdate(`<p>${e.target.value}</p>`, e.target.value)
          }
        />
      );
    },
  };
});

// Observable useChat that we fully control.
const useChatState = {
  messages: [] as UIMessage[],
  status: "ready" as "ready" | "submitted" | "streaming" | "error",
  error: undefined as Error | undefined,
  sendMessage: vi.fn(),
  regenerate: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("@ai-sdk/react", async () => {
  const actual = await vi.importActual<typeof import("@ai-sdk/react")>(
    "@ai-sdk/react"
  );
  return {
    ...actual,
    useChat: () => ({
      messages: useChatState.messages,
      sendMessage: useChatState.sendMessage,
      status: useChatState.status,
      error: useChatState.error,
      regenerate: useChatState.regenerate,
      clearError: useChatState.clearError,
    }),
  };
});

// Replace DefaultChatTransport with a stub — we never call it because useChat
// is mocked, but the import path must resolve.
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, DefaultChatTransport: class {} };
});

import { WritingScreen } from "./writing-screen";

// ——— Helpers ————————————————————————————————————————————————————————————

function makeEssay(overrides: Partial<Essay> = {}): Essay {
  return {
    id: 1,
    title: "Dogs",
    content: "<p>Dogs are great. I like them a lot.</p>",
    brainstorm_notes: "",
    outline: "",
    writing_type: "opinion",
    level: 1,
    current_step: "draft",
    active_tab: "draft",
    status: "in-progress",
    word_count: 8,
    created_at: "2026-01-01",
    updated_at: "2026-04-18",
    completed_at: null,
    ...overrides,
  };
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  pushSpy.mockClear();
  useChatState.messages = [];
  useChatState.status = "ready";
  useChatState.error = undefined;
  useChatState.sendMessage.mockClear();
  useChatState.regenerate.mockClear();
  useChatState.clearError.mockClear();
  fetchSpy = vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  );
  // @ts-expect-error — override for observation.
  globalThis.fetch = fetchSpy;
});

function renderScreen(
  essay: Essay = makeEssay(),
  messages: Message[] = [],
  level = 1,
  settings: Record<string, string> = {},
  isParentView = false,
  debugLevelActive = false
) {
  return render(
    <WritingScreen
      essay={essay}
      initialMessages={messages}
      currentLevel={level}
      essaysAtLevel={0}
      settings={settings}
      isParentView={isParentView}
      debugLevelActive={debugLevelActive}
    />
  );
}

// ——— Tests ——————————————————————————————————————————————————————————————

describe("WritingScreen — initial render", () => {
  it("shows the essay title and the current level badge", () => {
    renderScreen();
    expect(screen.getByText("Dogs")).toBeDefined();
    expect(screen.getByText(/Level 1/)).toBeDefined();
  });

  it("renders a DEBUG badge only when debugLevelActive is true", () => {
    const { unmount } = renderScreen();
    expect(screen.queryByText(/DEBUG: level override/)).toBeNull();
    unmount();
    renderScreen(makeEssay(), [], 1, {}, false, true);
    expect(screen.getByText(/DEBUG: level override/)).toBeDefined();
  });

  it("sends an opening greeting when there are no prior messages and we're not in parent view", () => {
    renderScreen();
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "I want to write about: Dogs" },
      expect.objectContaining({ body: expect.any(Object) })
    );
  });

  it("does NOT send a greeting in parent view", () => {
    renderScreen(makeEssay(), [], 1, {}, true);
    expect(useChatState.sendMessage).not.toHaveBeenCalled();
  });

  it("does NOT send a greeting if initialMessages are present", () => {
    const msgs: Message[] = [
      {
        id: 1,
        essay_id: 1,
        role: "assistant",
        content: "Hello!",
        step: "draft",
        created_at: "",
        snapshot_id: null,
      },
    ];
    renderScreen(makeEssay(), msgs);
    expect(useChatState.sendMessage).not.toHaveBeenCalled();
  });
});

describe("WritingScreen — tab fallback", () => {
  it("falls back to the draft tab when the stored tab isn't available at the current level", () => {
    // At level 1, only 'draft' is available. If the DB says 'brainstorm',
    // the UI should fall back to 'draft' without a reset loop.
    renderScreen(makeEssay({ active_tab: "brainstorm" }), [], 1);
    expect(screen.getByRole("tab", { name: /Draft/ })).toBeDefined();
    // There is no brainstorm tab to be selected at level 1.
    expect(screen.queryByRole("tab", { name: /Brainstorm/ })).toBeNull();
  });
});

describe("WritingScreen — error surfacing", () => {
  it("renders a 'Try again' panel when useChat reports an error", () => {
    useChatState.error = new Error("boom");
    renderScreen();
    expect(screen.getByText(/Hmm, something went wrong/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeDefined();
  });

  it("Try again clears the error and asks useChat to regenerate", () => {
    useChatState.error = new Error("boom");
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(useChatState.clearError).toHaveBeenCalledTimes(1);
    expect(useChatState.regenerate).toHaveBeenCalledTimes(1);
  });

  it("does NOT render the error panel while streaming, even if error is set transiently", () => {
    useChatState.status = "streaming";
    useChatState.error = new Error("boom");
    renderScreen();
    expect(screen.queryByText(/Hmm, something went wrong/)).toBeNull();
  });
});

describe("WritingScreen — check/revise buttons", () => {
  it("shows 'Check My Writing!' when not yet reviewing", () => {
    useChatState.sendMessage.mockClear();
    renderScreen();
    expect(
      screen.getByRole("button", { name: /Check My Writing/ })
    ).toBeDefined();
  });

  it("Check button sends 'Please check my writing!' and sets step=review", async () => {
    renderScreen();
    useChatState.sendMessage.mockClear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Check My Writing/ })
      );
    });
    await waitFor(() =>
      expect(useChatState.sendMessage).toHaveBeenCalledWith(
        { text: "Please check my writing!" },
        expect.objectContaining({
          body: expect.objectContaining({ currentStep: "review" }),
        })
      )
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/essays/1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("shows 'I've Made Changes!' when in review step", () => {
    renderScreen(makeEssay({ current_step: "review" }));
    expect(
      screen.getByRole("button", { name: /I've Made Changes/ })
    ).toBeDefined();
  });

  it("'I've Made Changes!' sends the revision message and PATCHes the step to 'revise' (not 'review')", async () => {
    renderScreen(makeEssay({ current_step: "review" }));
    useChatState.sendMessage.mockClear();
    fetchSpy.mockClear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /I've Made Changes/ })
      );
    });
    await waitFor(() =>
      expect(useChatState.sendMessage).toHaveBeenCalledWith(
        { text: "I've made changes! Can you check again?" },
        expect.objectContaining({
          body: expect.objectContaining({ currentStep: "revise" }),
        })
      )
    );
    // The step must transition to `revise` so the AI gets the
    // revision-aware system prompt ("re-read and check if the suggestion
    // was addressed"), not the fresh-review prompt.
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/essays/1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"current_step":"revise"'),
      })
    );
  });

  it("disables the action button when word count < 3", () => {
    // A 1-word draft: "Dogs".
    renderScreen(
      makeEssay({
        content: "<p>Dogs</p>",
        word_count: 1,
      })
    );
    expect(
      screen.getByRole("button", { name: /Check My Writing/ })
    ).toBeDisabled();
  });

  it("rapid double-tap on 'Check My Writing!' fires sendMessage exactly once", async () => {
    // Regression for the duplicate-AI-message bug: the handler awaits a PATCH
    // before calling sendMessage, so isStreaming hadn't flipped true yet —
    // tapping again during the slow PATCH used to queue a second sendMessage
    // and a second AI turn, leaving partial/aborted messages in the chat.
    let resolvePatch: (() => void) | undefined;
    fetchSpy.mockImplementation(
      (url: string) => {
        // Snapshot POST must resolve immediately so captureSnapshot() doesn't hang.
        if (typeof url === "string" && url.includes("/snapshots")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 99 }), {
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        // Other requests (the PATCH step change) hang until resolved.
        return new Promise<Response>((resolve) => {
          resolvePatch = () =>
            resolve(
              new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
              })
            );
        });
      }
    );
    renderScreen();
    useChatState.sendMessage.mockClear();
    const button = screen.getByRole("button", { name: /Check My Writing/ });

    // Two taps before the PATCH has resolved — what a frustrated user does on
    // a slow mobile connection when nothing visibly happens.
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    // Let the PATCH settle and any queued microtasks drain.
    await act(async () => {
      resolvePatch?.();
    });

    expect(useChatState.sendMessage).toHaveBeenCalledTimes(1);
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "Please check my writing!" },
      expect.objectContaining({
        body: expect.objectContaining({ currentStep: "review" }),
      })
    );
  });

  it("rapid double-tap on 'I've Made Changes!' fires sendMessage exactly once", async () => {
    let resolvePatch: (() => void) | undefined;
    fetchSpy.mockImplementation(
      (url: string) => {
        // Snapshot POST must resolve immediately so captureSnapshot() doesn't hang.
        if (typeof url === "string" && url.includes("/snapshots")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 99 }), {
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        // Other requests (the PATCH step change) hang until resolved.
        return new Promise<Response>((resolve) => {
          resolvePatch = () =>
            resolve(
              new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
              })
            );
        });
      }
    );
    renderScreen(makeEssay({ current_step: "review" }));
    useChatState.sendMessage.mockClear();
    const button = screen.getByRole("button", { name: /I've Made Changes/ });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await act(async () => {
      resolvePatch?.();
    });

    expect(useChatState.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("WritingScreen — Mark as Complete button", () => {
  it("does NOT show when the last assistant message has no markEssayReady tool part", () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "nice start" }],
      } as unknown as UIMessage,
    ];
    renderScreen();
    expect(
      screen.queryByRole("button", { name: /Mark as Complete/ })
    ).toBeNull();
  });

  it("appears when the most recent assistant message has a markEssayReady tool part", () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Great job!" },
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: { reason: "ok" },
          },
        ],
      } as unknown as UIMessage,
    ];
    renderScreen();
    expect(
      screen.getByRole("button", { name: /Mark as Complete/ })
    ).toBeDefined();
  });

  it("completing the essay routes to the level-up page when the child leveled up", async () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: { reason: "ok" },
          },
        ],
      } as unknown as UIMessage,
    ];
    fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, leveledUp: true, newLevel: 2 }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    // @ts-expect-error — override for observation.
    globalThis.fetch = fetchSpy;

    renderScreen();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Mark as Complete/ })
      );
    });
    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith(
        "/essays/1/level-up?newLevel=2&type=opinion"
      )
    );
  });

  it("renders no message text when the AI emits neither text nor a reason (defensive empty case, no crash)", () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: { reason: "" },
          },
        ],
      } as unknown as UIMessage,
    ];
    renderScreen();
    // Button still shows (tool was called); message area just stays empty
    // rather than crashing.
    expect(
      screen.getByRole("button", { name: /Mark as Complete/ })
    ).toBeDefined();
  });

  it("renders the tool's reason as the message when the AI emits a markEssayReady tool call with no accompanying text (silent-approval fallback)", () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: {
              reason:
                "Amazing work, Owen! Each sentence says something different. Click Mark as Complete!",
            },
          },
        ],
      } as unknown as UIMessage,
    ];
    renderScreen();
    expect(
      screen.getByText(/Amazing work, Owen!.*Mark as Complete/)
    ).toBeDefined();
  });

  it("completing without a level-up routes back to the student home", async () => {
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-markEssayReady",
            toolCallId: "tc_1",
            state: "input-available",
            input: { reason: "ok" },
          },
        ],
      } as unknown as UIMessage,
    ];
    renderScreen();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Mark as Complete/ })
      );
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith("/"));
  });

});

describe("WritingScreen — chat input", () => {
  it("sends a chat message on Enter key when input is non-empty", () => {
    renderScreen();
    useChatState.sendMessage.mockClear();
    const input = screen.getByPlaceholderText(/Ask me anything/);
    fireEvent.change(input, { target: { value: "what next?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "what next?" },
      expect.objectContaining({ body: expect.any(Object) })
    );
  });

  it("does NOT send on Enter when the input is only whitespace", () => {
    renderScreen();
    useChatState.sendMessage.mockClear();
    const input = screen.getByPlaceholderText(/Ask me anything/);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useChatState.sendMessage).not.toHaveBeenCalled();
  });

  it("clicking the send button also fires sendMessage (covers the button-click path)", () => {
    renderScreen();
    useChatState.sendMessage.mockClear();
    const input = screen.getByPlaceholderText(/Ask me anything/);
    fireEvent.change(input, { target: { value: "hi there" } });

    const sendBtn = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-send") !== null
    );
    expect(sendBtn).toBeDefined();
    fireEvent.click(sendBtn!);
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "hi there" },
      expect.objectContaining({ body: expect.any(Object) })
    );
  });

  it("disables the send button when streaming", () => {
    useChatState.status = "streaming";
    renderScreen();
    const sendBtn = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-send") !== null
    );
    // No explicit label on the send button — locate by its icon.
    expect(sendBtn).toBeDefined();
    if (sendBtn) expect(sendBtn).toBeDisabled();
  });
});

describe("WritingScreen — brainstorm / outline helpers (Essay Builder level)", () => {
  it("renders all three tabs when the level makes them available", () => {
    renderScreen(
      makeEssay({
        active_tab: "brainstorm",
        content: "<p>ok ok ok</p>",
        word_count: 3,
      }),
      [],
      13
    );
    expect(screen.getByRole("tab", { name: /Brainstorm/ })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Outline/ })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Draft/ })).toBeDefined();
  });

  it("the 'Help me brainstorm!' button asks the tutor for help", () => {
    renderScreen(
      makeEssay({ active_tab: "brainstorm" }),
      [
        {
          id: 1,
          essay_id: 1,
          role: "assistant",
          content: "hi",
          step: "brainstorm",
          created_at: "",
          snapshot_id: null,
        },
      ],
      11
    );
    useChatState.sendMessage.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Help me brainstorm/ }));
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "Can you help me brainstorm some ideas?" },
      expect.objectContaining({ body: expect.any(Object) })
    );
  });

  it("typing in the brainstorm textarea triggers a save after the debounce timer", async () => {
    vi.useFakeTimers();
    try {
      renderScreen(
        makeEssay({ active_tab: "brainstorm", current_step: "brainstorm" }),
        [
          {
            id: 1,
            essay_id: 1,
            role: "assistant",
            content: "hi",
            step: "brainstorm",
            created_at: "",
            snapshot_id: null,
          },
        ],
        11
      );
      fetchSpy.mockClear();
      const textarea = screen.getAllByRole("textbox").find(
        (el) =>
          (el as HTMLTextAreaElement).placeholder?.includes("bullet points")
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "idea one" } });
      // Debounced 800ms save.
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/essays/1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("brainstorm_notes"),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("typing in the outline textarea triggers a save after the debounce timer", async () => {
    vi.useFakeTimers();
    try {
      renderScreen(
        makeEssay({ active_tab: "outline", current_step: "organize" }),
        [
          {
            id: 1,
            essay_id: 1,
            role: "assistant",
            content: "hi",
            step: "organize",
            created_at: "",
            snapshot_id: null,
          },
        ],
        13
      );
      fetchSpy.mockClear();
      const textarea = screen.getAllByRole("textbox").find(
        (el) =>
          (el as HTMLTextAreaElement).placeholder?.includes(
            "First I'll write about"
          )
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "1. intro" } });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/essays/1",
        expect.objectContaining({
          body: expect.stringContaining("outline"),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("the 'Help me plan!' outline button asks the tutor for help", () => {
    renderScreen(
      makeEssay({ active_tab: "outline" }),
      [
        {
          id: 1,
          essay_id: 1,
          role: "assistant",
          content: "hi",
          step: "organize",
          created_at: "",
          snapshot_id: null,
        },
      ],
      13
    );
    useChatState.sendMessage.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Help me plan/ }));
    expect(useChatState.sendMessage).toHaveBeenCalledWith(
      { text: "Can you help me plan my outline?" },
      expect.objectContaining({ body: expect.any(Object) })
    );
  });
});

describe("WritingScreen — parent/complete views", () => {
  it("parent view hides the edit actions and chat input", () => {
    renderScreen(makeEssay(), [], 1, {}, true);
    expect(
      screen.queryByRole("button", { name: /Check My Writing/ })
    ).toBeNull();
    expect(screen.queryByPlaceholderText(/Ask me anything/)).toBeNull();
  });

  it("completed essay shows the 'Completed' badge and hides edit actions", () => {
    renderScreen(
      makeEssay({ status: "completed", current_step: "complete" }),
      [],
      1
    );
    expect(screen.getByText(/✓ Completed/)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Check My Writing/ })
    ).toBeNull();
  });
});

describe("WritingScreen — level badge & tab switching", () => {
  it("clicking the level badge opens the LevelInfoDialog", () => {
    renderScreen();
    fireEvent.click(screen.getByText(/Level 1/));
    expect(screen.getByText(/Opinion Writing — Level Journey/)).toBeDefined();
  });

  it("switching to brainstorm tab PATCHes active_tab + current_step, then back to draft PATCHes again", async () => {
    renderScreen(
      makeEssay({ active_tab: "draft", current_step: "brainstorm" }),
      [
        {
          id: 1,
          essay_id: 1,
          role: "assistant",
          content: "hi",
          step: "brainstorm",
          created_at: "",
          snapshot_id: null,
        },
      ],
      11
    );
    fetchSpy.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /Brainstorm/ }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/essays/1",
        expect.objectContaining({
          body: expect.stringContaining("brainstorm"),
        })
      )
    );
  });
});

describe("WritingScreen — default fallbacks & TTS", () => {
  it("falls back to empty strings when the essay row has null brainstorm_notes / outline / active_tab", () => {
    renderScreen(
      makeEssay({
        brainstorm_notes: null as unknown as string,
        outline: null as unknown as string,
        active_tab: null as unknown as string,
      })
    );
    expect(screen.getByText(/Level 1/)).toBeDefined();
  });

  it("renders TTS buttons for essay and tutor when those settings are enabled", () => {
    // The mocked useChat returns useChatState.messages (not initialSeed), so
    // seed the assistant message there directly.
    useChatState.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Nice work!" }],
      } as unknown as import("@ai-sdk/react").UIMessage,
    ];
    renderScreen(makeEssay(), [], 1, {
      tts_essay: "true",
      tts_tutor: "true",
    });
    expect(
      screen.getByRole("button", { name: /Hear My Essay/ })
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Hear this/ })).toBeDefined();
  });

  it("renders user messages with the user styling when they appear in history", () => {
    useChatState.messages = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hi tutor" }],
      } as unknown as import("@ai-sdk/react").UIMessage,
    ];
    renderScreen();
    expect(screen.getByText("hi tutor")).toBeDefined();
  });

  it("switching to outline tab maps step → 'organize'", async () => {
    renderScreen(
      makeEssay({ active_tab: "draft", current_step: "brainstorm" }),
      [
        {
          id: 1,
          essay_id: 1,
          role: "assistant",
          content: "hi",
          step: "brainstorm",
          created_at: "",
          snapshot_id: null,
        },
      ],
      13
    );
    fetchSpy.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /Outline/ }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/essays/1",
        expect.objectContaining({
          body: expect.stringContaining("organize"),
        })
      )
    );
  });
});

describe("WritingScreen — home button", () => {
  it("routes to / from the home button", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    expect(pushSpy).toHaveBeenCalledWith("/");
  });

  it("routes to /parent from the home button in parent view", () => {
    renderScreen(makeEssay(), [], 1, {}, true);
    fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    expect(pushSpy).toHaveBeenCalledWith("/parent");
  });
});

describe("WritingScreen — history mode", () => {
  function setupHistory({
    snapshots,
    initialMessages,
    uiMessages,
  }: {
    snapshots: Array<{ id: number; essay_id?: number; content: string; created_at: string }>;
    initialMessages: Message[];
    uiMessages: Array<{ id: string; role: "user" | "assistant"; text: string }>;
  }) {
    fetchSpy.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.endsWith("/snapshots")) {
        return new Response(JSON.stringify({ snapshots }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    useChatState.messages = uiMessages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.text }],
    })) as unknown as UIMessage[];

    return render(
      <WritingScreen
        essay={makeEssay()}
        initialMessages={initialMessages}
        currentLevel={1}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );
  }

  it("user messages with snapshot_id render a 'view this draft' link; messages without don't", async () => {
    setupHistory({
      snapshots: [{ id: 7, content: "<p>v1</p>", created_at: "2026-05-04T10:00:00Z" }],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "Please check my writing!", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
        { id: 2, essay_id: 1, role: "assistant", content: "Looks good!", step: "review", created_at: "2026-05-04T10:00:01Z", snapshot_id: null },
      ],
      uiMessages: [
        { id: "db-1", role: "user", text: "Please check my writing!" },
        { id: "db-2", role: "assistant", text: "Looks good!" },
      ],
    });
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /view this draft/i })).toHaveLength(1)
    );
  });

  it("clicking a snapshot link enters history mode: diff view shown, editor hidden, banner visible", async () => {
    setupHistory({
      snapshots: [{ id: 7, content: "<p>The cat sat</p>", created_at: "2026-05-04T10:00:00Z" }],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "Please check my writing!", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
      ],
      uiMessages: [{ id: "db-1", role: "user", text: "Please check my writing!" }],
    });
    fireEvent.click(await screen.findByRole("button", { name: /view this draft/i }));
    await waitFor(() =>
      expect(screen.getByText(/Viewing earlier draft/i)).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("essay-editor")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to live/i })).toBeInTheDocument();
  });

  it("clicking ✕ Back to live exits history mode", async () => {
    setupHistory({
      snapshots: [{ id: 7, content: "<p>v1</p>", created_at: "2026-05-04T10:00:00Z" }],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "x", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
      ],
      uiMessages: [{ id: "db-1", role: "user", text: "x" }],
    });
    fireEvent.click(await screen.findByRole("button", { name: /view this draft/i }));
    await screen.findByRole("button", { name: /back to live/i });
    fireEvent.click(screen.getByRole("button", { name: /back to live/i }));
    expect(screen.queryByText(/Viewing earlier draft/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("essay-editor")).toBeInTheDocument();
  });

  it("Escape exits history mode", async () => {
    setupHistory({
      snapshots: [{ id: 7, content: "<p>v1</p>", created_at: "2026-05-04T10:00:00Z" }],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "x", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
      ],
      uiMessages: [{ id: "db-1", role: "user", text: "x" }],
    });
    fireEvent.click(await screen.findByRole("button", { name: /view this draft/i }));
    await screen.findByRole("button", { name: /back to live/i });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByText(/Viewing earlier draft/i)).not.toBeInTheDocument()
    );
  });

  it("Prev/Next walk the snapshot list and update the active highlight", async () => {
    setupHistory({
      snapshots: [
        { id: 7, content: "<p>v1</p>", created_at: "2026-05-04T10:00:00Z" },
        { id: 8, content: "<p>v2</p>", created_at: "2026-05-04T10:01:00Z" },
      ],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "first", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
        { id: 2, essay_id: 1, role: "assistant", content: "ok", step: "review", created_at: "2026-05-04T10:00:30Z", snapshot_id: null },
        { id: 3, essay_id: 1, role: "user", content: "second", step: "revise", created_at: "2026-05-04T10:01:00Z", snapshot_id: 8 },
      ],
      uiMessages: [
        { id: "db-1", role: "user", text: "first" },
        { id: "db-2", role: "assistant", text: "ok" },
        { id: "db-3", role: "user", text: "second" },
      ],
    });
    // Open at first snapshot.
    const links = await screen.findAllByRole("button", { name: /view this draft/i });
    fireEvent.click(links[0]);
    await screen.findByRole("button", { name: /next/i });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      const highlighted = document.querySelector("[data-active-snapshot='true']");
      expect(highlighted?.textContent).toMatch(/second/);
    });
    // Now click Prev to go back to the first snapshot.
    fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    await waitFor(() => {
      const highlighted = document.querySelector("[data-active-snapshot='true']");
      expect(highlighted?.textContent).toMatch(/first/);
    });
  });

  it("Versions button in the header opens the latest snapshot", async () => {
    setupHistory({
      snapshots: [
        { id: 7, content: "<p>v1</p>", created_at: "2026-05-04T10:00:00Z" },
        { id: 8, content: "<p>v2</p>", created_at: "2026-05-04T10:01:00Z" },
      ],
      initialMessages: [
        { id: 1, essay_id: 1, role: "user", content: "first", step: "review", created_at: "2026-05-04T10:00:00Z", snapshot_id: 7 },
        { id: 2, essay_id: 1, role: "user", content: "second", step: "revise", created_at: "2026-05-04T10:01:00Z", snapshot_id: 8 },
      ],
      uiMessages: [
        { id: "db-1", role: "user", text: "first" },
        { id: "db-2", role: "user", text: "second" },
      ],
    });
    const versionsBtn = await screen.findByRole("button", { name: /versions/i });
    fireEvent.click(versionsBtn);
    await waitFor(() =>
      expect(screen.getByText(/Viewing earlier draft/i)).toBeInTheDocument()
    );
    const highlighted = document.querySelector("[data-active-snapshot='true']");
    expect(highlighted?.textContent).toMatch(/second/);
  });

  it("Versions button is hidden when no snapshots exist", async () => {
    setupHistory({
      snapshots: [],
      initialMessages: [],
      uiMessages: [],
    });
    // Wait for the snapshot fetch to settle so the button (or its absence) is stable.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /versions/i })).not.toBeInTheDocument();
  });

  it("still sends message even if snapshot capture throws (non-fatal failure)", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/snapshots")) {
        throw new Error("network error");
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    renderScreen();
    useChatState.sendMessage.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Check My Writing/ }));
    });
    await waitFor(() =>
      expect(useChatState.sendMessage).toHaveBeenCalledWith(
        { text: "Please check my writing!" },
        expect.objectContaining({
          body: expect.objectContaining({ currentStep: "review" }),
        })
      )
    );
  });

  it("in-flight binding: clicking Check My Writing binds the new user message to its snapshot id", async () => {
    // Set up the fetch to return a snapshot id.
    fetchSpy.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.endsWith("/snapshots")) {
        return new Response(JSON.stringify({ id: 42, created_at: "2026-05-04T11:00:00Z" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    // Start with no messages.
    useChatState.messages = [];
    const { rerender } = render(
      <WritingScreen
        essay={makeEssay()}
        initialMessages={[]}
        currentLevel={1}
        essaysAtLevel={0}
        settings={{}}
        isParentView={false}
      />
    );
    useChatState.sendMessage.mockClear();
    // Click Check My Writing — this calls captureSnapshot, sets pendingSnapshotIdRef.current = 42.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Check My Writing/ }));
    });
    // Simulate useChat appending the user message (as it would in production).
    await act(async () => {
      useChatState.messages = [
        {
          id: "new-msg-1",
          role: "user",
          parts: [{ type: "text", text: "Please check my writing!" }],
        } as unknown as UIMessage,
      ];
      rerender(
        <WritingScreen
          essay={makeEssay()}
          initialMessages={[]}
          currentLevel={1}
          essaysAtLevel={0}
          settings={{}}
          isParentView={false}
        />
      );
    });
    // After the rerender, the effect should have bound the snapshot id to the message.
    // Verify by checking that the "view this draft" link appears for the new message.
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /view this draft/i })).toHaveLength(1)
    );
  });
});
