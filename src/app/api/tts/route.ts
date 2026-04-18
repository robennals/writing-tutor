import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MAX_CHARS = 6000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "child") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set");
    return NextResponse.json(
      { error: "TTS is not configured" },
      { status: 500 }
    );
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_CHARS} characters)` },
      { status: 413 }
    );
  }

  const openaiResponse = await fetch(
    "https://api.openai.com/v1/audio/speech",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "nova",
        input: text,
        instructions:
          "Speak warmly and clearly at a slightly slower pace, like a friendly tutor reading to a child. Pronounce each word distinctly.",
        response_format: "mp3",
      }),
    }
  );

  if (!openaiResponse.ok || !openaiResponse.body) {
    const detail = await openaiResponse.text().catch(() => "");
    console.error("OpenAI TTS error", openaiResponse.status, detail);
    return NextResponse.json(
      { error: "TTS upstream error" },
      { status: 502 }
    );
  }

  return new Response(openaiResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
