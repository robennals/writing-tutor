# Agent Call Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every chat-route call to the agent into a new `agent_calls` table, expose a per-essay log via an admin-only HTTP endpoint guarded by `ADMIN_LOG_KEY`, and ship two pnpm scripts (`agent-log`, `agent-log:flush`) that hit either localhost or `https://writingtutor.robennals.org`.

**Architecture:** A two-phase write inside `POST /api/chat` — insert the request before `streamText`, update the same row inside `onFinish` with the assembled assistant text + tool calls. Retention is enforced by piggyback prune (`DELETE` rows older than 30 days on every insert). The admin route at `/api/admin/agent-log` exposes `GET ?essayId=...` and `DELETE`, both gated by an `x-admin-key` header compared in constant time to `process.env.ADMIN_LOG_KEY`.

**Tech Stack:** Next.js 16 App Router, libsql/Turso, AI SDK v6 (`streamText` `onFinish` hook), Node 22 (TypeScript scripts via `node --experimental-strip-types`), vitest for tests, pnpm for the package manager.

**Spec:** `docs/superpowers/specs/2026-04-27-agent-call-log-design.md`

---

## File Structure

- **Create:**
  - `src/app/api/admin/agent-log/route.ts` — `GET` and `DELETE` handlers, header-auth.
  - `src/app/api/admin/agent-log/route.test.ts` — vitest cases for auth + behaviour.
  - `src/lib/agent-log-cli.ts` — pure helpers `extractEssayId(arg)` and `resolveBaseUrl(prodFlag)`.
  - `src/lib/agent-log-cli.test.ts` — unit tests for those helpers.
  - `scripts/agent-log.ts` — CLI wrapper, GETs the admin endpoint and prints JSON.
  - `scripts/agent-log-flush.ts` — CLI wrapper, DELETEs the admin endpoint and prints `{deleted}`.
- **Modify:**
  - `src/lib/db-schema.ts` — add `agent_calls` table + index inside the existing `db.batch([...])`.
  - `src/lib/db-schema.test.ts` — assert `agent_calls` is among the created tables.
  - `src/lib/queries.ts` — append `recordAgentCallRequest`, `recordAgentCallResponse`, `getAgentCalls`, `flushAgentCalls`.
  - `src/lib/queries.test.ts` — extend with cases for the four new helpers.
  - `src/app/api/chat/route.ts` — call `recordAgentCallRequest` before `streamText`, call `recordAgentCallResponse` from `onFinish`.
  - `src/app/api/chat/route.test.ts` — extend mock + assert one row per POST and that `onFinish` records the response.
  - `package.json` — add `agent-log` and `agent-log:flush` to `scripts`.
- **User-edited (gitignored):** `.env.local` — add `ADMIN_LOG_KEY=<random hex>`.

Each file has one clear responsibility. Helpers in `src/lib/` are pure where possible so they're testable without mocking the network.

---

## Task 1: Add `ADMIN_LOG_KEY` to local env

**Files:**
- User-edited: `.env.local` (gitignored, not committed)

- [ ] **Step 1: Check whether `.env.local` exists and whether it already has the key**

Run:
```bash
ls -la .env.local 2>/dev/null || echo "missing"
grep -c '^ADMIN_LOG_KEY=' .env.local 2>/dev/null || true
```

Expected: either the file is missing, or the key is absent (`0`).

- [ ] **Step 2: Generate a random key and ask the user to add it**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Show that 64-char hex string to the user and tell them (do not write to `.env.local` yourself — the key is a secret):

> Please append this line to `.env.local` at the repo root:
>
> ```
> ADMIN_LOG_KEY=<the 64-char hex from the command above>
> ```
>
> If the file doesn't exist yet, create it. It's gitignored.

Wait for the user to confirm they've added it before proceeding.

- [ ] **Step 3: No commit needed — `.env.local` is gitignored**

Just verify:
```bash
git check-ignore .env.local
```

Expected output: `.env.local`

---

## Task 2: Add `agent_calls` table to the schema

**Files:**
- Modify: `src/lib/db-schema.ts`
- Test: `src/lib/db-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/lib/db-schema.test.ts`. Inside the existing `describe("initializeDatabase", () => { ... })` block, add this test right after the "creates the four tables" test:

```typescript
  it("creates the agent_calls table for agent-call logging", async () => {
    const { initializeDatabase } = await import("./db-schema");
    await initializeDatabase();

    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const names = tables.rows.map(
      (r) => (r as unknown as { name: string }).name
    );
    expect(names).toContain("agent_calls");

    const indexes = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'agent_calls'"
    );
    const indexNames = indexes.rows.map(
      (r) => (r as unknown as { name: string }).name
    );
    expect(indexNames).toContain("idx_agent_calls_essay");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/db-schema.test.ts -t "agent_calls"`

Expected: FAIL — `agent_calls` is not in the names list.

- [ ] **Step 3: Add the table + index to `initializeDatabase`**

In `src/lib/db-schema.ts`, append a fifth entry to the `db.batch([...])` array (right after the `settings` table entry, before the closing `])`):

```typescript
    {
      sql: `CREATE TABLE IF NOT EXISTS agent_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        essay_id INTEGER NOT NULL,
        current_step TEXT NOT NULL,
        request_json TEXT NOT NULL,
        response_json TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (essay_id) REFERENCES essays(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_agent_calls_essay ON agent_calls(essay_id, created_at)`,
      args: [],
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/db-schema.test.ts`

Expected: all `db-schema` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-schema.ts src/lib/db-schema.test.ts
git commit -m "feat: add agent_calls table for per-essay agent-call logging"
```

---

## Task 3: `recordAgentCallRequest` — insert with 30-day prune

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `src/lib/queries.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/queries.test.ts`, append this `describe` block after the existing `describe("recomputeSkillLevel", ...)` block:

```typescript
describe("recordAgentCallRequest / recordAgentCallResponse / getAgentCalls", () => {
  it("recordAgentCallRequest inserts a row with the request JSON and returns its id", async () => {
    const { createEssay, recordAgentCallRequest, getAgentCalls } = await import(
      "./queries"
    );
    const essayId = await createEssay("t", "opinion", 1);

    const id = await recordAgentCallRequest(essayId, "draft", {
      model: "anthropic/claude-opus-4.7",
      messages: [{ role: "user", content: "hi" }],
      toolNames: ["markEssayReady"],
    });
    expect(id).toBeGreaterThan(0);

    const rows = await getAgentCalls(essayId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].current_step).toBe("draft");
    expect(rows[0].request).toEqual({
      model: "anthropic/claude-opus-4.7",
      messages: [{ role: "user", content: "hi" }],
      toolNames: ["markEssayReady"],
    });
    expect(rows[0].response).toEqual({});
  });

  it("recordAgentCallRequest swallows DB errors and returns null instead of throwing", async () => {
    const { recordAgentCallRequest } = await import("./queries");
    // essay_id has a FOREIGN KEY but SQLite doesn't enforce it by default;
    // force a real failure by passing a payload that can't be JSON.stringified.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const id = await recordAgentCallRequest(1, "draft", cyclic);
    expect(id).toBeNull();
  });

  it("recordAgentCallRequest prunes rows older than 30 days on each insert", async () => {
    const { createEssay, recordAgentCallRequest, getAgentCalls } = await import(
      "./queries"
    );
    const essayId = await createEssay("t", "opinion", 1);

    // Seed an old row by hand.
    await db.execute({
      sql: `INSERT INTO agent_calls (essay_id, current_step, request_json, response_json, created_at)
            VALUES (?, 'draft', '{}', '{}', datetime('now', '-31 days'))`,
      args: [essayId],
    });

    expect((await getAgentCalls(essayId)).length).toBe(1);

    await recordAgentCallRequest(essayId, "draft", { ok: true });

    const rows = await getAgentCalls(essayId);
    expect(rows).toHaveLength(1); // old one pruned, new one kept
    expect(rows[0].request).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/queries.test.ts -t "recordAgentCallRequest"`

Expected: FAIL — `recordAgentCallRequest` is not exported from `./queries`.

- [ ] **Step 3: Add the helpers to `src/lib/queries.ts`**

Append at the end of the file:

```typescript
export interface AgentCall {
  id: number;
  essay_id: number;
  current_step: string;
  request: unknown;
  response: unknown;
  created_at: string;
}

const RETENTION_DAYS = 30;

/**
 * Records the outgoing chat-route payload before streamText runs. Returns the
 * inserted row id so the caller can pair the response back via
 * recordAgentCallResponse. Swallows DB / JSON errors — logging must never
 * break the chat endpoint.
 */
export async function recordAgentCallRequest(
  essayId: number,
  currentStep: string,
  request: unknown
): Promise<number | null> {
  try {
    const json = JSON.stringify(request);
    // Piggyback prune: 30-day retention, no cron needed.
    await db.execute({
      sql: `DELETE FROM agent_calls WHERE created_at < datetime('now', ?)`,
      args: [`-${RETENTION_DAYS} days`],
    });
    const result = await db.execute({
      sql: `INSERT INTO agent_calls (essay_id, current_step, request_json) VALUES (?, ?, ?)`,
      args: [essayId, currentStep, json],
    });
    return Number(result.lastInsertRowid);
  } catch (err) {
    console.error("recordAgentCallRequest failed:", err);
    return null;
  }
}

/**
 * Updates the row created by recordAgentCallRequest with the assembled
 * assistant output ({ text, toolCalls }). No-op if `id` is null (the request
 * record failed) or the DB update throws — logging must never break the chat
 * endpoint.
 */
export async function recordAgentCallResponse(
  id: number | null,
  response: unknown
): Promise<void> {
  if (id == null) return;
  try {
    const json = JSON.stringify(response);
    await db.execute({
      sql: `UPDATE agent_calls SET response_json = ? WHERE id = ?`,
      args: [json, id],
    });
  } catch (err) {
    console.error("recordAgentCallResponse failed:", err);
  }
}

export async function getAgentCalls(essayId: number): Promise<AgentCall[]> {
  const result = await db.execute({
    sql: `SELECT id, essay_id, current_step, request_json, response_json, created_at
          FROM agent_calls
          WHERE essay_id = ?
          ORDER BY created_at ASC, id ASC`,
    args: [essayId],
  });
  return result.rows.map((row) => {
    const r = row as unknown as {
      id: number;
      essay_id: number;
      current_step: string;
      request_json: string;
      response_json: string;
      created_at: string;
    };
    return {
      id: Number(r.id),
      essay_id: Number(r.essay_id),
      current_step: r.current_step,
      request: r.request_json ? JSON.parse(r.request_json) : null,
      response: r.response_json ? JSON.parse(r.response_json) : {},
      created_at: r.created_at,
    };
  });
}

export async function flushAgentCalls(): Promise<number> {
  const result = await db.execute("DELETE FROM agent_calls");
  return result.rowsAffected;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/queries.test.ts`

Expected: all queries tests pass, including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts src/lib/queries.test.ts
git commit -m "feat: add agent-call log queries with 30-day retention"
```

---

## Task 4: `flushAgentCalls` test

**Files:**
- Test: `src/lib/queries.test.ts`

- [ ] **Step 1: Add a focused test for the flush helper**

In `src/lib/queries.test.ts`, add this test inside the same `describe` block as Task 3:

```typescript
  it("flushAgentCalls deletes all rows and returns the count", async () => {
    const { createEssay, recordAgentCallRequest, flushAgentCalls, getAgentCalls } =
      await import("./queries");
    const essayId = await createEssay("t", "opinion", 1);

    await recordAgentCallRequest(essayId, "draft", { a: 1 });
    await recordAgentCallRequest(essayId, "draft", { a: 2 });
    expect((await getAgentCalls(essayId)).length).toBe(2);

    const deleted = await flushAgentCalls();
    expect(deleted).toBe(2);
    expect((await getAgentCalls(essayId)).length).toBe(0);
  });
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/lib/queries.test.ts -t "flushAgentCalls"`

Expected: PASS — `flushAgentCalls` was added in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries.test.ts
git commit -m "test: cover flushAgentCalls"
```

---

## Task 5: Wire logging into the chat route

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/route.test.ts`

- [ ] **Step 1: Extend the route's test mocks to capture the new helpers**

In `src/app/api/chat/route.test.ts`, replace the existing `vi.mock("@/lib/queries", …)` block (around lines 16-18) with:

```typescript
const addMessageSpy = vi.fn(async () => {});
const recordRequestSpy = vi.fn(async () => 42);
const recordResponseSpy = vi.fn(async () => {});

vi.mock("@/lib/queries", () => ({
  addMessage: addMessageSpy,
  recordAgentCallRequest: recordRequestSpy,
  recordAgentCallResponse: recordResponseSpy,
}));
```

(Remove the standalone `const addMessageSpy = vi.fn(async () => {});` line above — its declaration moves into the block above so all three spies live together.)

In `beforeEach`, add:

```typescript
    recordRequestSpy.mockClear();
    recordRequestSpy.mockResolvedValue(42);
    recordResponseSpy.mockClear();
```

- [ ] **Step 2: Add failing tests for the new behaviour**

Append these two tests at the end of the existing `describe("POST /api/chat", () => { ... })` block:

```typescript
  it("records the outgoing agent call before streaming", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    expect(recordRequestSpy).toHaveBeenCalledTimes(1);
    const [essayId, step, payload] = recordRequestSpy.mock.calls[0];
    expect(essayId).toBe(1);
    expect(step).toBe("draft");
    const p = payload as {
      model: string;
      messages: ModelMessage[];
      toolNames: string[];
    };
    expect(p.model).toBe("anthropic/claude-opus-4.7");
    expect(p.messages.length).toBeGreaterThan(0);
    expect(p.toolNames).toContain("markEssayReady");
  });

  it("records the assembled response (text + toolCalls) inside onFinish", async () => {
    const { POST } = await import("./route");
    await POST(buildRequest(baseBody()));
    expect(onFinishCallback).toBeDefined();

    recordResponseSpy.mockClear();
    await onFinishCallback!({
      text: "great job!",
      toolCalls: [{ toolName: "markEssayReady", input: { reason: "done" } }],
    } as unknown as { text: string });

    expect(recordResponseSpy).toHaveBeenCalledTimes(1);
    const [id, response] = recordResponseSpy.mock.calls[0];
    expect(id).toBe(42);
    expect(response).toEqual({
      text: "great job!",
      toolCalls: [{ name: "markEssayReady", input: { reason: "done" } }],
    });
  });
```

Also widen the `onFinishCallback` type at the top of the file so it can carry `toolCalls` in the test:

```typescript
let onFinishCallback:
  | ((ev: { text: string; toolCalls?: Array<{ toolName: string; input: unknown }> }) => Promise<void>)
  | undefined;
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/api/chat/route.test.ts -t "records"`

Expected: FAIL — `recordRequestSpy`/`recordResponseSpy` aren't called yet.

- [ ] **Step 4: Wire the calls into the route**

In `src/app/api/chat/route.ts`:

a) Update the import on line 5:
```typescript
import {
  addMessage,
  recordAgentCallRequest,
  recordAgentCallResponse,
} from "@/lib/queries";
```

b) After `finalMessages` is built (right before the existing `const result = streamText({ … })` on line 121), insert:
```typescript
  const tools = {
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
  };

  const logId = await recordAgentCallRequest(essayId, currentStep, {
    model: "anthropic/claude-opus-4.7",
    messages: finalMessages,
    toolNames: Object.keys(tools),
  });
```

c) Replace the original `streamText({ … })` call so it uses the extracted `tools` constant and an extended `onFinish`:
```typescript
  const result = streamText({
    model: "anthropic/claude-opus-4.7",
    messages: finalMessages,
    tools,
    onFinish: async ({ text, toolCalls }) => {
      if (text) {
        await addMessage(essayId, "assistant", text, currentStep);
      }
      const calls = (toolCalls ?? []).map(
        (tc: { toolName: string; input: unknown }) => ({
          name: tc.toolName,
          input: tc.input,
        })
      );
      await recordAgentCallResponse(logId, { text: text ?? "", toolCalls: calls });
    },
  });
```

(Remove the `tools: { markEssayReady: tool({ … }) }` block that used to be inline — it's now hoisted into the `tools` const above.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/api/chat/route.test.ts`

Expected: all chat-route tests pass, including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/chat/route.test.ts
git commit -m "feat: log every agent call and its response from /api/chat"
```

---

## Task 6: CLI helper — `extractEssayId` and `resolveBaseUrl`

**Files:**
- Create: `src/lib/agent-log-cli.ts`
- Test: `src/lib/agent-log-cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent-log-cli.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractEssayId, resolveBaseUrl } from "./agent-log-cli";

describe("extractEssayId", () => {
  it("returns the integer when given a bare integer string", () => {
    expect(extractEssayId("42")).toBe(42);
  });

  it("extracts the id from a /essays/<id> path", () => {
    expect(extractEssayId("/essays/7")).toBe(7);
  });

  it("extracts the id from a localhost URL", () => {
    expect(extractEssayId("http://localhost:3000/essays/13")).toBe(13);
  });

  it("extracts the id from a production URL with a trailing slash", () => {
    expect(
      extractEssayId("https://writingtutor.robennals.org/essays/99/")
    ).toBe(99);
  });

  it("throws on input that doesn't contain an essay id", () => {
    expect(() => extractEssayId("not-an-id")).toThrow(/essay/i);
    expect(() => extractEssayId("")).toThrow(/essay/i);
    expect(() => extractEssayId("/essays/")).toThrow(/essay/i);
  });
});

describe("resolveBaseUrl", () => {
  it("returns localhost when prod is false", () => {
    expect(resolveBaseUrl(false)).toBe("http://localhost:3000");
  });

  it("returns the production URL when prod is true", () => {
    expect(resolveBaseUrl(true)).toBe("https://writingtutor.robennals.org");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/agent-log-cli.test.ts`

Expected: FAIL — `./agent-log-cli` doesn't exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/agent-log-cli.ts`:

```typescript
const ESSAY_PATH_RE = /\/essays\/(\d+)/;

export function extractEssayId(arg: string): number {
  const trimmed = arg.trim();
  if (!trimmed) {
    throw new Error("Expected an essay id, URL, or /essays/<id> path");
  }
  const match = trimmed.match(ESSAY_PATH_RE);
  if (match) return Number(match[1]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  throw new Error(
    `Could not extract essay id from "${arg}" — pass a bare integer, /essays/<id>, or a full URL`
  );
}

export function resolveBaseUrl(prod: boolean): string {
  return prod
    ? "https://writingtutor.robennals.org"
    : "http://localhost:3000";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/agent-log-cli.test.ts`

Expected: all six cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-log-cli.ts src/lib/agent-log-cli.test.ts
git commit -m "feat: pure helpers for parsing the agent-log CLI args"
```

---

## Task 7: Admin endpoint — `GET /api/admin/agent-log`

**Files:**
- Create: `src/app/api/admin/agent-log/route.ts`
- Test: `src/app/api/admin/agent-log/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/admin/agent-log/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const initializeDatabaseSpy = vi.fn(async () => {});
const getAgentCallsSpy = vi.fn(async () => [] as unknown[]);
const flushAgentCallsSpy = vi.fn(async () => 0);

vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: initializeDatabaseSpy,
}));
vi.mock("@/lib/queries", () => ({
  getAgentCalls: getAgentCallsSpy,
  flushAgentCalls: flushAgentCallsSpy,
}));

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as import("next/server").NextRequest;
}

describe("GET /api/admin/agent-log", () => {
  beforeEach(() => {
    initializeDatabaseSpy.mockClear();
    getAgentCallsSpy.mockClear();
    flushAgentCallsSpy.mockClear();
    vi.resetModules();
    delete process.env.ADMIN_LOG_KEY;
  });

  it("returns 503 when ADMIN_LOG_KEY is not configured", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
        headers: { "x-admin-key": "anything" },
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when the supplied key is wrong", async () => {
    process.env.ADMIN_LOG_KEY = "right-key";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1", {
        headers: { "x-admin-key": "wrong-key" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when no header is supplied", async () => {
    process.env.ADMIN_LOG_KEY = "right-key";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when essayId is missing or non-numeric", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    const { GET } = await import("./route");

    const noQuery = await GET(
      buildRequest("http://localhost/api/admin/agent-log", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(noQuery.status).toBe(400);

    const badQuery = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=abc", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(badQuery.status).toBe(400);
  });

  it("returns the rows from getAgentCalls when the key is correct", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    getAgentCallsSpy.mockResolvedValue([
      {
        id: 1,
        essay_id: 7,
        current_step: "draft",
        request: { model: "x" },
        response: { text: "hi" },
        created_at: "2026-04-27 12:00:00",
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest("http://localhost/api/admin/agent-log?essayId=7", {
        headers: { "x-admin-key": "k" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(getAgentCallsSpy).toHaveBeenCalledWith(7);
    expect(body).toHaveLength(1);
    expect(body[0].request.model).toBe("x");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/api/admin/agent-log/route.test.ts`

Expected: FAIL — `./route` doesn't exist.

- [ ] **Step 3: Implement the GET handler**

Create `src/app/api/admin/agent-log/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { initializeDatabase } from "@/lib/db-schema";
import { getAgentCalls, flushAgentCalls } from "@/lib/queries";

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

/**
 * Constant-time compare. Rejects mismatched lengths first (which itself isn't
 * constant-time — but the secret's length is fixed in any real deployment, so
 * leaking length only matters if someone misconfigures it shorter than 32+
 * bytes, in which case they have bigger problems).
 */
function keyMatches(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_LOG_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "admin endpoint not configured" },
      { status: 503 }
    );
  }
  if (!keyMatches(req.headers.get("x-admin-key"), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = authorize(req);
  if (authError) return authError;

  const essayIdRaw = new URL(req.url).searchParams.get("essayId");
  if (!essayIdRaw || !/^\d+$/.test(essayIdRaw)) {
    return NextResponse.json({ error: "essayId required" }, { status: 400 });
  }

  await ensureDb();
  const rows = await getAgentCalls(Number(essayIdRaw));
  return NextResponse.json(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/api/admin/agent-log/route.test.ts`

Expected: all five GET tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/agent-log/route.ts src/app/api/admin/agent-log/route.test.ts
git commit -m "feat: GET /api/admin/agent-log returns logged calls per essay"
```

---

## Task 8: Admin endpoint — `DELETE /api/admin/agent-log`

**Files:**
- Modify: `src/app/api/admin/agent-log/route.ts`
- Test: `src/app/api/admin/agent-log/route.test.ts`

- [ ] **Step 1: Add failing tests for DELETE**

Append this `describe` block to `src/app/api/admin/agent-log/route.test.ts`:

```typescript
describe("DELETE /api/admin/agent-log", () => {
  beforeEach(() => {
    initializeDatabaseSpy.mockClear();
    flushAgentCallsSpy.mockClear();
    vi.resetModules();
    delete process.env.ADMIN_LOG_KEY;
  });

  it("returns 503 when ADMIN_LOG_KEY is not configured", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      buildRequest("http://localhost/api/admin/agent-log", {
        method: "DELETE",
        headers: { "x-admin-key": "anything" },
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when the key is wrong", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    const { DELETE } = await import("./route");
    const res = await DELETE(
      buildRequest("http://localhost/api/admin/agent-log", {
        method: "DELETE",
        headers: { "x-admin-key": "nope" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("calls flushAgentCalls and returns the deleted count", async () => {
    process.env.ADMIN_LOG_KEY = "k";
    flushAgentCallsSpy.mockResolvedValue(5);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      buildRequest("http://localhost/api/admin/agent-log", {
        method: "DELETE",
        headers: { "x-admin-key": "k" },
      })
    );
    expect(res.status).toBe(200);
    expect(flushAgentCallsSpy).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ deleted: 5 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/api/admin/agent-log/route.test.ts -t "DELETE"`

Expected: FAIL — `DELETE` is not exported from `./route`.

- [ ] **Step 3: Add the DELETE handler**

Append to `src/app/api/admin/agent-log/route.ts`:

```typescript
export async function DELETE(req: NextRequest) {
  const authError = authorize(req);
  if (authError) return authError;

  await ensureDb();
  const deleted = await flushAgentCalls();
  return NextResponse.json({ deleted });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/api/admin/agent-log/route.test.ts`

Expected: all eight tests pass (5 GET + 3 DELETE).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/agent-log/route.ts src/app/api/admin/agent-log/route.test.ts
git commit -m "feat: DELETE /api/admin/agent-log flushes the table"
```

---

## Task 9: pnpm scripts — `agent-log` and `agent-log:flush`

**Files:**
- Create: `scripts/agent-log.ts`, `scripts/agent-log-flush.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the fetch script**

Create `scripts/agent-log.ts`:

```typescript
#!/usr/bin/env node
import { extractEssayId, resolveBaseUrl } from "../src/lib/agent-log-cli";

async function main() {
  const args = process.argv.slice(2);
  const prod = args.includes("--prod");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("Usage: pnpm agent-log <essay-url-or-id> [--prod]");
    process.exit(2);
  }

  const essayId = extractEssayId(positional[0]);
  const baseUrl = resolveBaseUrl(prod);

  const key = process.env.ADMIN_LOG_KEY;
  if (!key) {
    console.error(
      "ADMIN_LOG_KEY is not set. Add it to .env.local (the pnpm script loads it via --env-file)."
    );
    process.exit(2);
  }

  const url = `${baseUrl}/api/admin/agent-log?essayId=${essayId}`;
  const res = await fetch(url, { headers: { "x-admin-key": key } });
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${url}:`);
    console.error(await res.text());
    process.exit(1);
  }
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Create the flush script**

Create `scripts/agent-log-flush.ts`:

```typescript
#!/usr/bin/env node
import { resolveBaseUrl } from "../src/lib/agent-log-cli";

async function main() {
  const args = process.argv.slice(2);
  const prod = args.includes("--prod");
  const baseUrl = resolveBaseUrl(prod);

  const key = process.env.ADMIN_LOG_KEY;
  if (!key) {
    console.error(
      "ADMIN_LOG_KEY is not set. Add it to .env.local (the pnpm script loads it via --env-file)."
    );
    process.exit(2);
  }

  const url = `${baseUrl}/api/admin/agent-log`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-admin-key": key },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${url}:`);
    console.error(await res.text());
    process.exit(1);
  }
  const body = (await res.json()) as { deleted: number };
  console.log(`Deleted ${body.deleted} agent_call rows from ${baseUrl}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Wire the pnpm scripts**

Open `package.json` and edit the `"scripts"` block. Insert the two new entries between `"lint"` and `"test"`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "agent-log": "node --env-file=.env.local --experimental-strip-types scripts/agent-log.ts",
    "agent-log:flush": "node --env-file=.env.local --experimental-strip-types scripts/agent-log-flush.ts",
    "test": "vitest run --coverage",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: Smoke-test the fetch script against the dev server**

In one terminal:
```bash
pnpm dev
```

In another, log in as the child (visit `http://localhost:3000/login`, sign in as `owen`), open or create an essay, and have one chat exchange with the tutor. Then, in a third terminal:

```bash
# Replace 1 with the actual essay id (visible in the URL after you open the essay).
pnpm agent-log 1
```

Expected: a JSON array printed to stdout, containing one entry per chat turn, with `request.messages` (array starting with the system prompt + studentNameMsg) and `response` populated with the assistant text.

Also check the URL form:
```bash
pnpm agent-log http://localhost:3000/essays/1
```
Expected: identical output.

And the `--prod` rejection (no key set on prod yet, so this should 503 — which the script reports as HTTP 503):
```bash
pnpm agent-log 1 --prod
```
Expected: a non-zero exit and either a network error or HTTP 503 to stderr (depending on whether prod has `ADMIN_LOG_KEY` set).

- [ ] **Step 5: Smoke-test the flush script**

```bash
pnpm agent-log:flush
```

Expected: prints `Deleted N agent_call rows from http://localhost:3000.` Re-running `pnpm agent-log 1` should now print `[]`.

- [ ] **Step 6: Commit**

```bash
git add scripts/agent-log.ts scripts/agent-log-flush.ts package.json
git commit -m "feat: pnpm agent-log and agent-log:flush scripts"
```

---

## Task 10: Final verification pass

**Files:** none modified.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`

Expected: all tests pass, no regressions in pre-existing suites.

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`

Expected: both clean.

- [ ] **Step 3: Replay sanity check**

Re-confirm the original goal: with the dev server running and a fresh chat exchange complete, `pnpm agent-log <essay-url>` prints a JSON array where each item's `request.messages` field is sufficient to reconstruct the call (`model`, full `messages` including the system prompt + context block, and `toolNames`). `response.text` matches what the tutor said.

If any of those three fields look wrong or missing, fix the underlying issue rather than patching the script — the goal of the log is to enable replay, and if it can't, the design has a hole.

- [ ] **Step 4: Final commit (if any fixups happened)**

If steps 1-3 produced fixes, commit them:
```bash
git add -A
git commit -m "fix: post-verification adjustments to agent-call log"
```

If nothing needed fixing, this step is a no-op.

---

## Self-Review Notes

- **Spec coverage:** Storage (Tasks 2-3), retention prune (Task 3), manual flush (Tasks 4 + 8), capture into chat route (Task 5), CLI helper (Task 6), GET admin endpoint (Task 7), DELETE admin endpoint (Task 8), scripts + pnpm wiring (Task 9). All sections of the spec map to a task.
- **Type consistency:** `recordAgentCallRequest` returns `Promise<number | null>` and `recordAgentCallResponse` accepts `number | null`. The chat route's `logId` flows directly between them. `getAgentCalls` returns `AgentCall[]`, which is what the GET handler passes through.
- **No placeholders:** every code block above is the actual code or test, not a sketch.
- **Frequent commits:** ten commits across nine tasks, each one shippable on its own.
