# OpenAI TTS Replacement — Design

## Problem

The existing "Listen" buttons (`src/components/tts-button.tsx`) use the browser's `SpeechSynthesisUtterance` API. The voices sound robotic, which makes the feature unpleasant — especially for Owen, an 8-year-old with dyslexia who relies on hearing his essay read back.

## Goal

Replace browser TTS with OpenAI's `gpt-4o-mini-tts` model, using the `nova` voice and streaming playback for low start-of-audio latency.

## Non-goals

- Caching generated audio
- Per-user voice preference / parent-dashboard configuration
- Offline fallback if the API is unreachable
- Supporting non-English text

These can be added later if needed.

## Architecture

### Server: `POST /api/tts`

New route at `src/app/api/tts/route.ts`.

- Authenticated: requires a child session (same pattern as `/api/chat`). Unauthenticated callers get `401`.
- Request body: `{ text: string }`.
- Validates text is non-empty and below `gpt-4o-mini-tts`'s 2000-token input ceiling (roughly ~6000 chars of English). Route rejects oversize input with `413` and a clear error message; client surfaces it as a toast. An 8yo's essay is nowhere near this limit — if it ever becomes a real constraint, we'll add paragraph-chunking then.
- Calls the OpenAI audio-speech endpoint with:
  - `model: "gpt-4o-mini-tts"`
  - `voice: "nova"`
  - `instructions: "Speak warmly and clearly at a slightly slower pace, like a friendly tutor reading to a child. Pronounce each word distinctly."`
  - `response_format: "mp3"`
- Returns the OpenAI response body as a passthrough stream with `Content-Type: audio/mpeg`. No buffering.

### Client: rewritten `tts-button.tsx`

Uses the MediaSource API so audio starts playing as soon as the first chunk arrives.

State machine:
- `idle` → click → `loading` (spinner)
- first chunk appended to SourceBuffer → `playing` (stop icon)
- `<audio>` `ended` event → `idle`
- click while `loading` or `playing` → abort fetch, pause audio, revoke object URL → `idle`

Implementation outline:

```ts
const mediaSource = new MediaSource();
const audio = new Audio(URL.createObjectURL(mediaSource));

mediaSource.addEventListener("sourceopen", async () => {
  const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
  const response = await fetch("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text }),
    signal: abortController.signal,
  });
  const reader = response.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await appendChunk(sourceBuffer, value); // awaits "updateend"
  }
  mediaSource.endOfStream();
});

audio.play();
```

`appendChunk` is a small helper that awaits the SourceBuffer's `updateend` event before resolving, so we don't overlap appends.

Cleanup on unmount and on stop: `abortController.abort()`, `audio.pause()`, `URL.revokeObjectURL(audio.src)`.

### Environment

- New env var `OPENAI_API_KEY` required by the `/api/tts` route.
- Added to `.env.local` for local dev (the user sets this).
- Added to Vercel project environment for deployed previews/prod (the user sets this via `vercel env` or the dashboard).

### Auth

The route checks `getSession()` and returns `401` for anything other than a child session. This matches `/api/chat`, keeping the API key unexploitable by anonymous traffic.

## Error handling

- OpenAI request fails or returns non-2xx: route returns `502` with a short JSON error; client surfaces a toast / inline message and returns to `idle`.
- `fetch` is aborted: swallow the `AbortError`, don't surface it.
- MediaSource errors (rare on modern Chrome/Safari on laptop): log and fall back to `idle` with a generic "playback failed" message.
- Missing `OPENAI_API_KEY` on server: route returns `500` with a clear log message during development.

## Files changed

- `src/app/api/tts/route.ts` — new
- `src/components/tts-button.tsx` — rewritten
- `.env.local` — user adds `OPENAI_API_KEY` (not committed)

No changes needed to `writing-screen.tsx` — the `TtsButton` props stay the same (`text`, `label`, `size`).

## Open questions

None blocking. If `@ai-sdk/openai`'s `experimental_generateSpeech` cleanly exposes the raw stream, we use it; otherwise a direct `fetch` to `https://api.openai.com/v1/audio/speech` works fine — it's a handful of lines either way. Implementation plan will decide after a quick check of the SDK's current API.
