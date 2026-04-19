import type { UIMessage } from "@ai-sdk/react";
import type { Tab } from "./levels";

/**
 * True when the given assistant message contains a `markEssayReady` tool call
 * (AI SDK v6 names the part `tool-<toolName>`).
 */
export function hasMarkEssayReady(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return message.parts.some(
    (p) => "type" in p && p.type === "tool-markEssayReady"
  );
}

/**
 * Extracts the `reason` string from a `markEssayReady` tool call on an
 * assistant message, if one is present. Used as a fallback when the model
 * emits the tool call without accompanying text — we surface the reason so
 * the student always sees *why* their essay passed.
 */
export function getMarkEssayReadyReason(
  message: UIMessage | undefined
): string | null {
  if (!message || message.role !== "assistant") return null;
  for (const p of message.parts) {
    if ("type" in p && p.type === "tool-markEssayReady") {
      const input = (p as { input?: { reason?: unknown } }).input;
      if (input && typeof input.reason === "string" && input.reason.trim()) {
        return input.reason.trim();
      }
    }
  }
  return null;
}

/**
 * Choose which tab to show: the stored preference if still available at the
 * current level, otherwise `draft` (which is always available).
 */
export function pickActiveTab(
  storedTab: Tab,
  availableTabs: readonly Tab[]
): Tab {
  return availableTabs.includes(storedTab) ? storedTab : "draft";
}
