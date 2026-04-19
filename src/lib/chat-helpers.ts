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
 * Choose which tab to show: the stored preference if still available at the
 * current level, otherwise `draft` (which is always available).
 */
export function pickActiveTab(
  storedTab: Tab,
  availableTabs: readonly Tab[]
): Tab {
  return availableTabs.includes(storedTab) ? storedTab : "draft";
}
