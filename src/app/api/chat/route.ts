import { streamText, convertToModelMessages, tool } from "ai";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { addMessage } from "@/lib/queries";
import { buildSystemPrompt } from "@/lib/prompts";
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
        .join("") ?? lastUserMsg.content ?? "";
    if (text) {
      await addMessage(essayId, "user", text, currentStep);
    }
  }

  const systemPrompt = buildSystemPrompt({
    writingType: writingType as WritingType,
    currentLevel,
    currentStep,
    activeTab: activeTab as Tab,
    essayContent: essayContent ?? "",
    essayTitle: essayTitle ?? "",
    brainstormNotes: brainstormNotes ?? "",
    outline: outline ?? "",
  });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      markEssayReady: tool({
        description:
          "Call this tool when the draft essay meets ALL criteria for the current level and all prior levels. This makes a 'Mark as Complete' button appear for Owen. Only call it when you are genuinely ready to tell Owen the essay passes — not prematurely.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe(
              "A brief, warm reason why the essay passes (one sentence)."
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
