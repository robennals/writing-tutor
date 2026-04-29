# Agent Call Log — Design

## Problem

The chat endpoint (`src/app/api/chat/route.ts`) sometimes produces behavior that looks wrong, and we have no way to inspect what was actually sent to the model or what came back. We need a way to look at the exact requests/responses for a specific essay so we can tell whether the bug is in the prompt assembly, the model output, or the client.

## Goal

Capture every call to the agent and expose it through an admin-only HTTP endpoint that a pnpm script can query by essay URL or ID. The captured data must be sufficient to (a) audit what the agent saw and produced, and (b) be replayed against the model later if needed.

## Non-goals

- A UI for browsing logs (the script + JSON output is enough).
- Capturing token-usage / cache-hit metadata. Easy to add later; not needed for the current debugging task.
- Logging non-agent endpoints (TTS, settings, etc.).
- Tamper-proofing or audit-trail guarantees. This is a debugging aid for a family-only app.
- Real-time alerting on weird behavior.

## Architecture

### Storage: new `agent_calls` table

Added to the existing libsql schema in `src/lib/db-schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS agent_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_id INTEGER NOT NULL,
  current_step TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (essay_id) REFERENCES essays(id)
);
CREATE INDEX IF NOT EXISTS idx_agent_calls_essay ON agent_calls(essay_id, created_at);
```

`request_json` holds the full payload sent to `streamText` — `model`, `finalMessages` (system + studentNameMsg + modelMessages), and `toolNames` (a `string[]` of the offered tools). `response_json` holds the assembled assistant output: `{ text: string, toolCalls: Array<{ name, input }> }`. The tool definitions themselves live in code and aren't worth re-serializing — knowing which tools were on the table is enough.

Two-phase write because the response is streamed:
1. On request entry, `INSERT` the row with the request and an empty `response_json`, capturing the row id.
2. In `onFinish`, `UPDATE` the row's `response_json` with the assembled text and tool calls.

If the stream errors before `onFinish`, the row stays with an empty response — that's a meaningful signal, not a bug.

### Capture: instrument `src/app/api/chat/route.ts`

Two changes inside `POST`:

- After `finalMessages` is built and right before `streamText`, insert the request row via a new helper `recordAgentCallRequest(essayId, currentStep, request)` which returns the inserted id.
- Augment the existing `onFinish` callback so that, in addition to saving the assistant message, it calls `recordAgentCallResponse(id, { text, toolCalls })`.

`toolNames` comes from `Object.keys(tools)`. No zod-internals access, no JSON-serialization gotchas with the `tool()` factory's executable parts.

The two helpers live in `src/lib/queries.ts` next to the existing `addMessage`. They also perform the 30-day prune (see Retention).

### Retention: 30 days, two mechanisms

1. **Piggyback prune**. `recordAgentCallRequest` issues `DELETE FROM agent_calls WHERE created_at < datetime('now', '-30 days')` before its `INSERT`. Volume is low enough that this is free.
2. **Manual flush**. `DELETE /api/admin/agent-log` (with the admin key) wipes the entire table. Hit via `pnpm agent-log:flush`.

### Admin endpoint: `/api/admin/agent-log`

New route at `src/app/api/admin/agent-log/route.ts`. Exports `GET` and `DELETE`.

Both methods:
- Read `x-admin-key` header. Compare with `process.env.ADMIN_LOG_KEY` using a constant-time comparison (`timingSafeEqual` against equal-length buffers — rejects mismatched lengths first).
- If the env var is unset, the route returns `503` regardless of the supplied key. This prevents accidentally exposing a wide-open endpoint in any environment that forgot to configure the key.
- On auth failure, return `401` with `{ error: "unauthorized" }`. No timing differences worth caring about beyond the constant-time compare.

`GET`:
- Query param: `essayId` (integer). Required. Returns `400` if missing or non-numeric.
- Response body: `Array<{ id, created_at, current_step, request, response }>`, ordered `created_at ASC` so reading top-to-bottom matches the conversation. `request` and `response` are parsed back into objects, not strings.
- No pagination — at <100 calls per essay, the array is small.

`DELETE`:
- No params. Drops all rows. Returns `{ deleted: <count> }`.

### Script: `scripts/agent-log.ts`

Run as `pnpm agent-log <essay-url-or-id> [--prod]`.

- Argument parsing: positional `<essay>` then optional `--prod`. The essay arg can be a bare integer (`42`), a path (`/essays/42`), or a full URL (`http://localhost:3000/essays/42`, `https://writingtutor.robennals.org/essays/42`). Extract the integer with `/\/essays\/(\d+)/` if it matches, otherwise treat the whole arg as the id and validate it's an integer. Reject anything else with a clear error.
- Base URL: `https://writingtutor.robennals.org` if `--prod`, else `http://localhost:3000`.
- Loads `.env.local` (via `node --env-file=.env.local`, set in the pnpm script command) to read `ADMIN_LOG_KEY`. Errors clearly if missing.
- Sends `GET <base>/api/admin/agent-log?essayId=<id>` with `x-admin-key` header.
- Prints the JSON response with `JSON.stringify(body, null, 2)` to stdout. The agent or human pipes it as needed.
- Non-2xx → print the response body to stderr and exit `1`.

Companion script `scripts/agent-log-flush.ts` is the same shape but `DELETE`s and prints the deleted count. Run as `pnpm agent-log:flush [--prod]`.

`package.json` gets:

```json
"agent-log": "node --env-file=.env.local --experimental-strip-types scripts/agent-log.ts",
"agent-log:flush": "node --env-file=.env.local --experimental-strip-types scripts/agent-log-flush.ts"
```

`--experimental-strip-types` is needed because the project runs on Node 22 (`v22.22.1`), where TypeScript stripping is gated behind that flag. If we move to Node 24 LTS later, the flag becomes unnecessary but harmless.

### Env var: `ADMIN_LOG_KEY`

Added to `.env.local` manually (not committed). The admin endpoint refuses to function without it, so there's no insecure default. The key only needs to exist in environments where you actually want to call the admin API — production ideally has it set so `--prod` works, local dev needs it set for the script to work.

## Data flow

```
POST /api/chat
  ├─ build systemPrompt, contextBlock, finalMessages
  ├─ recordAgentCallRequest(essayId, currentStep, { model, messages: finalMessages, tools }) → id
  ├─ streamText(...)
  │    └─ onFinish({ text, toolCalls })
  │         ├─ addMessage(essayId, "assistant", text, currentStep)   ← existing
  │         └─ recordAgentCallResponse(id, { text, toolCalls })      ← new
  └─ return UI message stream

GET /api/admin/agent-log?essayId=42 (x-admin-key header)
  ├─ check ADMIN_LOG_KEY set, constant-time compare
  ├─ SELECT * FROM agent_calls WHERE essay_id = 42 ORDER BY created_at ASC
  └─ parse JSON columns, return as array
```

## Error handling

- Logging failure must NEVER break the chat endpoint. `recordAgentCallRequest` is wrapped in try/catch; on failure it logs to `console.error` and returns `null`, and the chat route proceeds without a row. `recordAgentCallResponse` is similarly resilient — if it can't update, it logs and returns silently.
- Stream errors before `onFinish`: row stays with empty response. That state is itself diagnostic.
- Admin endpoint with invalid `essayId`: `400 { error: "essayId required" }`. Endpoint with missing key env: `503 { error: "admin endpoint not configured" }`.

## Testing

Following the project's existing test patterns (`*.test.ts` next to source):

- `src/lib/queries.test.ts` — extend with tests for `recordAgentCallRequest` (inserts row, returns id, prunes >30d), `recordAgentCallResponse` (updates row), and that both swallow DB errors instead of throwing.
- `src/app/api/chat/route.test.ts` — extend to assert one row is written per POST and `response_json` matches the assembled output. Existing tests already mock `streamText`; this hooks into the same fixture.
- `src/app/api/admin/agent-log/route.test.ts` — new file. Cases: missing key env → 503; wrong key → 401; right key + valid essayId → returns rows oldest-first; DELETE removes all rows.
- Scripts (`scripts/agent-log.ts`, `scripts/agent-log-flush.ts`) are thin glue and can be smoke-tested by hand. Argument parsing for `--prod` and URL extraction is the only logic worth a unit test — extract those into a small pure function in `src/lib/agent-log-cli.ts` and test it there.

## Files touched

- **New**: `src/app/api/admin/agent-log/route.ts`, `src/app/api/admin/agent-log/route.test.ts`, `src/lib/agent-log-cli.ts`, `src/lib/agent-log-cli.test.ts`, `scripts/agent-log.ts`, `scripts/agent-log-flush.ts`, `docs/superpowers/specs/2026-04-27-agent-call-log-design.md`.
- **Modified**: `src/lib/db-schema.ts` (table + index), `src/lib/queries.ts` (two helpers), `src/lib/queries.test.ts`, `src/app/api/chat/route.ts` (two call sites), `src/app/api/chat/route.test.ts`, `package.json` (two scripts).
