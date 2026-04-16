export type Tab = "brainstorm" | "outline" | "draft";

export interface LevelDefinition {
  level: number;
  name: string;
  /** One-line summary of the skill being taught. */
  focus: string;
  /** Specific criteria the AI uses to evaluate if an essay passes this level. */
  criteria: string;
  /** Number of essays that must pass at this level to earn it. */
  essaysToPass: number;
  /** Guidance to the AI on how to teach/coach at this level. */
  teachingTip: string;
  /** Which editor tabs are available at this level. */
  availableTabs: Tab[];
  /** Kid-friendly explanation — what this level is about, in Owen's words. */
  kidExplanation: string;
  /** Concrete techniques the AI teaches at this level. */
  techniques: string[];
  /** Short example of writing that would pass at this level. */
  example: string;
  /**
   * Source attribution — which pedagogical framework(s) this level draws
   * from. Surfaced in the info dialog for parents.
   */
  sources: string[];
}

export const LEVELS: LevelDefinition[] = [
  {
    level: 1,
    name: "Sentence Writer",
    focus: "Writing complete sentences that make sense",
    criteria:
      "The essay has at least 3 sentences on the topic. Each sentence is a complete thought — it has a subject and a verb, and it makes sense on its own. No fragments like 'Because I like dogs.'",
    essaysToPass: 3,
    teachingTip:
      "Help the writer check that each sentence has a 'who/what' and an action. If a sentence is a fragment, ask: 'What is the sentence trying to say? Can you make it a whole idea?'",
    availableTabs: ["draft"],
    kidExplanation:
      "A sentence is a whole thought. You'll learn to write sentences that make sense all by themselves. Like 'My dog runs fast' — that's complete!",
    techniques: [
      "Spot sentence fragments (not a complete thought)",
      "Every sentence needs a who/what and an action",
      "Read each sentence aloud to check it sounds complete",
    ],
    example:
      "Dogs are fun. My dog Max runs really fast. He likes to catch balls in the yard.",
    sources: ["Hochman Method — sentence fundamentals"],
  },
  {
    level: 2,
    name: "Sentence Expander",
    focus: "Richer sentences using question words and because/but/so",
    criteria:
      "The essay shows sentence expansion. At least 2 sentences answer multiple questions (who/what/where/when/why/how) about the subject, OR extend an idea using because/but/so.",
    essaysToPass: 3,
    teachingTip:
      "Teach the Hochman 'because / but / so' technique: take a short sentence and extend it three ways. E.g., 'It was raining' → '...because there were clouds' / '...but I went outside anyway' / '...so I brought an umbrella.' Also encourage answering more questions in a sentence.",
    availableTabs: ["draft"],
    kidExplanation:
      "Now your sentences get longer and more interesting. Answer more questions: where? when? why? Or add 'because', 'but', or 'so' to stretch an idea.",
    techniques: [
      "Question-word expansion: add who/what/where/when/why/how",
      "Because, But, So (Hochman B/B/S): three ways to extend any sentence",
      "Turn 'Max runs' into 'Max runs fast in the park every morning because he loves fresh air'",
    ],
    example:
      "My dog Max runs really fast in the park because he loves chasing squirrels. Yesterday he chased a squirrel up a tree, but it was too quick for him. Max got sad, so I gave him a treat.",
    sources: ["Hochman Method — sentence expansion, B/B/S"],
  },
  {
    level: 3,
    name: "Idea Holder",
    focus: "Having one clear main idea throughout the essay",
    criteria:
      "The essay has ONE clear main idea that a reader can identify. All sentences relate to that main idea — no random tangents. If asked 'what is this essay about?', the answer is obvious.",
    essaysToPass: 3,
    teachingTip:
      "Before writing, ask: 'If a friend read this, what ONE thing should they know?' After writing, read each sentence and check: does it support the main idea? If not, consider cutting it.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Your essay should be about ONE thing. Not three things. Pick your favorite thing to say and stay with it.",
    techniques: [
      "State the main idea in one sentence before writing",
      "After writing, ask: does every sentence belong?",
      "Cut sentences that wander off-topic",
    ],
    example:
      "Pizza is the best food. My favorite has pepperoni and lots of cheese. I could eat pizza every day because it's so yummy. I always smile when my mom orders pizza for dinner.",
    sources: ["6+1 Traits — Ideas", "SRSD — main idea focus"],
  },
  {
    level: 4,
    name: "Detail Giver",
    focus: "Supporting the main idea with specific details",
    criteria:
      "The essay includes at least 2 specific supporting details, reasons, or examples for the main idea. 'Details' means concrete — sensory language, examples, numbers, or specific events.",
    essaysToPass: 3,
    teachingTip:
      "Ask: 'What does it LOOK like? SOUND like? TASTE like? How do you KNOW? Can you give me an example?' Give examples on a different topic — never rewrite their sentences.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Now add DETAILS! If you say you love pizza, tell me WHY. What does it taste like? What's on it? Paint a picture with words.",
    techniques: [
      "Use the 5 senses: look, sound, feel, smell, taste",
      "Give specific examples (not 'it was good' — 'the pepperoni was spicy')",
      "Include numbers, names, places, times",
    ],
    example:
      "Pizza is the best food. The crust is crunchy on the outside and soft inside. My favorite topping is pepperoni because it tastes a little spicy. Last weekend I ate three slices at my cousin's birthday party!",
    sources: ["6+1 Traits — Ideas & Details", "Hochman — concrete support"],
  },
  {
    level: 5,
    name: "Order Keeper",
    focus: "Logical sequence — beginning, middle, end",
    criteria:
      "The essay flows in an order that makes sense. It has an opening sentence that sets up the topic and a closing sentence that wraps up. Ideas don't jump around randomly.",
    essaysToPass: 3,
    teachingTip:
      "Ask: 'What should the reader know FIRST? What comes NEXT? How do you want to END?' Teach simple time words (first, then, next, finally). Help them notice if ideas jump around.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Your essay has a beginning (tells what's coming), a middle (the good stuff), and an end (wraps it up). Order matters.",
    techniques: [
      "Time words: first, then, next, after, finally",
      "Opening sentence sets up what the essay is about",
      "Closing sentence gives a final thought",
    ],
    example:
      "Pizza is the best food. At first I didn't like it because the cheese was too hot. Then I tried a small bite and loved the spicy pepperoni. Now every Friday is pizza night at my house, and it's always the best part of my week!",
    sources: ["6+1 Traits — Organization"],
  },
  {
    level: 6,
    name: "Sentence Combiner",
    focus: "Combining short sentences into stronger ones",
    criteria:
      "The essay shows sentence combining. At least 2 places where two short ideas have been joined into one sentence using 'and', 'but', 'because', 'so', 'when', 'if', 'although', or similar.",
    essaysToPass: 4,
    teachingTip:
      "When you see choppy sentences ('Max ran. He got tired.'), suggest combining: 'Could those be one sentence? Max ran SO fast he got tired.' Teach subordinating conjunctions: because, although, since, while, when, if.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Too many short sentences sound choppy. You'll learn to glue them together into stronger sentences. 'Max ran. He got tired.' → 'Max ran so fast he got tired.'",
    techniques: [
      "Combine with and / but / or / so",
      "Combine with because / although / since / while / when / if",
      "Make sentences flow instead of sounding like a list",
    ],
    example:
      "My dog Max loves the park because he can run as fast as he wants. Yesterday when I threw his ball, he leapt into the air and caught it in his mouth. I laughed so hard I almost fell over!",
    sources: ["Hochman Method — sentence combining"],
  },
  {
    level: 7,
    name: "Paragraph Builder",
    focus: "Paragraphs with topic sentences, details, and a concluding sentence",
    criteria:
      "The essay has at least one well-built paragraph with (1) a clear TOPIC SENTENCE at the start that says what the paragraph is about, (2) 2-3 supporting details in the middle, and (3) a CONCLUDING SENTENCE at the end that wraps the paragraph up.",
    essaysToPass: 4,
    teachingTip:
      "Teach the Single-Paragraph Outline (SPO) from Hochman: before writing, plan the topic sentence, 2-3 supporting points, and a concluding sentence. Use within-paragraph transitions: 'for example', 'also', 'another reason'.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "A paragraph is a team of sentences about the same thing. Start with a topic sentence (what it's about), add details, end with a closing sentence. Like a sandwich: top, middle, bottom.",
    techniques: [
      "SPO (Single-Paragraph Outline): plan topic → details → conclusion before writing",
      "Topic sentence: first sentence announces what the paragraph is about",
      "Concluding sentence: last sentence wraps up THIS paragraph (different from the essay's final sentence)",
      "Within-paragraph transitions: for example, also, another reason, first/second/finally",
    ],
    example:
      "Pizza is the best food in the world. First, the crust is perfect — crunchy outside, soft inside. Second, you can put any topping you want on it. Finally, it tastes even better the next morning for breakfast. That's why pizza will always be my favorite.",
    sources: ["Hochman Method — Single-Paragraph Outline (SPO)"],
  },
  {
    level: 8,
    name: "Word Chooser",
    focus: "Using vivid, precise words instead of bland ones",
    criteria:
      "The essay uses at least 2-3 vivid or specific words where a bland word would also have worked. Examples: 'enormous' instead of 'big', 'sprinted' instead of 'went', 'crimson' instead of 'red'.",
    essaysToPass: 4,
    teachingTip:
      "Point to a generic word and ask: 'What EXACTLY do you mean? Is there a more interesting word?' Give examples on a different topic. Teach that weak words ('good', 'nice', 'big', 'went') have more vivid alternatives.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Instead of 'nice' or 'big' or 'good', use more exact words. 'Enormous' is better than 'big'. 'Sprinted' is better than 'went fast'. Your words should be PICTURES.",
    techniques: [
      "Replace bland words: good → fantastic/incredible; big → enormous/gigantic; went → sprinted/wandered",
      "Use sensory language: not just 'loud' but 'thunderous'",
      "Be specific: not 'food' — 'pepperoni pizza'",
    ],
    example:
      "Pizza isn't just good — it's magnificent. The pepperoni sizzles on top of the melted, gooey mozzarella. Every bite crunches, then melts on your tongue. The smell alone makes your stomach growl.",
    sources: ["6+1 Traits — Word Choice"],
  },
  {
    level: 9,
    name: "Sentence Varier",
    focus: "Mixing sentence lengths, types, and structures",
    criteria:
      "The essay shows sentence variety — mixing short and long sentences, different sentence starts, AND at least one appositive (extra info set off with commas) OR a complex sentence with a subordinating conjunction.",
    essaysToPass: 4,
    teachingTip:
      "Notice if sentences all sound the same length/rhythm. Teach appositives: 'My dog, a golden retriever, loves treats.' Encourage starting sentences different ways (not always with the subject).",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Too many long sentences? Boring. Too many short ones? Choppy. Mix them up! Also, add extra info with commas — like this: 'My dog, a golden retriever, loves treats.'",
    techniques: [
      "Appositives: 'Max, my dog, loves the park.'",
      "Mix short punchy sentences with longer flowing ones",
      "Vary sentence starts (don't always begin with the subject)",
      "Try complex sentences: 'Although I was tired, I kept writing.'",
    ],
    example:
      "Pizza is magnificent. The crust, a golden disc of crunchy goodness, is the foundation. On top, melted cheese stretches into gooey strings when you pull a slice away. Some people like their pizza plain, but I always pick pepperoni. It's the best.",
    sources: ["6+1 Traits — Sentence Fluency", "Hochman — appositives"],
  },
  {
    level: 10,
    name: "Summarizer",
    focus: "Saying what you mean concisely — no wasted words",
    criteria:
      "The essay says its ideas clearly without unnecessary repetition or filler. If the same idea appears twice, one version has been removed. Every sentence earns its place.",
    essaysToPass: 4,
    teachingTip:
      "After review, ask: 'Is there anything you said twice? Any sentence that could be cut without losing meaning?' Teach that summarizing means capturing the main idea in fewer words.",
    availableTabs: ["brainstorm", "draft"],
    kidExplanation:
      "Say what you mean without extra words. If you already said something, don't say it again in different words. Make every sentence count.",
    techniques: [
      "Identify main ideas vs. filler",
      "Cut repeated ideas (you don't need to say pizza is great three times)",
      "Say more with fewer words",
    ],
    example:
      "Pizza is amazing because it combines three perfect things: crunchy crust, gooey cheese, and salty toppings. Every bite delivers all three at once. No other food does that. That's why pizza wins.",
    sources: ["Hochman Method — summarizing"],
  },
  {
    level: 11,
    name: "Essay Builder",
    focus: "A real multi-paragraph essay — introduction, body, conclusion",
    criteria:
      "The essay has at least 3 paragraphs: (1) an INTRODUCTION that sets up the topic and states the main idea, (2) at least 1-2 BODY paragraphs each with its own point and supporting details, (3) a CONCLUSION that wraps up meaningfully. Paragraphs are connected with transitions.",
    essaysToPass: 5,
    teachingTip:
      "Teach the Multi-Paragraph Outline (MPO): plan intro, body 1, body 2, body 3, conclusion BEFORE drafting. Use the Outline tab! Introduce the genre strategy: TREE for opinion (Topic sentence, Reasons, Explain, Ending), W-W-W for narrative (Who/Where/When/What wants/What happens/How ends/How feels), Q&A structure for informational. Teach paragraph-to-paragraph transitions: 'Another reason...', 'In addition...', 'On the other hand...'",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "Now you'll write a REAL essay. Not one paragraph — several paragraphs that work as a team. Introduction, body paragraphs, conclusion. This is what grown-ups write.",
    techniques: [
      "MPO (Multi-Paragraph Outline) — plan every paragraph before drafting",
      "Opinion essays: TREE — Topic sentence, Reasons (3), Explain each, Ending (SRSD)",
      "Narrative essays: W-W-W, What=2, How=2 — Who, Where, When, What wants, What happens, How ends, How feels (SRSD)",
      "Informational essays: Question-Answer structure",
      "Paragraph transitions: Another reason, In addition, On the other hand, For instance",
    ],
    example:
      "(Full 3-5 paragraph essay with clear intro / body / conclusion structure.)",
    sources: ["Hochman Method — MPO", "SRSD — TREE, W-W-W strategies"],
  },
  {
    level: 12,
    name: "Essay Polish",
    focus: "Compelling hooks, sharp thesis statements, meaningful conclusions",
    criteria:
      "The essay has (1) a HOOK that grabs attention in the first sentence (question, surprising fact, vivid scene, or bold claim — not just 'This essay is about...'), (2) a clear THESIS that makes a specific arguable claim (not just 'Pizza is great'), and (3) a CONCLUSION that says something meaningful — connects back, offers an insight, or leaves the reader thinking — not just restating the intro.",
    essaysToPass: 5,
    teachingTip:
      "Teach hook types (question, fact, scene, claim). Show that a weak thesis is obvious ('Pizza is great') while a strong thesis is specific and arguable ('Pizza is the best food because it balances flavor, texture, and flexibility'). Conclusions shouldn't restate — they should resolve.",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "Your first sentence should grab the reader. Your thesis should make a real claim someone might disagree with. Your ending should feel like it matters — not just 'and that's why pizza is great.'",
    techniques: [
      "Hook types: compelling question, surprising fact, vivid scene, bold claim",
      "Thesis: specific AND arguable (not obvious)",
      "Conclusion: circle back to the hook, offer insight, or issue a challenge — don't just restate",
    ],
    example:
      "(Essay showing a strong hook, arguable thesis, and meaningful closing.)",
    sources: ["Academic writing craft", "6+1 Traits — Organization"],
  },
  {
    level: 13,
    name: "Voice Finder",
    focus: "Writing that sounds like YOU — authentic personal voice",
    criteria:
      "The writing has personality. It includes opinions, unique phrasings, humor, or emotion that makes it sound like the writer, not a template. Reading it, you can feel the writer's perspective.",
    essaysToPass: 5,
    teachingTip:
      "Ask: 'How would YOU say this if you were chatting with a friend? What do YOU think about this?' Encourage unexpected comparisons, personal reactions, and genuine emotion.",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "Imagine telling this to a friend at recess. That's your voice. Write with your own personality — your humor, your opinions, your way of seeing things.",
    techniques: [
      "Write like you'd talk to a friend (not a textbook)",
      "Include your own reactions and feelings",
      "Make unexpected comparisons",
      "Don't be afraid to sound like yourself",
    ],
    example:
      "(Essay showing a distinct personal voice, humor, or genuine feeling.)",
    sources: ["6+1 Traits — Voice"],
  },
  {
    level: 14,
    name: "Evidence & Counter-Argument",
    focus: "Supporting claims with strong evidence and addressing opposing views",
    criteria:
      "Claims are supported with at least 2 pieces of specific evidence (examples, facts, data, expert views, or clear reasoning). The essay acknowledges at least one possible counter-argument and responds to it (either rebutting it or acknowledging its partial truth).",
    essaysToPass: 6,
    teachingTip:
      "Teach the SRSD STOP+DARE strategy for argumentative writing: Suspend judgment (consider both sides), Take a side, Organize ideas, Plan more as you write + Develop topic sentence, Add supporting ideas, Reject opposing arguments (acknowledge & rebut), End with a conclusion. Emphasize that strong writers don't ignore opposing views — they address them.",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "Some people might disagree with you. What would THEY say? Answer their point. Use real evidence — examples, facts, logic. Strong writers don't ignore the other side.",
    techniques: [
      "STOP+DARE (SRSD): Suspend, Take a side, Organize, Plan + Develop, Add, Reject (rebut), End",
      "Types of evidence: examples, data, expert views, logical reasoning",
      "Acknowledging the other side makes YOUR argument stronger",
      "'Some people say X, but actually Y because Z.'",
    ],
    example:
      "(Argumentative essay with evidence and a clearly addressed counter-argument.)",
    sources: ["SRSD — STOP+DARE strategy"],
  },
  {
    level: 15,
    name: "Reviser",
    focus: "True revision — not just editing, but rethinking",
    criteria:
      "There is clear evidence of revision beyond surface edits. Paragraphs have been restructured, weak sentences strengthened, unnecessary content cut, or arguments sharpened. Not just spelling/punctuation fixes.",
    essaysToPass: 6,
    teachingTip:
      "Teach the distinction: REVISING is big changes (structure, argument, clarity); EDITING is small fixes (typos, punctuation). Encourage reading aloud to find weak spots. Teach 'murder your darlings' — cut what doesn't serve the essay, even if you liked writing it.",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "Revising means making BIG changes to make your essay better. Cut stuff that doesn't work. Move paragraphs around. Rewrite weak sentences. This is where good writing becomes great writing.",
    techniques: [
      "Revision (big changes) vs. editing (small fixes) — know the difference",
      "Read aloud to find weak spots",
      "'Murder your darlings' — cut what doesn't serve the essay",
      "Restructure paragraphs; move ideas for better flow",
    ],
    example:
      "(A second draft showing substantial improvement over the first.)",
    sources: ["Writing process research", "Donald Graves — revision"],
  },
  {
    level: 16,
    name: "Master Writer",
    focus: "All skills combined, consistently, with polish",
    criteria:
      "The essay demonstrates all prior skills working together smoothly — strong ideas, clear structure, vivid words, varied sentences, a compelling opening and closing, authentic voice, well-supported argument, and evidence of careful revision. This is writing anyone — adult or child — would be proud of.",
    essaysToPass: 7,
    teachingTip:
      "At this level, give lighter guidance. Ask: 'Is there anything YOU think could be better?' Trust the writer's instincts. Celebrate their growth. This is metacognitive territory — writers thinking about their own writing.",
    availableTabs: ["brainstorm", "outline", "draft"],
    kidExplanation:
      "You're a real writer now. You know how to do ALL of this. Keep doing it — write essays you're genuinely proud of. You've earned it.",
    techniques: [
      "Self-assessment across all prior skills",
      "Metacognition: thinking about your own thinking & writing",
      "Trust your instincts as a writer",
    ],
    example:
      "(A polished, adult-level essay that combines all prior skills.)",
    sources: ["All prior frameworks combined"],
  },
];

export function getLevel(level: number): LevelDefinition {
  return LEVELS[level - 1] ?? LEVELS[0];
}

export const WRITING_TYPES = [
  {
    id: "opinion" as const,
    name: "Opinion",
    icon: "💬",
    description: "Share what you think and why",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/30",
    progressColor: "bg-yellow-400",
  },
  {
    id: "creative" as const,
    name: "Creative",
    icon: "🎨",
    description: "Tell stories and describe things",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/30",
    progressColor: "bg-green-400",
  },
  {
    id: "informational" as const,
    name: "Informational",
    icon: "📚",
    description: "Explain and teach about something",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/30",
    progressColor: "bg-blue-400",
  },
] as const;

export type WritingType = (typeof WRITING_TYPES)[number]["id"];
