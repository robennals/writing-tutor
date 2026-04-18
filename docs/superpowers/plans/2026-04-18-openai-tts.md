# OpenAI TTS Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser `SpeechSynthesisUtterance` implementation in `tts-button.tsx` with OpenAI's `gpt-4o-mini-tts` (voice `nova`), streamed via the MediaSource API so audio starts within ~500ms.

**Architecture:** A new authenticated Next.js route `POST /api/tts` receives text, calls the OpenAI audio-speech endpoint with `response_format: "mp3"`, and passes the OpenAI response body straight through as a streaming response. The client rewrites `tts-button.tsx` to consume that stream through a `MediaSource` / `SourceBuffer` attached to an `<audio>` element.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, direct `fetch` to `https://api.openai.com/v1/audio/speech` (no `@ai-sdk/openai` dependency needed — the direct API is smaller and exposes the raw stream cleanly). The existing `getSession()` helper (`src/lib/auth.ts`) gates the route to child sessions.

**Testing pattern:** This codebase has no automated test framework set up (`package.json` has no test script, no jest/vitest/playwright installed). Adding one is outside this plan's scope. Each task that produces runnable behavior ends with an explicit manual-verification step performed in the dev server, following the existing pattern in the repo.

**Spec:** `docs/superpowers/specs/2026-04-18-openai-tts-design.md`

---

## File Structure

- **Create:** `src/app/api/tts/route.ts` — authenticated POST handler that streams MP3 from OpenAI.
- **Modify (full rewrite):** `src/components/tts-button.tsx` — MediaSource-based streaming player.
- **User edits (not committed):** `.env.local` — adds `OPENAI_API_KEY=…`.
- **Unchanged:** `src/components/writing-screen.tsx` — `TtsButton`'s props (`text`, `label`, `size`) are preserved, so consumers keep working.

Both files have a single clear responsibility. The route is ~40 lines; the component is ~100 lines. No larger refactor is needed.

---

## Task 1: Add `OPENAI_API_KEY` to local env

**Files:**
- User-edited: `.env.local` (gitignored, not committed)

- [ ] **Step 1: Check whether `.env.local` exists and whether it already has the key**

Run:
```bash
ls -la .env.local 2>/dev/null || echo "missing"
grep -c '^OPENAI_API_KEY=' .env.local 2>/dev/null || true
```

Expected: either the file is missing, or the key is absent (`0`).

- [ ] **Step 2: Ask the user to add the key**

Tell the user (do not run this yourself — the key is their secret):

> Please append this line to `.env.local` at the repo root, replacing `sk-…` with your real OpenAI API key:
>
> ```
> OPENAI_API_KEY=sk-…
> ```
>
> If the file doesn't exist yet, create it. It's gitignored.

Wait for the user to confirm they've added it before proceeding.

- [ ] **Step 3: Verify the key is readable by Next.js on restart**

Have the user restart their dev server if it's running, then run:

```bash
grep -c '^OPENAI_API_KEY=' .env.local
```

Expected: `1`.

No commit — `.env.local` is gitignored.

---

## Task 2: Create the `/api/tts` route

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/tts/route.ts` with exactly this content:

```ts
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
```

Key decisions (don't change these):
- Direct `fetch` to OpenAI — gives us the `ReadableStream` without depending on `@ai-sdk/openai`.
- `new Response(openaiResponse.body, …)` passes the stream straight through. Do NOT buffer into an `ArrayBuffer`; that defeats streaming.
- `Cache-Control: no-store` — prevents any intermediary caching of per-user audio.
- The 6000-char cap is comfortably under `gpt-4o-mini-tts`'s 2000-token input ceiling (~6K chars English).

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```

Expected: no errors in the new file.

- [ ] **Step 4: Manual verification — unauthenticated call**

Start the dev server in another terminal (`npm run dev`), then run:

```bash
curl -i -X POST http://localhost:3000/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"hello"}'
```

Expected: `HTTP/1.1 401 Unauthorized` with `{"error":"Unauthorized"}`.

- [ ] **Step 5: Manual verification — authenticated call**

In the browser, log in as Owen (child). Then, from the browser devtools console on any app page:

```js
const r = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello Owen, this is a short test.' }),
});
console.log(r.status, r.headers.get('content-type'));
const blob = await r.blob();
console.log('bytes:', blob.size);
new Audio(URL.createObjectURL(blob)).play();
```

Expected: status `200`, content-type `audio/mpeg`, non-zero byte count, and you hear the `nova` voice speak the sentence. If you don't hear the new, natural voice, stop and debug before moving on — the client rewrite in Task 3 assumes this works.

- [ ] **Step 6: Manual verification — over-long input**

In the same browser console:

```js
const r = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'a'.repeat(7000) }),
});
console.log(r.status, await r.json());
```

Expected: `413` with `{ error: "Text too long (max 6000 characters)" }`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add /api/tts route streaming gpt-4o-mini-tts"
```

---

## Task 3: Rewrite `tts-button.tsx` with MediaSource streaming

**Files:**
- Modify (full rewrite): `src/components/tts-button.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/components/tts-button.tsx` with exactly this content:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "playing";

export function TtsButton({
  text,
  label = "Listen",
  size = "sm",
}: {
  text: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const play = useCallback(async () => {
    if (status !== "idle") {
      cleanup();
      return;
    }

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    const audio = new Audio(objectUrl);
    const abort = new AbortController();

    audioRef.current = audio;
    objectUrlRef.current = objectUrl;
    abortRef.current = abort;

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", () => {
      console.error("TTS audio error", audio.error);
      cleanup();
    });

    setStatus("loading");

    mediaSource.addEventListener("sourceopen", async () => {
      let sourceBuffer: SourceBuffer;
      try {
        sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      } catch (err) {
        console.error("MediaSource addSourceBuffer failed", err);
        cleanup();
        return;
      }

      const appendChunk = (chunk: Uint8Array) =>
        new Promise<void>((resolve, reject) => {
          const onUpdateEnd = () => {
            sourceBuffer.removeEventListener("updateend", onUpdateEnd);
            sourceBuffer.removeEventListener("error", onError);
            resolve();
          };
          const onError = (e: Event) => {
            sourceBuffer.removeEventListener("updateend", onUpdateEnd);
            sourceBuffer.removeEventListener("error", onError);
            reject(e);
          };
          sourceBuffer.addEventListener("updateend", onUpdateEnd);
          sourceBuffer.addEventListener("error", onError);
          sourceBuffer.appendBuffer(chunk);
        });

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abort.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({}));
          console.error("TTS request failed", response.status, detail);
          cleanup();
          return;
        }

        const reader = response.body.getReader();
        let firstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          await appendChunk(value);
          if (firstChunk) {
            firstChunk = false;
            setStatus("playing");
            void audio.play().catch((err) => {
              console.error("audio.play() rejected", err);
              cleanup();
            });
          }
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("TTS streaming error", err);
        cleanup();
      }
    });
  }, [text, status, cleanup]);

  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : status === "playing" ? (
      <VolumeX className="h-4 w-4" />
    ) : (
      <Volume2 className="h-4 w-4" />
    );

  const buttonLabel =
    status === "loading" ? "Loading" : status === "playing" ? "Stop" : label;

  return (
    <Button
      variant="outline"
      size={size}
      onClick={play}
      className="gap-1.5"
      aria-busy={status === "loading"}
    >
      {icon}
      {buttonLabel}
    </Button>
  );
}
```

Key decisions (don't change these):
- State machine is `idle → loading → playing → idle`. A click in any non-idle state runs `cleanup()` and returns.
- `cleanup()` is idempotent — it can run from the button click, the `ended` listener, an error, or the unmount effect, and will do the right thing each time.
- The status flips to `playing` only after the **first** chunk is appended and `audio.play()` has been kicked off. That's the signal the user can actually hear audio.
- `audio.load()` after removing the `src` releases the MediaSource pipeline cleanly.
- Uses `Loader2` from lucide-react (already a dependency) for the loading spinner.

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```

Expected: no errors in the modified file.

- [ ] **Step 4: Commit**

```bash
git add src/components/tts-button.tsx
git commit -m "feat: stream tts audio via MediaSource using /api/tts"
```

---

## Task 4: End-to-end manual verification

**Files:** none modified; this is a verification-only task.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Leave it running.

- [ ] **Step 2: Log in as Owen, open an essay**

Navigate to `http://localhost:3000`, log in with the child account, open any existing essay or create a new one with a short draft (one or two sentences is fine).

- [ ] **Step 3: Test the "Hear My Essay" button**

On the draft tab, click **Hear My Essay**.

Expected:
- Button immediately shows a spinner and "Loading".
- Within ~1s, the button flips to a stop icon and "Stop", and the `nova` voice begins reading the draft.
- When playback finishes, the button returns to the default icon and "Hear My Essay".

- [ ] **Step 4: Test cancellation mid-playback**

Click **Hear My Essay** again, wait until it starts speaking, then click **Stop** mid-sentence.

Expected: audio cuts off immediately and the button returns to idle. No console errors about unhandled promise rejections.

- [ ] **Step 5: Test the per-message "Hear this" button**

Send a message to the tutor so you get an assistant reply. Click **Hear this** on the assistant message.

Expected: same streaming-start behaviour, `nova` voice reads the message.

- [ ] **Step 6: Test cancellation during loading**

Click **Hear this** on a longer message and immediately click it again before audio starts.

Expected: spinner disappears, no audio plays, no console errors. The fetch is aborted cleanly.

- [ ] **Step 7: Verify no browser-TTS references remain**

Run:
```bash
grep -rn 'speechSynthesis\|SpeechSynthesisUtterance' src/
```

Expected: no output. If anything prints, remove it.

- [ ] **Step 8: Final commit (if any cleanup happened)**

Only if Step 7 found leftovers and you had to edit a file:

```bash
git add -A
git commit -m "chore: remove leftover browser-tts references"
```

Otherwise skip this step — no commit needed.

---

## Self-review checklist (already run by planner)

**Spec coverage:**
- Auth-gated `POST /api/tts` ✓ (Task 2)
- `gpt-4o-mini-tts` + `nova` + instructions + `mp3` ✓ (Task 2 Step 1)
- Streaming passthrough ✓ (Task 2 Step 1 — `new Response(openaiResponse.body, …)`)
- Input validation + 413 ✓ (Task 2 Step 1, verified in Step 6)
- MediaSource client with `idle → loading → playing` ✓ (Task 3)
- Cleanup on unmount / stop / end / error ✓ (Task 3 `cleanup()` + `useEffect`)
- `OPENAI_API_KEY` env var ✓ (Task 1)
- Error mapping (401/413/500/502 server, console + idle client) ✓

**Placeholder scan:** no TBDs, TODOs, "add error handling" hand-waves, or "similar to Task N" references. Every step has exact code or exact commands.

**Type consistency:** the `TtsButton` prop signature (`text`, `label`, `size`) is unchanged, so `writing-screen.tsx:456` and `:521` keep working without edits. The route's response shape (`audio/mpeg` stream on 200, `{ error }` JSON on 4xx/5xx) is consumed consistently by the client.
