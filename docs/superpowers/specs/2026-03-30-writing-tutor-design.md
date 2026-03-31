# Writing Tutor — Design Spec

## Goal

An AI-powered writing tutor for Owen (age 8, dyslexic) that guides him through writing essays step-by-step, gives coaching feedback (never writes for him), and tracks his progress through skill-tree levels across multiple writing types.

## Target Users

- **Owen** — 8-year-old dyslexic writer. Primary user.
- **Parents (Rob & wife)** — oversight dashboard, settings control, read essays.
- **Initial auth** — single hard-coded username/password. Multi-user later if it works well.

## Competitive Context

No existing product combines AI coaching + dyslexia-friendly design + progression/leveling + built-in editor for ages 6-12. Night Zookeeper is closest but uses human tutors and lacks dyslexia features. This is a genuinely underserved niche.

---

## Architecture

### Three Actors

- **Owen** — writes essays, interacts with the tutor
- **The Tutor (AI)** — guides through step-by-step writing, gives feedback, evaluates essays
- **Parents** — view progress, read essays, toggle settings

### Core Concepts

- **Writing Types** — Opinion, Creative/Narrative, Informational. All available from the start.
- **Skill Trees** — Each writing type has its own independent progression track.
- **Levels** — Same 10 level definitions across all writing types, evaluated in context of the writing type. See Level System section.
- **Essays** — Belong to a writing type, tied to the level Owen was working on. Status: in-progress or completed.
- **Writing Sessions** — Each essay has a conversation history with the tutor, organized as a step-by-step guided flow.

---

## Level System

Ten levels, same definitions across all writing types. Each level focuses on one writing skill while maintaining all previous skills. The number of essays needed to pass increases at higher levels.

| Level | Name | Focus | Passing Criteria | Essays to Pass |
|-------|------|-------|------------------|----------------|
| 1 | Story Starter | Writing complete sentences that make sense | 3+ sentences on topic, each a complete thought | 3 |
| 2 | Idea Builder | Having a clear main idea | Essay has one clear point/topic the reader can identify | 3 |
| 3 | Detail Adder | Supporting ideas with details, examples, or reasons | At least 2 supporting details for the main idea | 3 |
| 4 | Order Maker | Logical sequence — beginning, middle, end | Essay flows in an order that makes sense, has an opening and closing | 3 |
| 5 | Word Chooser | Using interesting/specific words instead of generic ones | Replaces bland words with vivid ones (e.g., "nice" → "cozy") | 4 |
| 6 | Connector | Using linking words (because, also, however, then) | Sentences connect to each other, not just a list | 4 |
| 7 | Voice Finder | Developing a personal writing style/voice | Writing sounds like Owen, not like a template | 4 |
| 8 | Editor | Self-revision — catching and fixing own mistakes | Can identify and fix issues when prompted | 4 |
| 9 | Persuader | Writing to convince — arguments and evidence | Can make a case for something with reasons | 5 |
| 10 | Writer | Combining all skills fluently | Consistently produces well-structured, engaging writing | 5 |

### Leveling Mechanics

- The AI evaluates each completed essay against the current level's criteria (plus all prior levels).
- An essay "passes" when it meets the criteria. The AI guides the child through revisions until it does.
- The AI never fails an essay harshly — it says "this is great, let's make it even better by..."
- After enough passing essays at a level, Owen earns that level and unlocks the next.
- Each writing type progresses independently (e.g., Level 3 in Opinion, Level 1 in Creative).

---

## Guided Writing Flow

Each essay follows a step-by-step process. At early levels the tutor walks through every step explicitly. At higher levels, steps 2-3 become lighter as Owen internalizes the process.

### Steps

1. **Pick a topic** — Owen chooses freely. The tutor can offer personalized suggestions based on his writing history, but Owen is always in control.
2. **Brainstorm** — Tutor asks "what do you know about this topic?" and helps Owen generate ideas through questions.
3. **Organize** — Tutor helps Owen put ideas in order (beginning/middle/end) through guided questions.
4. **Draft** — Owen writes in the editor. Tutor encourages but doesn't interrupt. Tutor offers a relevant tip for the current level's skill.
5. **Review** — Triggered when Owen clicks "Check My Writing!" Tutor reads the essay and gives one suggestion at a time, focused on the current level's skill.
6. **Revise** — Owen edits based on feedback. Can click "I've Made Changes!" to re-submit. Can ask for clarification.
7. **Complete** — When the essay meets the level criteria, tutor celebrates and the essay joins Owen's collection.

### Step Progress Bar

Visible in the tutor panel. Shows: Topic → Ideas → Plan → Write → Review → Edit → Done! Current step highlighted. Labels visible below the bar.

### Abandoning an Essay

Owen can leave an essay at any time by going back to the home screen. The essay stays in "in-progress" status and he can return to it later. He can also start a new essay without finishing the current one. There is no penalty for abandoning essays — the tutor should be encouraging when Owen returns ("Welcome back! Ready to keep working on your robot essay?"). Parents can see abandoned essays in the dashboard.

### Premature "Check My Writing!"

If Owen clicks "Check My Writing!" before writing enough (e.g., only one sentence), the tutor doesn't reject it — instead it gently encourages: "Great start! You've got one sentence so far. Can you add a couple more sentences to give me more to work with?" This keeps the experience positive.

---

## AI Tutor Behavior

### Persona

A warm, enthusiastic writing buddy. Like a friendly older cousin who loves writing. Short sentences, simple vocabulary, genuinely encouraging.

### Interaction Rules

1. **Praise first** — Every response finds something genuinely good before suggesting anything.
2. **One suggestion at a time** — Never overwhelm. Pick the single most impactful improvement for the current level.
3. **Examples on different topics only** — "If I was writing about my dog, I might say..." Never rewrite Owen's sentences.
4. **Ask guiding questions** — "What did that look like?" rather than "Add a description here."
5. **Short messages** — No walls of text. 2-3 short sentences maximum per message.
6. **Ideas before mechanics** — Focus on content/structure first. Only address spelling/grammar after ideas and structure are solid, and even then gently.
7. **No red-pen language** — Never say "wrong", "incorrect", "error". Use "what if...", "try...", "I wonder..."
8. **Celebrate progress** — Level-specific praise that names the skill ("You're getting really good at adding details!")

### System Prompt Strategy

The system prompt includes:
- The tutor persona definition and interaction rules above
- The current level's criteria and what to look for
- All prior levels' criteria (cumulative — the AI checks these too)
- The writing type context (opinion vs creative vs informational)
- Owen's essay content
- The current step in the guided flow
- The conversation history for this essay
- Instructions for the current step (e.g., during Brainstorm: ask about what Owen knows; during Review: evaluate against level criteria)

### Quick-Action Buttons

Contextual buttons below the chat input that change per step:
- **Draft**: "I'm stuck", "Give me an idea", "What's next?"
- **Review**: "Show me an example", "I don't understand", "Can I try something different?"
- **Revise**: "I've made changes!", "I need more help", "What else should I fix?"

---

## UI Design

### Main Writing Screen (core screen)

Side-by-side layout:
- **Left: Text Editor** — essay title, writing type & step badges, the editor area (Tiptap rich text), "Hear My Essay" button, word count, and the prominent "Check My Writing!" button (purple, glowing, bottom-right).
- **Right: Tutor Panel** — tutor avatar & name, current skill label, step progress bar with labels, tutor messages, tips in green boxes (examples on different topics), "Hear this advice" button, chat input, and contextual quick-action buttons.

### Home Screen

- Welcome message with "New Essay" button
- Three skill tree cards showing writing type, current level name, progress bar, essays completed
- Essay collection list: in-progress essays (yellow dot) and completed essays (green check), with title, writing type, level, date

### New Essay Flow

When Owen clicks "New Essay":
1. Pick a writing type (Opinion / Creative / Informational) — three big cards
2. Enter a topic (free text input) or pick from tutor suggestions
3. Goes directly into the guided writing flow at Step 1 (Brainstorm)

### Level Up Screen

Full-screen celebration:
- Large animated star
- "LEVEL UP!" header with gradient
- Level name and skill explanation framed as a "superpower"
- Stars showing overall progress (filled for earned levels)
- Preview of what's next
- "Keep Writing!" button

### Parent Dashboard

Accessed via separate login (or toggle in header):
- Summary stats: total essays, total levels earned, writing streak
- Skill levels at a glance for each writing type
- Clickable list of recent essays (opens read-only view of essay + tutor conversation)
- Settings toggles: text-to-speech for essays, text-to-speech for tutor, dyslexia-friendly font

### Dyslexia-Friendly Design

- Default clean sans-serif font (Lexie Readable or similar). Optional OpenDyslexic toggle in parent settings.
- Large text (16px+ minimum), generous line spacing (1.8+)
- Warm dark theme: dark grays with warm cream text. Not pure black-on-white.
- Left-aligned text only (never justified)
- Minimal UI chrome, clear big buttons
- No red for errors — gentle blue/gold highlights
- Text-to-speech on both essay and tutor messages (toggleable by parents)

---

## Data Model

```
User {
  id: string
  name: string
  role: "child" | "parent"
  createdAt: datetime
}

WritingType: "opinion" | "creative" | "informational"

SkillProgress {
  id: string
  userId: string
  writingType: WritingType
  currentLevel: number (1-10)
  essaysCompletedAtLevel: number
  levelEarnedAt: datetime | null
}

Essay {
  id: string
  userId: string
  title: string
  content: string (HTML from Tiptap)
  writingType: WritingType
  level: number
  currentStep: "topic" | "brainstorm" | "organize" | "draft" | "review" | "revise" | "complete"
  status: "in-progress" | "completed"
  wordCount: number
  createdAt: datetime
  updatedAt: datetime
  completedAt: datetime | null
}

Message {
  id: string
  essayId: string
  role: "user" | "assistant"
  content: string
  step: string (which writing step this message was sent during)
  createdAt: datetime
}

Settings {
  userId: string
  ttsEssay: boolean (default true)
  ttsTutor: boolean (default true)
  dyslexiaFont: boolean (default false)
}
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Full-stack React, server components, server actions, zero-config Vercel deploy |
| UI Components | shadcn/ui + Tailwind CSS | Clean, customizable components. Fully own the source for dyslexia-friendly theming. |
| Text Editor | Tiptap | Rich text editor for React. Extensible, good accessibility, well-maintained. |
| AI | AI SDK v6 + AI Gateway | `streamText` for tutor responses. AI Gateway for model routing, cost tracking, OIDC auth. |
| Model | `anthropic/claude-sonnet-4-5` via AI Gateway | Strong at nuanced, empathetic instruction. Good at following persona constraints. |
| Database | SQLite via better-sqlite3 | Simple, no external service needed. Single file. Sufficient for single-family use. Migrate to Postgres/Turso if multi-user later. |
| Text-to-Speech | Web Speech API (browser built-in) | Free, works offline, no extra dependency. |
| Hosting | Vercel | Zero-config Next.js deploy, AI Gateway integration, OIDC for AI auth. |
| Auth | Hard-coded credentials check | Simple middleware. `CHILD_PASSWORD` and `PARENT_PASSWORD` env vars. Migrate to Clerk if multi-user later. |

### AI Gateway Setup

- Run `vercel link` → enable AI Gateway in dashboard → `vercel env pull` for OIDC credentials
- Use plain model strings: `model: 'anthropic/claude-sonnet-4-5'`
- No provider-specific API keys needed

---

## Auth Design

Two roles, two passwords:

- **Child login**: username "owen", password from `CHILD_PASSWORD` env var. Sees writing screen and home.
- **Parent login**: username "parent", password from `PARENT_PASSWORD` env var. Sees parent dashboard + can also see Owen's screens in read-only mode.

Stored as a session cookie. Simple middleware checks the cookie on each request. No user registration, no email, no OAuth for the MVP.

---

## Screens Summary

| Screen | Route | Who sees it |
|--------|-------|-------------|
| Login | `/login` | Everyone |
| Home | `/` | Owen |
| New Essay (type picker) | `/essays/new` | Owen |
| Writing Screen | `/essays/[id]` | Owen |
| Level Up | `/essays/[id]/level-up` | Owen |
| Parent Dashboard | `/parent` | Parents |
| Essay Viewer (read-only) | `/parent/essays/[id]` | Parents |

---

## Build Phases

### Phase 1 — MVP

Everything needed for Owen to start using it:

- Next.js app with hard-coded auth (child + parent logins)
- Home screen with skill trees and essay list
- New essay flow (pick type → enter topic)
- Writing screen with Tiptap editor + AI tutor panel
- Guided writing flow (all 7 steps)
- "Check My Writing!" button triggering AI review
- Levels 1-5 (Story Starter through Word Chooser)
- Level-up celebration screen
- Text-to-speech (browser Web Speech API) for essay and tutor
- Parent dashboard (read essays, see progress, toggle settings)
- SQLite database
- Deploy to Vercel

### Phase 2 — Polish (after Owen has used it for a few weeks)

- Levels 6-10
- Tutor suggests topics based on Owen's history
- Dyslexia font toggle (OpenDyslexic)
- Writing streak tracking
- Improve AI prompts based on observed interactions
- Refine level criteria based on what's working

### Phase 3 — Multi-user (if it works well)

- Clerk auth replacing hard-coded passwords
- Neon Postgres replacing SQLite
- Per-child profiles
- Teacher/parent admin view
- Onboarding flow for new users
