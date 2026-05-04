# Essay History — Design

## Problem

The writing tutor only shows the latest draft. There is no way to see what the essay looked like at earlier points, or to compare what the AI suggested with what the student actually changed. As a parent, Rob can't tell whether the AI is giving good advice and whether Owen is acting on it. As a student, Owen can't look back at how his draft has evolved.

## Goal

Capture a snapshot of the draft at each "Check My Writing" / "I've Made Changes" moment, link it to the corresponding chat message, and let anyone — student or parent — view past versions as a word-level diff against the previous snapshot.

## Non-goals

- Snapshotting the brainstorm or outline tabs. The Check buttons live in the draft tab; brainstorm/outline only have "Help me…" buttons, which are help requests, not check moments.
- Editing past versions. History view is read-only.
- Backfilling snapshots for existing in-progress essays. Pre-existing check messages render without a snapshot link.
- Side-by-side diffs of two arbitrary versions. The diff is always prev → this.
- Surfacing snapshots to the AI. The model still only sees the live draft.

## Data model

New table:

```sql
CREATE TABLE essay_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (essay_id) REFERENCES essays(id)
);
```

New column on `messages`:

```sql
ALTER TABLE messages ADD COLUMN snapshot_id INTEGER NULL;
```

Pre-existing rows have `snapshot_id = NULL`. Only the user messages produced by Check / I've-Made-Changes get a non-null id going forward.

Migration follows the existing pattern in `db-schema.ts` — a `CREATE TABLE IF NOT EXISTS` plus an `ALTER TABLE` wrapped in a try/catch that ignores "duplicate column".

## Capture flow

The two button handlers (`handleCheckWriting`, `handleChangesSubmit`) are augmented with one extra step before they call `sendMessage`:

1. `POST /api/essays/:id/snapshots` with `{ content: <current draft HTML> }`.
2. The route inserts a row and returns `{ id }`.
3. The client passes `snapshotId` in the `body` of the `sendMessage` call.
4. `/api/chat` reads `snapshotId` from the request body. When persisting the user message via `addMessage`, it also writes `snapshot_id`.

Two requests is fine — separation is clear and the snapshot id is stable on the client before the chat stream starts. No greeting / brainstorm-help / outline-help / free-form-chat path passes `snapshotId`, so those user messages keep a NULL snapshot_id.

A simple re-entry guard (already present for both buttons) covers double-taps; the snapshot POST happens inside the existing guard window.

## Viewing a past version

Left-panel state machine on `WritingScreen`:

- `activeSnapshotId === null` → editor mode (current behavior).
- `activeSnapshotId === <id>` → history mode: editor is replaced by the diff view for that snapshot.

History mode chrome:

- A banner at the top of the left panel: `Viewing earlier draft — <time>    [‹ Prev] [Next ›]   [✕ Back to live]`.
- Tab strip is hidden in history mode (we're not editing; tabs are an edit affordance).
- The right-side chat panel keeps rendering normally; messages stay clickable. The chat input and Check / I've-Made-Changes buttons aren't reachable in history mode because the editor (where those buttons live) is replaced by the diff view; the chat input on the right stays active so the kid can still ask follow-up questions while looking at an old draft.

### Diff rendering

A new `<DiffView prev={...} current={...} />` component:

- Both inputs are HTML strings from the editor.
- Convert each to plain text via `htmlToPlainText`, preserving paragraph breaks as `\n\n`.
- Run `diffWordsWithSpace(prevText, currentText)` from the `diff` (jsdiff) package.
- Render each segment:
  - `added: true` → `<span class="underline decoration-2 decoration-emerald-400 text-emerald-200">`
  - `removed: true` → `<span class="line-through decoration-2 decoration-rose-400 text-rose-300/70">`
  - neither → plain text
- Preserve paragraph breaks by splitting the rendered output on `\n\n` into `<p>` blocks.

Edge cases:

- **First snapshot, no predecessor.** Render the content with no diff colors and a small caption above: `(first version)`.
- **Two adjacent snapshots have identical content.** The diff is empty. Render the content unchanged with a caption: `(no edits between this version and the previous one)`.

Word-level (not character-level) is intentional: easier to read, especially for an 8yo. We don't try to diff HTML structure — paragraph-level visual structure is approximated by the `\n\n` splits, which is enough for a kid's essay.

## Highlighting and navigation

`activeSnapshotId` drives three coordinated behaviors:

1. **Diff view in left panel** (above).
2. **Highlighted user-bubble in chat.** The bubble whose `snapshot_id === activeSnapshotId` gets a ring (`ring-2 ring-amber-400`) and is scrolled into view via `scrollIntoView({ block: "center" })`.
3. **Versions button in editor header** is highlighted as "open."

Sources of `setActiveSnapshotId`:

- Clicking the `📄 view this draft` link inside a user-bubble.
- Prev / Next buttons in the history banner — walk the ordered snapshot list for the essay.
- `📜 Versions` button in the editor header (next to the title) — opens to the most recent snapshot. Hidden when the essay has no snapshots yet.
- `✕ Back to live` button — sets it to null.
- Pressing `Escape` while in history mode — sets it to null.

The ordered snapshot list is loaded once on mount via `GET /api/essays/:id/snapshots` and refreshed locally whenever a new one is created (the snapshot-create POST returns the row, client appends it to the list).

## Linking from chat

User-bubbles render the link only when their underlying message has a non-null `snapshot_id`. The DB-seed path (`getMessages` → `initialMessages`) needs to carry the field through to the client, so:

- `Message` type in `queries.ts` gains `snapshot_id: number | null`.
- The `UIMessage` seed in `writing-screen.tsx` keeps the same shape but the component reads from a parallel map `messageIdToSnapshotId`, populated from `initialMessages` on mount and extended whenever the client sends a new check message (using the snapshot id it just received).

Why a parallel map rather than stuffing the id into the `UIMessage`: AI SDK v6 `UIMessage` doesn't have a clean place for arbitrary metadata, and we don't want to overload `parts`. A small lookup map keyed by message id is cleaner.

For the live in-flight user message during a check: the client knows the snapshot id (from the snapshot POST response) and the message id (from the `useChat` state immediately after `sendMessage` returns). It writes the pair into the map. After the AI response completes, this map entry sticks around for the rest of the session and survives via DB on next load.

## API surface

New routes under `src/app/api/essays/[id]/snapshots/`:

- `POST` — body `{ content: string }`, returns `{ id, created_at }`. Authenticated child only.
- `GET` — returns `{ snapshots: Array<{ id, created_at }> }` ordered by `created_at ASC`. Authenticated child OR parent (parent dashboard could later show snapshots).

`/api/chat` route changes:

- Reads optional `snapshotId` from request body.
- When persisting the user message, passes `snapshotId` through.
- `addMessage` signature in `queries.ts` extended with optional `snapshot_id` parameter.

## Files affected

- `src/lib/db-schema.ts` — add `essay_snapshots` table; add `snapshot_id` migration.
- `src/lib/queries.ts` — `EssaySnapshot` type, `createSnapshot`, `getSnapshots`; extend `Message` with `snapshot_id`; extend `addMessage` to accept it.
- `src/app/api/essays/[id]/snapshots/route.ts` — new file with POST + GET.
- `src/app/api/chat/route.ts` — accept and persist `snapshotId`.
- `src/components/writing-screen.tsx` — `activeSnapshotId` state, history banner, snapshot list state, link rendering on user bubbles, message highlighting, versions button, escape handler.
- `src/components/diff-view.tsx` — new component.
- `package.json` — add `diff` and `@types/diff`.

## Tests

- `db-schema.test.ts` — migration is idempotent; running `initializeDatabase` twice on a fresh DB doesn't throw; running it on a DB that pre-dates the snapshot column adds the column.
- `queries.test.ts` — create/get snapshots; `addMessage` round-trips `snapshot_id` (both NULL and set); `getMessages` returns `snapshot_id`.
- `app/api/essays/[id]/snapshots/route.test.ts` — POST as child writes a row; POST without session returns 401; GET returns rows in chronological order.
- `app/api/chat/route.test.ts` — adds a case: when `snapshotId` is in the body, the persisted user message carries that id.
- `diff-view.test.tsx` — renders strikethrough for removals, underline for additions, "first version" caption when `prev` is null, "no edits" caption when `prev === current`.
- `writing-screen.test.tsx` — clicking the snapshot link enters history mode; left panel shows diff component; ✕ exits; prev/next walk versions; Escape exits; non-snapshot user messages render no link; the highlighted bubble has the ring class.

## Open questions

None remaining — diff direction (prev → this), draft-only snapshots, and the inline-link + prev/next + versions-button trio are all confirmed.
