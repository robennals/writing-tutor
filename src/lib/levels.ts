export type Tab = "brainstorm" | "outline" | "draft";

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

/** The fields of a level that can vary by writing type. */
export interface LevelContent {
  /** Specific criteria the AI uses to evaluate if an essay passes this level. */
  criteria: string;
  /** Guidance to the AI on how to teach/coach at this level. */
  teachingTip: string;
  /** Kid-friendly explanation — what this level is about, in the child's own words. */
  kidExplanation: string;
  /** Concrete techniques the AI teaches at this level. */
  techniques: string[];
  /** Short example of writing that would pass at this level. */
  example: string;
}

export interface LevelDefinition {
  level: number;
  name: string;
  /** One-line summary of the skill being taught. */
  focus: string;
  /** Number of essays that must pass at this level to earn it. */
  essaysToPass: number;
  /** Which editor tabs are available at this level. */
  availableTabs: Tab[];
  /**
   * Source attribution — which pedagogical framework(s) this level draws
   * from. Surfaced in the info dialog for parents.
   */
  sources: string[];
  /**
   * Shared content used when this level's skill does not vary by writing
   * type (e.g. mechanics like spelling or capitalization).
   */
  content?: LevelContent;
  /**
   * Per-writing-type content for levels whose skill takes a different
   * shape depending on genre (e.g. structural levels like Order Keeper,
   * Paragraph Builder, Essay Builder).
   */
  byGenre?: Record<WritingType, LevelContent>;
}

export const LEVELS: LevelDefinition[] = [
  {
    level: 1,
    name: "Sentence Writer",
    focus: "Writing complete sentences that make sense",
    essaysToPass: 3,
    availableTabs: ["draft"],
    sources: ["Hochman Method — sentence fundamentals"],
    content: {
      criteria:
        "The essay has at least 3 sentences on the topic, and each sentence says something different (restating the same idea in new words does not count). Each sentence is a complete thought — it has a subject and a verb, and makes sense on its own. Sentences that start with a subordinating conjunction like 'because', 'but', 'so', or 'and' as a standalone punctuated sentence are fragments and do NOT count (e.g., 'Because I like dogs.' or 'so I think it is fun.').",
      teachingTip:
        "Help the writer check that each sentence has a 'who/what' and an action. If a sentence is a fragment, ask: 'What is the sentence trying to say? Can you make it a whole idea?'",
      kidExplanation:
        "A sentence is a whole thought. You'll learn to write sentences that make sense all by themselves. Like 'My dog runs fast' — that's complete!",
      techniques: [
        "Spot sentence fragments (not a complete thought)",
        "Every sentence needs a who/what and an action",
        "Read each sentence aloud to check it sounds complete",
      ],
      example:
        "Dogs are fun. My dog Max runs really fast. He likes to catch balls in the yard.",
    },
  },
  {
    level: 2,
    name: "Sentence Expander",
    focus: "Richer sentences using question words and because/but/so",
    essaysToPass: 3,
    availableTabs: ["draft"],
    sources: ["Hochman Method — sentence expansion, B/B/S"],
    content: {
      criteria:
        "The essay shows sentence expansion. At least 2 sentences answer multiple questions (who/what/where/when/why/how) about the subject, OR extend an idea using because/but/so.",
      teachingTip:
        "Teach the Hochman 'because / but / so' technique: take a short sentence and extend it three ways. E.g., 'It was raining' → '...because there were clouds' / '...but I went outside anyway' / '...so I brought an umbrella.' Also encourage answering more questions in a sentence.",
      kidExplanation:
        "Now your sentences get longer and more interesting. Answer more questions: where? when? why? Or add 'because', 'but', or 'so' to stretch an idea.",
      techniques: [
        "Question-word expansion: add who/what/where/when/why/how",
        "Because, But, So (Hochman B/B/S): three ways to extend any sentence",
        "Turn 'Max runs' into 'Max runs fast in the park every morning because he loves fresh air'",
      ],
      example:
        "My dog Max runs really fast in the park because he loves chasing squirrels. Yesterday he chased a squirrel up a tree, but it was too quick for him. Max got sad, so I gave him a treat.",
    },
  },
  {
    level: 3,
    name: "Idea Holder",
    focus: "Staying on one clear main idea throughout",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["6+1 Traits — Ideas", "SRSD — main idea focus"],
    byGenre: {
      opinion: {
        criteria:
          "The essay has ONE clear opinion — one thing the writer thinks or prefers. All sentences relate to that opinion. If asked 'what does this writer think?', the answer is obvious and there are no side opinions about other topics.",
        teachingTip:
          "Before writing, ask: 'What ONE thing do you think? What's your opinion?' After writing, check each sentence: 'Does this support your opinion, or is it about something else?' If a sentence is about a different opinion, suggest cutting it.",
        kidExplanation:
          "Your essay should have ONE opinion. Not two or three. Pick your favorite thing to argue and stick with it.",
        techniques: [
          "State your opinion in one sentence before you start",
          "Every sentence should connect back to that opinion",
          "Cut sentences that wander off to different opinions",
        ],
        example:
          "Pizza is the best food. My favorite has pepperoni and lots of cheese. I could eat pizza every day because it's so yummy. I always smile when my mom orders pizza for dinner.",
      },
      creative: {
        criteria:
          "The story or description has ONE clear focus — one character, one moment, one place, or one event. All sentences belong to that focus. The piece doesn't jump to an unrelated scene or start describing a different thing.",
        teachingTip:
          "Before writing, ask: 'What's your story about? One moment, one thing, one character?' After writing, check: 'Do all the sentences belong to the same story?' If a sentence is about a different event or scene, suggest saving it for another story.",
        kidExplanation:
          "Your story should be about ONE thing. One moment, one place, or one character. Don't jump around to other stories.",
        techniques: [
          "Pick your focus before writing: one character? one event? one place?",
          "Every sentence should belong to that same story",
          "If a sentence is about something else, save it for another story",
        ],
        example:
          "My dog Max is the goofiest animal I know. He tries to catch his own tail every morning. Yesterday he got dizzy and bumped into the couch. But he just shook it off and started chasing it again.",
      },
      informational: {
        criteria:
          "The essay has ONE clear topic — one specific thing being explained. All sentences teach about that topic. If asked 'what is this teaching?', the answer is obvious and no sentences wander to a different topic.",
        teachingTip:
          "Before writing, ask: 'What ONE thing are you teaching? Can you say it in one sentence?' After writing, check each sentence: 'Is this still about the same topic?' If a sentence is about a different topic, suggest cutting it.",
        kidExplanation:
          "Your essay should teach about ONE topic. Not lots of different things. Pick your topic and stick with it.",
        techniques: [
          "Name your topic in one sentence before you start",
          "Every sentence should teach something about that topic",
          "Cut sentences that wander off to different topics",
        ],
        example:
          "Bees are amazing insects. They live in groups called colonies. They collect nectar from flowers to make honey. Bees also communicate by doing a little dance to tell each other where the best flowers are.",
      },
    },
  },
  {
    level: 4,
    name: "Detail Giver",
    focus: "Supporting the main idea with specific details",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["6+1 Traits — Ideas & Details", "Hochman — concrete support"],
    byGenre: {
      opinion: {
        criteria:
          "The essay includes at least 2 specific REASONS or EXAMPLES that support the opinion. Reasons are concrete — not 'it's good' or 'I like it' but specific reasons like 'the cheese stretches when you pull a slice' or 'we make it together on Fridays'.",
        teachingTip:
          "When they give a vague reason, ask: 'WHY? Can you give me an example?' Give examples on a DIFFERENT topic — never rewrite their sentences. Teach that 'it's good' is not a reason — it's a restatement of the opinion.",
        kidExplanation:
          "Now add REASONS! If you say pizza is the best, tell me WHY. 'It's yummy' is weak — 'the cheese stretches and the pepperoni is spicy' is strong.",
        techniques: [
          "Every opinion needs reasons to back it up",
          "Specific reasons beat vague ones",
          "Use examples from real life: who, when, where",
          "'It's good' is not a reason — give a real one",
        ],
        example:
          "Pizza is the best food. The crust is crunchy on the outside and soft inside. My favorite topping is pepperoni because it tastes a little spicy. Last weekend I ate three slices at my cousin's birthday party!",
      },
      creative: {
        criteria:
          "The piece includes at least 2 specific SENSORY DETAILS or concrete images — things a reader can see, hear, smell, taste, or feel. Not 'it was fun' but 'we splashed through the puddles in our rubber boots'. Specific, named things beat generic words.",
        teachingTip:
          "Point to a general statement ('it was fun', 'I was scared') and ask: 'What did it LOOK like? SOUND like? FEEL like? What EXACTLY did you see?' Encourage naming specific things ('my red fire truck' not 'a toy'). Show, don't tell.",
        kidExplanation:
          "Now paint pictures with words! Tell me what you SEE, HEAR, SMELL, TASTE, FEEL. Not 'it was nice' — what did it look like? What did you hear?",
        techniques: [
          "Use the 5 senses: sight, sound, smell, taste, touch",
          "Specific beats vague: 'crunched through gold leaves' > 'walked outside'",
          "Name the exact thing: not 'a toy' — 'my old red fire truck'",
          "Show, don't tell: not 'I was scared' — 'my hands shook'",
        ],
        example:
          "The beach was magical that morning. The sand was cold and damp between my toes. A salty breeze whipped my hair into my face. I could hear gulls crying somewhere above. Then I saw the biggest seashell I've ever found — pink and curled like a trumpet.",
      },
      informational: {
        criteria:
          "The essay includes at least 2 specific FACTS, EXAMPLES, or DETAILS that teach about the topic. Specific means concrete — numbers, names, examples, or precise descriptions. Not 'bees are good for flowers' but 'one bee visits about 100 flowers in a day'.",
        teachingTip:
          "When a fact is vague, ask: 'How many? How big? Can you give an example?' Help the writer move from general claims to specific ones. Give example facts on a DIFFERENT topic — never rewrite their sentences.",
        kidExplanation:
          "Now add FACTS! Specific ones. Not 'bees help plants' — 'bees carry pollen from flower to flower, and that helps new flowers grow'. The more specific, the better.",
        techniques: [
          "Specific facts beat vague ones — use numbers, names, examples",
          "Give examples to back up big claims",
          "Concrete descriptions: not 'big' — '6 feet long'",
          "Name the specific thing you're teaching about",
        ],
        example:
          "Bees are amazing insects. A single bee can visit over 100 flowers in one day. When they land, tiny hairs on their legs pick up pollen from each flower. They carry that pollen back to their hive to feed the baby bees. This is how bees help plants grow all over the world.",
      },
    },
  },
  {
    level: 5,
    name: "Capitalizer",
    focus: "Capitalizing sentence starts and proper nouns",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["Standard English mechanics"],
    content: {
      criteria:
        "Every sentence starts with a capital. Every proper noun is capitalized — anything there's only one specific one of: people, pets, places, brands, days, months, and the writer's 'I'.",
      teachingTip:
        "Two checks: every sentence starts with a capital, and every one-of-a-kind name is capitalized. If a name is lowercase, ask: 'Is there only one of those, or lots?' (lots of cats, but only one Buffy). 'I' fits the same rule — only one YOU. Don't fix it for the writer — let them catch it.",
      kidExplanation:
        "Two rules: every sentence STARTS with a capital, and every NAME gets a capital. If there's only one of something — your cat Buffy, your school, the word 'I' — it's a name.",
      techniques: [
        "Check every sentence starts with a capital",
        "Capitalize every name: people, pets, places, brands, days, months",
        "'I' is a name for yourself — always capital",
      ],
      example:
        "Pizza is the best food. On Friday nights, my dad orders from Tony's Pizzeria. I always pick pepperoni, and my cat Buffy waits for the scraps.",
    },
  },
  {
    level: 6,
    name: "Order Keeper",
    focus: "Logical sequence — beginning, middle, and end",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["6+1 Traits — Organization"],
    byGenre: {
      opinion: {
        criteria:
          "The piece is at least 5 sentences long and flows in a clear order: (1) an OPENING sentence that states the opinion, (2) at least THREE middle sentences each giving a different reason or example that supports the opinion, and (3) a CLOSING sentence that wraps up. Ideas don't jump around — the reader can see a clear first / next / finally.",
        teachingTip:
          "Ask: 'What's your opinion in ONE sentence? Now what are three reasons?' Help them sequence reasons — strongest first, or easiest first. Teach order words: first, another reason, also, finally. If they only have 3 sentences, ask for more reasons — you can't order two things in the middle.",
        kidExplanation:
          "Start by saying what you think. Then give at least THREE reasons why, in a good order. End by wrapping it up. That's five or more sentences — ordered so a reader can follow you.",
        techniques: [
          "Opening sentence: state your opinion",
          "At least 3 middle sentences, each with a different reason",
          "Order words: first, another reason, also, finally",
          "Closing sentence: wrap up your opinion",
        ],
        example:
          "Dogs are the best pets. First, they are loyal and stay by your side no matter what. They also love going on long walks, which gets you outside. Another reason is that dogs can be trained to do all kinds of cool tricks. That's why I think every family should have a dog.",
      },
      creative: {
        criteria:
          "The piece is at least 5 sentences long and has a clear beginning, middle, and end: (1) an OPENING sentence that sets the scene or introduces the character, (2) at least THREE middle sentences that move the story or description forward in order, each adding something new, and (3) a CLOSING sentence that finishes the moment. A reader can see what happens first, next, and last.",
        teachingTip:
          "Ask: 'Where does your story start? What happens first, next, and finally? How does it end?' Help them keep events in order. If a middle sentence doesn't move the story forward, ask: 'What does this add?' If they only have 3 sentences, ask what else happened — you can't sequence two events.",
        kidExplanation:
          "A story has a beginning, middle, and end. Start by saying where/when or who. Then tell what happens — at least THREE things, in order. Finish with how it ends. Five or more sentences.",
        techniques: [
          "Opening sentence: set the scene or introduce the character",
          "At least 3 middle sentences that each move the story forward",
          "Sequence words: first, then, suddenly, after that, finally",
          "Closing sentence: wrap up the moment or show the feeling",
        ],
        example:
          "The beach was empty on Saturday morning. First, I walked along the shore looking for shells. Then I saw something sparkly half-buried in the sand. I knelt down and picked up a shiny blue stone. I put it in my pocket and smiled all the way home.",
      },
      informational: {
        criteria:
          "The piece is at least 5 sentences long and flows in a clear order: (1) an OPENING sentence that introduces the topic, (2) at least THREE middle sentences that share facts or steps in a logical order (general-to-specific, steps in a process, or different categories), and (3) a CLOSING sentence that wraps up. Facts don't jump around randomly.",
        teachingTip:
          "Ask: 'What's your topic? What are three facts or steps? What's a good order — is one a main fact and the others are examples? Or are they steps?' End by wrapping up the topic, not just stopping. If they only have 3 sentences, ask for more facts — you can't order two things.",
        kidExplanation:
          "Start by saying what you're going to teach. Then share at least THREE facts or steps, in order. End by wrapping it up. Five or more sentences.",
        techniques: [
          "Opening sentence: name the topic",
          "At least 3 middle sentences, each with a different fact or step",
          "Order facts logically: general → specific, or step 1 → step 2 → step 3",
          "Closing sentence: wrap up what you taught",
        ],
        example:
          "Bees are important insects that help plants grow. First, they live in big groups called colonies inside hives. They collect pollen from flowers when they fly around looking for nectar. The pollen they drop helps new flowers grow everywhere they visit. Without bees, many of the plants we love would disappear.",
      },
    },
  },
  {
    level: 7,
    name: "Sentence Combiner",
    focus: "Combining short sentences into stronger ones",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["Hochman Method — sentence combining"],
    content: {
      criteria:
        "The essay shows sentence combining. At least 2 places where two short ideas have been joined into one sentence using 'and', 'but', 'because', 'so', 'when', 'if', 'although', or similar.",
      teachingTip:
        "When you see choppy sentences ('Max ran. He got tired.'), suggest combining: 'Could those be one sentence? Max ran SO fast he got tired.' Teach subordinating conjunctions: because, although, since, while, when, if.",
      kidExplanation:
        "Too many short sentences sound choppy. You'll learn to glue them together into stronger sentences. 'Max ran. He got tired.' → 'Max ran so fast he got tired.'",
      techniques: [
        "Combine with and / but / or / so",
        "Combine with because / although / since / while / when / if",
        "Make sentences flow instead of sounding like a list",
      ],
      example:
        "My dog Max loves the park because he can run as fast as he wants. Yesterday when I threw his ball, he leapt into the air and caught it in his mouth. I laughed so hard I almost fell over!",
    },
  },
  {
    level: 8,
    name: "Paragraph Builder",
    focus: "Building a well-structured paragraph",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["Hochman Method — Single-Paragraph Outline (SPO)"],
    byGenre: {
      opinion: {
        criteria:
          "The essay has at least one well-built paragraph with (1) a TOPIC SENTENCE that makes a clear OPINION or CLAIM (not just names a topic), (2) 2-3 supporting sentences that each give a REASON or EXAMPLE backing up that specific claim, and (3) a CONCLUDING SENTENCE that wraps up the claim. Every middle sentence must clearly support the claim — no wandering to other ideas.",
        teachingTip:
          "Check: does the first sentence MAKE a point or just name a topic? 'Pizza' is a topic; 'Pizza is the best food' is a claim. Does each middle sentence actually support that specific claim? If a middle sentence doesn't back up the claim, ask: 'Does this belong here?'",
        kidExplanation:
          "A paragraph starts by making a CLAIM — what you think. Then you prove it with reasons. Then you wrap up by saying your claim again in a stronger way. Every sentence in the middle has to back up your claim.",
        techniques: [
          "SPO: Topic sentence MAKES a claim, not just names a topic",
          "Each supporting sentence must back up the SAME claim",
          "Strong claim: 'Dogs are the best pets' ✓ / Weak: 'I like dogs' ✗",
          "Concluding sentence restates the claim in fresher words",
        ],
        example:
          "Pizza is the best food in the world. First, the crust is perfect — crunchy outside, soft inside. Second, you can put any topping you want on it. Finally, it tastes even better the next morning for breakfast. That's why pizza will always be my favorite.",
      },
      creative: {
        criteria:
          "The essay has at least one well-built scene paragraph that (1) OPENS by establishing the moment — a setting, character, or strong action, (2) develops that same moment in the middle with 2-3 sentences of action, sensory detail, or dialogue, and (3) CLOSES with a final beat — a reaction, feeling, or small resolution. The paragraph stays inside ONE scene — it does not time-skip or jump to a different moment.",
        teachingTip:
          "Ask: 'Is this paragraph ONE moment, or are you jumping around?' If the writer time-skips mid-paragraph, that's usually where a new paragraph should begin. Ask what the reader would see, hear, or feel in this exact moment.",
        kidExplanation:
          "A story paragraph is ONE scene — one moment, one place, one piece of the story. Open the scene (where? who?). Middle: what happens, what you see/hear/feel. End with a final beat — a feeling or a small resolution. Don't jump to a new scene in the same paragraph.",
        techniques: [
          "A paragraph = ONE scene or moment",
          "Open with setting, character, or a strong action",
          "Middle sentences develop the SAME scene — don't time-skip",
          "End with a beat — a feeling, reaction, or small resolution",
        ],
        example:
          "The kitchen smelled like cinnamon the moment I walked in. Grandma was at the counter, her hands covered in flour, humming an old song. A tray of cookies sat cooling on the windowsill, steam curling up into the afternoon sun. She turned to me with her usual smile and held out a warm one. I took a bite and felt, for just a second, like the whole world was perfect.",
      },
      informational: {
        criteria:
          "The essay has at least one well-built paragraph with (1) a TOPIC SENTENCE that names the specific sub-topic the paragraph will explain, (2) 2-3 supporting sentences that each give a FACT, EXAMPLE, or DETAIL about that same sub-topic, and (3) a CONCLUDING SENTENCE that wraps up. Every middle sentence must be about the same sub-topic — no wandering to different facts.",
        teachingTip:
          "Point to the topic sentence and ask: 'What EXACTLY is this paragraph about?' Then check each sentence: 'Does this fit?' If a sentence is about a different sub-topic, suggest making a new paragraph for it. A topic sentence should name a specific thing, not just the general subject.",
        kidExplanation:
          "A paragraph about a topic starts by saying EXACTLY what it's about. Then every sentence in the middle gives a fact about that thing. End by wrapping up. Every sentence has to belong to the same sub-topic — don't wander.",
        techniques: [
          "Topic sentence names the sub-topic precisely (not 'Bees are cool' but 'Bees have amazing eyesight')",
          "Each supporting sentence gives a fact about the SAME sub-topic",
          "Transitions: for example, also, in addition, another fact",
          "Concluding sentence wraps up the sub-topic",
        ],
        example:
          "Honeybees have some of the best eyesight in the insect world. Their eyes are made up of thousands of tiny lenses, which help them spot flowers from far away. They can even see colors humans can't, like ultraviolet light. This helps them find the sweetest flowers quickly. Without their amazing eyes, bees couldn't do their important job.",
      },
    },
  },
  {
    level: 9,
    name: "Word Chooser",
    focus: "Using vivid, precise words instead of bland ones",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["6+1 Traits — Word Choice"],
    content: {
      criteria:
        "The essay uses at least 2-3 vivid or specific words where a bland word would also have worked. Examples: 'enormous' instead of 'big', 'sprinted' instead of 'went', 'crimson' instead of 'red'.",
      teachingTip:
        "Point to a generic word and ask: 'What EXACTLY do you mean? Is there a more interesting word?' Give examples on a different topic. Teach that weak words ('good', 'nice', 'big', 'went') have more vivid alternatives.",
      kidExplanation:
        "Instead of 'nice' or 'big' or 'good', use more exact words. 'Enormous' is better than 'big'. 'Sprinted' is better than 'went fast'. Your words should be PICTURES.",
      techniques: [
        "Replace bland words: good → fantastic/incredible; big → enormous/gigantic; went → sprinted/wandered",
        "Use sensory language: not just 'loud' but 'thunderous'",
        "Be specific: not 'food' — 'pepperoni pizza'",
      ],
      example:
        "Pizza isn't just good — it's magnificent. The pepperoni sizzles on top of the melted, gooey mozzarella. Every bite crunches, then melts on your tongue. The smell alone makes your stomach growl.",
    },
  },
  {
    level: 10,
    name: "Speller",
    focus: "Correct spelling — using patterns and recognizing sight words",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: [
      "Structured Literacy / Orton-Gillingham — phonics patterns",
      "Sight word recognition",
    ],
    content: {
      criteria:
        "Every word in the essay is spelled correctly. (Proper names and made-up words are exempt as long as the writer spells them consistently.) The writer is welcome to use a dictionary, ask for help, or self-correct — but the final draft has no remaining misspellings.",
      teachingTip:
        "Be warm and encouraging — never shame a misspelling, and never use words like 'wrong' or 'mistake'. For each misspelled word, briefly teach WHY it's tricky. Three patterns to draw from: (1) sight words that just have to be memorized (e.g., 'said', 'were', 'come', 'friend', 'because'); (2) the writer's spelling was phonetically reasonable, but English picked a different pattern for that sound (e.g., 'thay' → 'they' — the long-A sound is sometimes 'ai', sometimes 'ay', sometimes 'ey'); (3) a rule applies (silent-e makes the vowel say its name; 'i before e except after c'; doubling consonants before -ing). Always validate the writer's logic first ('That spelling totally makes sense for that sound!') before showing the actual spelling. One misspelling per message — don't overwhelm.",
      kidExplanation:
        "Now your spelling counts. Don't worry — the Buddy will help. When you spell a word in a way that didn't quite work, the Buddy will tell you WHY it's tricky. Some words just have to be memorized (those are sight words). Some sounds can be spelled lots of different ways, and English just picked one — not your fault, but worth learning.",
      techniques: [
        "Sight words: words you can't sound out — you just have to recognize them (said, were, come, friend, because)",
        "One sound, many spellings: long-A can be 'ai' (rain), 'ay' (day), 'eigh' (eight), 'ey' (they) — each word has its own",
        "Silent-e rule: the 'e' at the end makes the earlier vowel say its name (cap → cape, kit → kite)",
        "'I before E except after C' (and a few exceptions worth knowing)",
        "When you're not sure: try it, then ask or look it up — that's what real writers do",
      ],
      example:
        "Pizza is the best food. I really love pepperoni because it has a slight spice. My friends and I always ask for pizza on Fridays.",
    },
  },
  {
    level: 11,
    name: "Sentence Varier",
    focus: "Mixing sentence lengths, types, and structures",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["6+1 Traits — Sentence Fluency", "Hochman — appositives"],
    content: {
      criteria:
        "The essay shows sentence variety — mixing short and long sentences, different sentence starts, AND at least one appositive (extra info set off with commas) OR a complex sentence with a subordinating conjunction.",
      teachingTip:
        "Notice if sentences all sound the same length/rhythm. Teach appositives: 'My dog, a golden retriever, loves treats.' Encourage starting sentences different ways (not always with the subject).",
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
    },
  },
  {
    level: 12,
    name: "Summarizer",
    focus: "Saying what you mean concisely — no wasted words",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "draft"],
    sources: ["Hochman Method — summarizing"],
    content: {
      criteria:
        "The essay says its ideas clearly without unnecessary repetition or filler. If the same idea appears twice, one version has been removed. Every sentence earns its place.",
      teachingTip:
        "After review, ask: 'Is there anything you said twice? Any sentence that could be cut without losing meaning?' Teach that summarizing means capturing the main idea in fewer words.",
      kidExplanation:
        "Say what you mean without extra words. If you already said something, don't say it again in different words. Make every sentence count.",
      techniques: [
        "Identify main ideas vs. filler",
        "Cut repeated ideas (you don't need to say pizza is great three times)",
        "Say more with fewer words",
      ],
      example:
        "Pizza is amazing because it combines three perfect things: crunchy crust, gooey cheese, and salty toppings. Every bite delivers all three at once. No other food does that. That's why pizza wins.",
    },
  },
  {
    level: 13,
    name: "Essay Builder",
    focus: "A real multi-paragraph essay — introduction, body, conclusion",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["Hochman Method — MPO", "SRSD — TREE, W-W-W strategies"],
    byGenre: {
      opinion: {
        criteria:
          "The essay has at least 3 paragraphs: (1) an INTRODUCTION that sets up the topic and states the opinion clearly, (2) at least 1-2 BODY paragraphs, each built around ONE distinct reason with its own supporting details, (3) a CONCLUSION that restates the opinion in a fresh way. Paragraphs connect with transitions like 'Another reason,' 'In addition,' 'Finally.'",
        teachingTip:
          "Teach TREE from SRSD: Topic sentence (state your opinion), Reasons (3), Explain each, Ending. Plan every paragraph in the Outline tab BEFORE drafting. Check: does each body paragraph have ONE reason, not three mixed together? Does the conclusion say the opinion in a fresh way instead of just copying the intro?",
        kidExplanation:
          "Now you'll write a real opinion essay. Not one paragraph — several paragraphs that work as a team. Introduction (say your opinion), body paragraphs (each with one reason), conclusion (wrap it up).",
        techniques: [
          "TREE (SRSD): Topic sentence = your opinion, Reasons (3), Explain each, Ending",
          "Each body paragraph = ONE reason, with supporting details",
          "Paragraph transitions: Another reason, In addition, Finally",
          "Conclusion restates the opinion in a fresh way — no new reasons here",
        ],
        example:
          "(Full 3-5 paragraph opinion essay: intro stating the opinion, body paragraphs each with one reason, conclusion that circles back.)",
      },
      creative: {
        criteria:
          "The story has at least 3 paragraphs: (1) an OPENING paragraph that establishes WHO (characters), WHERE/WHEN (setting), and WHAT the main character wants, (2) at least 1-2 MIDDLE paragraphs where something happens (a problem, an action, or a struggle), and (3) an ENDING paragraph that shows HOW the situation resolves AND HOW the character feels. Paragraphs mark clear shifts in scene, time, or action.",
        teachingTip:
          "Teach W-W-W from SRSD: Who, Where, When, What wants, What happens, How ends, How feels. Before drafting, help them outline those seven questions. Each paragraph should be a scene or a new action — don't cram the whole story into one paragraph. The ending needs to resolve AND show feeling.",
        kidExplanation:
          "Now you'll write a real story. Opening paragraph (who, where, when, what they want). Middle paragraphs (what happens). Ending paragraph (how it ends, how they feel). New paragraph = new scene or new action.",
        techniques: [
          "W-W-W (SRSD): Who, Where, When, What wants, What happens, How ends, How feels",
          "Each paragraph is a scene or a new action — don't cram the whole story into one",
          "Transitions between scenes: Later, Suddenly, The next morning, Meanwhile",
          "Ending resolves the problem AND shows the character's feeling",
        ],
        example:
          "(Full 3-5 paragraph story: opening paragraph setting up who/where/when/wants, middle paragraph(s) with what happens, ending paragraph showing the resolution and feeling.)",
      },
      informational: {
        criteria:
          "The essay has at least 3 paragraphs: (1) an INTRODUCTION that names the topic and tells the reader what they'll learn, (2) at least 1-2 BODY paragraphs, each teaching about ONE sub-topic (a category, step, or question) with its own supporting facts, and (3) a CONCLUSION that wraps up what was taught. Paragraphs connect with transitions like 'Another fact,' 'In addition,' 'Finally.'",
        teachingTip:
          "Help them pick sub-topics or questions before drafting — each body paragraph covers ONE. Use the Outline tab. Check: is every fact in a paragraph about the same sub-topic? If a fact belongs to a different sub-topic, move it. Conclusion wraps up — it doesn't introduce new facts.",
        kidExplanation:
          "Now you'll write a real teaching essay. Introduction (name the topic), body paragraphs (each teaches one sub-topic), conclusion (wrap it up). Each new paragraph teaches a new part.",
        techniques: [
          "Question-Answer or category structure: each body paragraph answers one question or covers one category",
          "Each body paragraph = ONE sub-topic, with supporting facts",
          "Paragraph transitions: Another fact, In addition, Finally",
          "Conclusion wraps up the topic — no new facts here",
        ],
        example:
          "(Full 3-5 paragraph informational essay: intro naming the topic, body paragraphs each teaching one sub-topic, conclusion that wraps up.)",
      },
    },
  },
  {
    level: 14,
    name: "Essay Polish",
    focus: "Compelling openings, sharp central ideas, meaningful endings",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["Academic writing craft", "6+1 Traits — Organization"],
    byGenre: {
      opinion: {
        criteria:
          "The essay has (1) a HOOK that grabs attention (bold claim, provocative question, or striking example — not 'This essay is about...'), (2) a specific, ARGUABLE thesis (not just 'Pizza is great' but 'Pizza is the best food because it balances flavor, texture, and flexibility'), and (3) a CONCLUSION that says something meaningful — connects back to the hook, offers insight, or challenges the reader.",
        teachingTip:
          "Show the difference between a weak thesis ('Pizza is great') and a strong one ('Pizza is the best food because it balances flavor, texture, and flexibility'). Teach hook types. Conclusions should resolve, not just restate the intro.",
        kidExplanation:
          "Your first sentence should GRAB the reader. Your thesis should make a real claim someone might disagree with. Your ending should feel like it matters — not just 'and that's why pizza is great'.",
        techniques: [
          "Hook types for opinion: provocative question, bold claim, surprising fact",
          "Thesis: specific AND arguable (not obvious)",
          "Conclusion: circle back to the hook, offer insight, or challenge the reader",
        ],
        example:
          "(Opinion essay with strong hook, arguable thesis, and meaningful closing.)",
      },
      creative: {
        criteria:
          "The story has (1) an OPENING that pulls the reader in (vivid action, surprising image, intriguing dialogue, or atmosphere — not 'Once upon a time' or 'Hi my name is'), (2) a CLEAR CENTRAL STAKE — what the character wants, fears, or needs — established early, and (3) a CLOSING that lands with feeling — a final image, realization, or resonant beat — not just 'and they went home'.",
        teachingTip:
          "Show strong story openings (action, image, dialogue, atmosphere) versus weak ones ('Once upon a time'). Ask: 'What does your character want?' Endings can be images or feelings — they don't have to explain everything.",
        kidExplanation:
          "Great stories GRAB you at the first sentence. Something clear is at stake — the character wants or fears something. The ending leaves a feeling, not just 'the end'.",
        techniques: [
          "Opening types: vivid action, surprising image, dialogue, atmosphere",
          "Central stake: what does the character want or fear? Make it clear early",
          "Closings: a final image, realization, or feeling — not a summary",
        ],
        example:
          "(Story with strong opening, clear stake, and resonant closing.)",
      },
      informational: {
        criteria:
          "The essay has (1) a HOOK that grabs attention (surprising fact, intriguing question, vivid example — not 'This essay is about...'), (2) a CLEAR THESIS that tells the reader exactly what they'll learn AND why it matters, and (3) a CONCLUSION that leaves the reader with a takeaway — why the topic matters, a connection back to the hook, or something to think about — not just restating facts.",
        teachingTip:
          "Show how a surprising fact ('A single bee visits over 100 flowers a day') hooks better than 'Bees are important insects'. A strong thesis tells the reader both WHAT they'll learn AND why it matters. Conclusions should leave a takeaway, not just restate.",
        kidExplanation:
          "Your first sentence should GRAB the reader — a surprising fact or question. Your thesis should tell the reader exactly what they'll learn. Your ending should say WHY this topic matters.",
        techniques: [
          "Hook types for informational: surprising fact, intriguing question, vivid example",
          "Thesis: what will the reader learn, and why should they care?",
          "Conclusion: why does this matter? What's the takeaway?",
        ],
        example:
          "(Informational essay with strong hook, clear thesis, and meaningful conclusion about why the topic matters.)",
      },
    },
  },
  {
    level: 15,
    name: "Voice Finder",
    focus: "Writing that sounds like YOU — authentic personal voice",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["6+1 Traits — Voice"],
    content: {
      criteria:
        "The writing has personality. It includes opinions, unique phrasings, humor, or emotion that makes it sound like the writer, not a template. Reading it, you can feel the writer's perspective.",
      teachingTip:
        "Ask: 'How would YOU say this if you were chatting with a friend? What do YOU think about this?' Encourage unexpected comparisons, personal reactions, and genuine emotion.",
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
    },
  },
  {
    level: 16,
    name: "Evidence & Nuance",
    focus: "Backing up what you say and showing you see the complexity",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["SRSD — STOP+DARE strategy", "6+1 Traits — Ideas"],
    byGenre: {
      opinion: {
        criteria:
          "Claims are supported with at least 2 pieces of specific evidence (examples, facts, data, expert views, or clear reasoning). The essay acknowledges at least one possible counter-argument and responds to it — either rebutting it or acknowledging its partial truth.",
        teachingTip:
          "Teach SRSD STOP+DARE for argumentative writing: Suspend judgment (consider both sides), Take a side, Organize ideas, Plan more + Develop topic sentence, Add supporting ideas, Reject opposing arguments (acknowledge and rebut), End with a conclusion. Emphasize that strong writers don't ignore opposing views — they address them.",
        kidExplanation:
          "Some people might disagree with you. What would THEY say? Answer their point. Use real evidence — examples, facts, reasons. Strong writers don't ignore the other side.",
        techniques: [
          "STOP+DARE (SRSD): Suspend, Take a side, Organize, Plan + Develop, Add, Reject (rebut), End",
          "Evidence types: examples, data, expert views, logical reasoning",
          "Acknowledging the other side makes YOUR argument stronger",
          "'Some people say X, but actually Y because Z.'",
        ],
        example:
          "(Argumentative essay with evidence and a clearly addressed counter-argument.)",
      },
      creative: {
        criteria:
          "The story has at least one layer of complexity beyond the obvious — a character whose feelings are mixed or conflicted, a moment where the reader understands something the character doesn't, or a scene that doesn't mean just one thing. The piece avoids being entirely one-note.",
        teachingTip:
          "Point to a moment and ask: 'Is your character feeling just ONE thing, or could they feel two things at once?' Ask: 'What might the reader notice that your character doesn't?' Teach that great stories don't have to wrap everything up neatly — a little ambiguity makes writing feel real.",
        kidExplanation:
          "Great stories aren't one note. Characters can feel TWO things at once — happy AND sad, scared AND excited. Readers can notice things characters miss. Don't make it too simple — real life has layers.",
        techniques: [
          "Mixed feelings: a character can feel two things at once",
          "Dramatic irony: the reader knows something the character doesn't",
          "Subtext: what characters don't say can matter as much as what they do",
          "A small contradiction makes a scene feel real",
        ],
        example:
          "(Creative piece with a layered moment — mixed feelings, irony, or a small complexity.)",
      },
      informational: {
        criteria:
          "Key facts are supported with at least 2 pieces of specific evidence (sources, examples, data, or clear reasoning). The essay acknowledges at least one place where the truth is debated, uncertain, or more complicated than it first appears.",
        teachingTip:
          "Ask: 'How do you know this? Is it always true, or does it depend?' Teach that real experts acknowledge when things are debated or uncertain. Specific evidence beats vague claims, and pretending everything is settled when it isn't weakens the writing.",
        kidExplanation:
          "Real teaching uses EVIDENCE to back up facts. And sometimes the truth is complicated — scientists disagree, or the answer depends. Strong writers say so, instead of pretending it's all simple.",
        techniques: [
          "Cite evidence: where did you learn this? An example, a source, a specific observation",
          "Acknowledge complexity: 'Some scientists think X, but others think Y'",
          "Don't pretend everything is settled when it isn't",
          "Strong evidence is specific and verifiable",
        ],
        example:
          "(Informational essay with strong evidence and acknowledgment of a debate or complexity.)",
      },
    },
  },
  {
    level: 17,
    name: "Reviser",
    focus: "True revision — not just editing, but rethinking",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["Writing process research", "Donald Graves — revision"],
    content: {
      criteria:
        "There is clear evidence of revision beyond surface edits. Paragraphs have been restructured, weak sentences strengthened, unnecessary content cut, or arguments sharpened. Not just spelling/punctuation fixes.",
      teachingTip:
        "Teach the distinction: REVISING is big changes (structure, argument, clarity); EDITING is small fixes (typos, punctuation). Encourage reading aloud to find weak spots. Teach 'murder your darlings' — cut what doesn't serve the essay, even if you liked writing it.",
      kidExplanation:
        "Revising means making BIG changes to make your essay better. Cut stuff that doesn't work. Move paragraphs around. Rewrite weak sentences. This is where good writing becomes great writing.",
      techniques: [
        "Revision (big changes) vs. editing (small fixes) — know the difference",
        "Read aloud to find weak spots",
        "'Murder your darlings' — cut what doesn't serve the essay",
        "Restructure paragraphs; move ideas for better flow",
      ],
      example: "(A second draft showing substantial improvement over the first.)",
    },
  },
  {
    level: 18,
    name: "Master Writer",
    focus: "All skills combined, consistently, with polish",
    essaysToPass: 3,
    availableTabs: ["brainstorm", "outline", "draft"],
    sources: ["All prior frameworks combined"],
    content: {
      criteria:
        "The essay demonstrates all prior skills working together smoothly — strong ideas, clear structure, vivid words, varied sentences, a compelling opening and closing, authentic voice, well-supported argument, and evidence of careful revision. This is writing anyone — adult or child — would be proud of.",
      teachingTip:
        "At this level, give lighter guidance. Ask: 'Is there anything YOU think could be better?' Trust the writer's instincts. Celebrate their growth. This is metacognitive territory — writers thinking about their own writing.",
      kidExplanation:
        "You're a real writer now. You know how to do ALL of this. Keep doing it — write essays you're genuinely proud of. You've earned it.",
      techniques: [
        "Self-assessment across all prior skills",
        "Metacognition: thinking about your own thinking & writing",
        "Trust your instincts as a writer",
      ],
      example: "(A polished, adult-level essay that combines all prior skills.)",
    },
  },
];

export function getLevel(level: number): LevelDefinition {
  return LEVELS[level - 1] ?? LEVELS[0];
}

/**
 * Resolve the genre-specific content for a level. Levels that branch by
 * writing type expose their variants via `byGenre`; levels whose skill is
 * genre-agnostic expose shared `content`. Exactly one must be present.
 */
export function getLevelContent(
  level: LevelDefinition,
  genre: WritingType
): LevelContent {
  if (level.byGenre) return level.byGenre[genre];
  if (level.content) return level.content;
  throw new Error(
    `Level ${level.level} (${level.name}) has neither 'content' nor 'byGenre' defined`
  );
}
