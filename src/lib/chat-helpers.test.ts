import { describe, it, expect } from "vitest";
import type { UIMessage } from "@ai-sdk/react";
import { hasMarkEssayReady, pickActiveTab } from "./chat-helpers";
import type { Tab } from "./levels";

describe("hasMarkEssayReady", () => {
  it("returns true when the assistant message contains a tool-markEssayReady part", () => {
    const msg = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Looks great!" },
        {
          type: "tool-markEssayReady",
          toolCallId: "tc_1",
          state: "input-available",
          input: { reason: "criteria met" },
        },
      ],
    } as unknown as UIMessage;
    expect(hasMarkEssayReady(msg)).toBe(true);
  });

  it("returns false for assistant messages without the tool part", () => {
    const msg = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "Try one more tweak." }],
    } as unknown as UIMessage;
    expect(hasMarkEssayReady(msg)).toBe(false);
  });

  it("returns false when the message is a user message, even if it has a tool-markEssayReady part", () => {
    // Guards against the button appearing after a user sends a crafted message.
    const msg = {
      id: "u1",
      role: "user",
      parts: [
        {
          type: "tool-markEssayReady",
          toolCallId: "tc_1",
          state: "input-available",
          input: { reason: "x" },
        },
      ],
    } as unknown as UIMessage;
    expect(hasMarkEssayReady(msg)).toBe(false);
  });

  it("returns false when the message is undefined", () => {
    expect(hasMarkEssayReady(undefined)).toBe(false);
  });
});

describe("pickActiveTab", () => {
  const all: Tab[] = ["brainstorm", "outline", "draft"];

  it("returns the stored tab when it's available at the current level", () => {
    expect(pickActiveTab("brainstorm", all)).toBe("brainstorm");
    expect(pickActiveTab("outline", all)).toBe("outline");
    expect(pickActiveTab("draft", all)).toBe("draft");
  });

  it("falls back to draft when the stored tab isn't available (e.g. brainstorm at level 1)", () => {
    expect(pickActiveTab("brainstorm", ["draft"])).toBe("draft");
    expect(pickActiveTab("outline", ["draft"])).toBe("draft");
  });

  it("falls back to draft even when draft itself is somehow missing", () => {
    // Defensive: availableTabs always contains draft by level config, but the
    // function shouldn't throw if a caller passes an odd list.
    expect(pickActiveTab("brainstorm", [])).toBe("draft");
  });
});
