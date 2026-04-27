/**
 * Regression test for the Capitalizer (Level 5) prompt.
 *
 * Builds the EXACT message structure the chat route sends — same system
 * prompt, same context block, same conversation history shape — then runs
 * each scenario through the configured model. Use this before changing the
 * Capitalizer prompt or the chat-route model to make sure the four classic
 * failure modes haven't come back:
 *   1. Asking Owen to capitalize "sushi" as if it were a brand.
 *   2. Asking whether already-capital "Fruit" needs a capital.
 *   3. Failing to call markEssayReady when the essay is already correct.
 *   4. Missing a real lowercase 'i' that does need a capital.
 *
 * Run (default model is haiku for stress; override via MODEL=...):
 *   set -a; source .vercel/.env.development.local; set +a
 *   MODEL=anthropic/claude-opus-4.7 \
 *     pnpm exec tsx scripts/test-capitalizer-prompt.ts
 */
import { generateText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { buildSystemPrompt, buildContextMessage } from "../src/lib/prompts";

const TOOLS = {
  markEssayReady: tool({
    description:
      "Call this tool when the draft essay meets ALL criteria for the current level and all prior levels. This makes a 'Mark as Complete' button appear for the student.",
    inputSchema: z.object({
      reason: z
        .string()
        .describe(
          "A warm 2-3 sentence congratulation: call them by name, name the specific thing they did well for this level's skill, and invite them to click 'Mark as Complete'."
        ),
    }),
  }),
};

const MODEL = process.env.MODEL ?? "anthropic/claude-haiku-4.5";

// The exact draft Owen had when Sonnet started asking nonsensical
// capitalization questions.
const DRAFT =
  "I love food but don't eat to much or you will be fat. Fruit and veggies are the best for you. My favorite food is sushi because I like fish.";

// Full prior conversation: greeting → first review → Owen says he made
// changes. Mirrors what useChat would send on the third turn.
const PRIOR_MESSAGES: ModelMessage[] = [
  {
    role: "user",
    content: "I want to write about: My favorite foods",
  },
  {
    role: "assistant",
    content:
      "Hi Owen! 'My favorite foods' is a fun topic. What do you want to say about it?",
  },
  {
    role: "user",
    content: "Please check my writing!",
  },
];

interface Scenario {
  name: string;
  /** What the assistant said last — usually a leading question about caps. */
  priorAssistant: string;
  /** What Owen replied with after editing. */
  userTurn: string;
  /** The current draft to put in the context block. */
  draft: string;
  /** What we expect the model to do (qualitatively). */
  expectation: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: "Sushi is not a brand — model should NOT ask Owen to capitalize it",
    priorAssistant:
      "Owen, I love that you wrote about food! Now let me check the capitals. Looking at your draft, every sentence starts with a capital — that's awesome! Let me look one more time.",
    userTurn: "Please check my writing!",
    draft: DRAFT,
    expectation:
      "Should not flag 'sushi' for capitalization. Sushi is a common food, not a proper noun.",
  },
  {
    name: "Fruit is already capitalized — model should NOT ask Owen to verify",
    priorAssistant:
      "Owen, I noticed the start of your second sentence: 'fruit and veggies are the best for you.' Should 'fruit' have a capital, since it's the start of a sentence?",
    userTurn: "I've made changes! Can you check again?",
    draft: DRAFT,
    expectation:
      "Should praise that 'Fruit' is now capitalized. Should NOT ask 'does Fruit start with a capital?' because it clearly does.",
  },
  {
    name: "Whole essay is capitalized correctly — model should mark it ready",
    priorAssistant:
      "Owen, you started 'I love food' with a capital I — perfect! Let me check the rest of your essay.",
    userTurn: "I've made changes! Can you check again?",
    draft: DRAFT,
    expectation:
      "All sentences start with capitals. 'I' is capital. 'Sushi' is a common food and stays lowercase. The essay passes Capitalizer. Should call markEssayReady (or at least praise + offer completion).",
  },
  {
    name: "Real lowercase issue — model SHOULD flag the lowercase 'i'",
    priorAssistant:
      "Hi Owen! Let's see what you've got. I'll read your draft and check the capitalization.",
    userTurn: "Please check my writing!",
    // Same essay but with the second 'I' lowercased.
    draft:
      "I love food but don't eat to much or you will be fat. Fruit and veggies are the best for you. My favorite food is sushi because i like fish.",
    expectation:
      "Should ask Owen to check the lowercase 'i' in the third sentence ('because i like fish'). Should NOT call markEssayReady.",
  },
];

async function runScenario(scenario: Scenario): Promise<void> {
  console.log("\n" + "=".repeat(78));
  console.log("SCENARIO:", scenario.name);
  console.log("EXPECT:  ", scenario.expectation);
  console.log("=".repeat(78));

  const systemPrompt = buildSystemPrompt({
    writingType: "opinion",
    currentLevel: 5,
  });

  const contextBlock = buildContextMessage({
    currentLevel: 5,
    currentStep: scenario.userTurn.includes("made changes") ? "revise" : "review",
    activeTab: "draft",
    essayContent: scenario.draft,
    essayTitle: "My favorite foods",
    brainstormNotes: "",
    outline: "",
  });

  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        "(Context: The student's name is Owen. Use this name naturally when greeting or celebrating.)",
    },
    ...PRIOR_MESSAGES,
    { role: "assistant", content: scenario.priorAssistant },
    {
      role: "user",
      content: [
        { type: "text", text: contextBlock },
        { type: "text", text: scenario.userTurn },
      ],
    },
  ];

  const result = await generateText({
    model: MODEL,
    messages,
    tools: TOOLS,
  });

  console.log("MODEL RESPONSE:");
  console.log(result.text);
  if (result.toolCalls.length > 0) {
    console.log("\nTOOL CALLS:");
    for (const tc of result.toolCalls) {
      console.log(`  - ${tc.toolName}:`, JSON.stringify(tc.input));
    }
  }
  console.log(
    `\nTOKENS: input=${result.usage.inputTokens}, output=${result.usage.outputTokens}`
  );
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error(
      "Set AI_GATEWAY_API_KEY (preferred) or VERCEL_OIDC_TOKEN before running."
    );
    process.exit(1);
  }

  for (const scenario of SCENARIOS) {
    try {
      await runScenario(scenario);
    } catch (err) {
      console.error("FAILED:", err);
    }
  }
}

main();
