import { streamText, convertToModelMessages, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { addMessage } from "@/lib/queries";
import { buildSystemPrompt, buildContextMessage } from "@/lib/prompts";
import type { WritingType, Tab } from "@/lib/levels";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "child") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }

  const {
    messages,
    essayId,
    essayContent,
    essayTitle,
    brainstormNotes,
    outline,
    activeTab,
    currentStep,
    writingType,
    currentLevel,
  } = await req.json();

  // Save user message to DB. In AI SDK v6, UIMessages use `parts`, not `content`.
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === "user") {
    const text =
      lastUserMsg.parts
        ?.filter((p: { type: string }) => p.type === "text")
        .map((p: { text: string }) => p.text)
        .join("") ?? "";
    if (text) {
      await addMessage(essayId, "user", text, currentStep);
    }
  }

  // STABLE — cached via Anthropic prompt caching. Identical across users at
  // the same level + writingType, so the first-ever request writes the cache
  // and every subsequent request across all students reads it.
  const systemPrompt = buildSystemPrompt({
    writingType: writingType as WritingType,
    currentLevel,
  });

  // VOLATILE — per-turn state (tab, step, essay draft). Delivered as a user
  // message prepended to the student's latest turn, so a keystroke in the
  // draft editor doesn't invalidate the cached system prefix.
  const contextBlock = buildContextMessage({
    currentLevel,
    currentStep,
    activeTab: activeTab as Tab,
    essayContent: essayContent ?? "",
    essayTitle: essayTitle ?? "",
    brainstormNotes: brainstormNotes ?? "",
    outline: outline ?? "",
  });

  // Strip tool-call parts whose result never came back (e.g. `markEssayReady`,
  // which has no server-side `execute` and no client-side `addToolResult`).
  // Without this, Anthropic rejects the next turn: every tool_use must be
  // followed by a tool_result.
  const modelMessages = await convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
  });

  // Prepend the volatile context block to the student's latest turn so the
  // model reads the CURRENT draft alongside the current user message.
  // ModelMessage `content` is either a string or an array of parts; normalize
  // to an array once and splice the context block in front.
  const lastIdx = modelMessages.length - 1;
  const last = modelMessages[lastIdx];
  if (last?.role === "user") {
    const existingParts = Array.isArray(last.content)
      ? last.content
      : [{ type: "text" as const, text: last.content }];
    modelMessages[lastIdx] = {
      ...last,
      content: [{ type: "text", text: contextBlock }, ...existingParts],
    };
  }

  // Leading student-name context. Kept out of the system prompt so the system
  // prefix is byte-identical across users — the cache is shared.
  const studentNameMsg: ModelMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: `(Context: The student's name is ${session.name}. Use this name naturally when greeting or celebrating.)`,
      },
    ],
  };

  // System-as-first-message, with cache_control, is how AI SDK v6 exposes
  // Anthropic prompt caching. A bare `system:` string parameter cannot carry
  // providerOptions, so the cache would never be written.
  const finalMessages: ModelMessage[] = [
    {
      role: "system",
      content: systemPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    studentNameMsg,
    ...modelMessages,
  ];

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    messages: finalMessages,
    tools: {
      markEssayReady: tool({
        description:
          "Call this tool when the draft essay meets ALL criteria for the current level and all prior levels. This makes a 'Mark as Complete' button appear for the student. You MUST also emit a text message in the same turn — a tool call with no text renders as a silent approval. Only call it when you are genuinely ready to tell the student that the essay passes — not prematurely.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe(
              "A warm, 2-3 sentence congratulation for the student: call them by name, name the specific thing they did well for this level's skill, and invite them to click 'Mark as Complete'. This is the fallback shown if you forget to emit a text message, so write it as if it IS the message."
            ),
        }),
      }),
    },
    onFinish: async ({ text }) => {
      if (text) {
        await addMessage(essayId, "assistant", text, currentStep);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
