import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildContextMessage } from "./prompts";

const baseSystemArgs = {
  writingType: "opinion" as const,
  currentLevel: 1,
};

const baseContextArgs = {
  currentLevel: 1,
  currentStep: "draft",
  activeTab: "draft" as const,
  essayContent: "",
  essayTitle: "",
  brainstormNotes: "",
  outline: "",
};

describe("buildSystemPrompt (stable, cached portion)", () => {
  it("includes the level name and focus for the given level", () => {
    const prompt = buildSystemPrompt({ ...baseSystemArgs, currentLevel: 2 });
    expect(prompt).toContain("Level: 2 — Sentence Expander");
    // Level 2's focus line:
    expect(prompt).toMatch(/because\/but\/so|B\/B\/S/i);
  });

  it("omits the 'Prior Level Skills' section at level 1 (no prior levels)", () => {
    const prompt = buildSystemPrompt({ ...baseSystemArgs, currentLevel: 1 });
    expect(prompt).not.toContain("Prior Level Skills");
  });

  it("includes 'Prior Level Skills' for level > 1", () => {
    const prompt = buildSystemPrompt({ ...baseSystemArgs, currentLevel: 3 });
    expect(prompt).toContain("Prior Level Skills");
    expect(prompt).toContain("Level 1");
    expect(prompt).toContain("Level 2");
  });

  it("includes the writing-type context for each supported type", () => {
    expect(
      buildSystemPrompt({ ...baseSystemArgs, writingType: "opinion" })
    ).toContain("OPINION essay");
    expect(
      buildSystemPrompt({ ...baseSystemArgs, writingType: "creative" })
    ).toContain("CREATIVE/NARRATIVE essay");
    expect(
      buildSystemPrompt({ ...baseSystemArgs, writingType: "informational" })
    ).toContain("INFORMATIONAL essay");
  });

  it("tells the AI not to mention brainstorm/outline when only draft is available", () => {
    const prompt = buildSystemPrompt(baseSystemArgs);
    expect(prompt).toContain("don't mention brainstorm or outline tabs");
  });

  it("includes the Step Guide with markEssayReady references", () => {
    const prompt = buildSystemPrompt(baseSystemArgs);
    expect(prompt).toContain("Step Guide");
    expect(prompt).toContain("markEssayReady");
  });

  it("includes the revise anchor ('do not rely', 'never claim you can't see') in the Step Guide — regression guard", () => {
    const prompt = buildSystemPrompt(baseSystemArgs);
    expect(prompt).toMatch(/I've Made Changes/);
    expect(prompt).toMatch(/do not rely|don't rely/i);
    expect(prompt).toMatch(/never claim you can.?t see|do not say.*save/i);
  });

  it("does NOT contain volatile essay state — that belongs in the context message", () => {
    const prompt = buildSystemPrompt(baseSystemArgs);
    // Section headers that anchor the volatile block. If these leak into
    // the cached system prefix, the cache is invalidated on every turn.
    expect(prompt).not.toContain("## Current State");
    expect(prompt).not.toContain("**Title:**");
    expect(prompt).not.toContain("## Essay Context");
  });

  it("includes the Tab Guide only for tabs available at this level", () => {
    // Guard against Tab Guide bloat: if an unavailable tab's guide leaks in
    // at an earlier level, the student could be nudged toward a tab they
    // don't have.
    const tabGuideSection = (prompt: string) => {
      const m = prompt.match(/## Tab Guide([\s\S]*?)## Step Guide/);
      if (!m) throw new Error("Tab Guide section not found");
      return m[1];
    };

    const level1 = tabGuideSection(
      buildSystemPrompt({ ...baseSystemArgs, currentLevel: 1 })
    );
    expect(level1).toContain("### DRAFT");
    expect(level1).not.toContain("### BRAINSTORM");
    expect(level1).not.toContain("### OUTLINE");

    const level3 = tabGuideSection(
      buildSystemPrompt({ ...baseSystemArgs, currentLevel: 3 })
    );
    expect(level3).toContain("### BRAINSTORM");
    expect(level3).toContain("### DRAFT");

    const level13 = tabGuideSection(
      buildSystemPrompt({ ...baseSystemArgs, currentLevel: 13 })
    );
    expect(level13).toContain("### OUTLINE");
  });
});

describe("buildContextMessage (volatile, per-turn portion)", () => {
  it("includes the active tab name in uppercase", () => {
    const msg = buildContextMessage({ ...baseContextArgs, activeTab: "draft" });
    expect(msg).toContain("Current Tab:** DRAFT");
  });

  it("includes the current step name in uppercase", () => {
    const msg = buildContextMessage({
      ...baseContextArgs,
      currentStep: "review",
    });
    expect(msg).toContain("Current Step:** REVIEW");
  });

  it("mentions the brainstorm section only when brainstorm is an available tab at this level", () => {
    const level1 = buildContextMessage(baseContextArgs);
    expect(level1).not.toContain("Brainstorm Notes");

    const level3 = buildContextMessage({
      ...baseContextArgs,
      currentLevel: 3,
      brainstormNotes: "pizza is yum",
    });
    expect(level3).toContain("Brainstorm Notes");
    expect(level3).toContain("pizza is yum");
  });

  it("mentions the outline section only when outline is an available tab at this level", () => {
    const level3 = buildContextMessage({
      ...baseContextArgs,
      currentLevel: 3,
    });
    expect(level3).not.toContain("**Outline:**");

    const levelWithOutline = buildContextMessage({
      ...baseContextArgs,
      currentLevel: 13,
      outline: "1. intro 2. body 3. end",
    });
    expect(levelWithOutline).toContain("**Outline:**");
    expect(levelWithOutline).toContain("1. intro 2. body 3. end");
  });

  it("includes placeholders for empty title and empty draft", () => {
    const msg = buildContextMessage(baseContextArgs);
    expect(msg).toContain("(not yet chosen)");
    expect(msg).toContain("(nothing written yet)");
  });

  it("includes the draft content verbatim so Claude reads the current essay", () => {
    const msg = buildContextMessage({
      ...baseContextArgs,
      essayContent: "I like my cat. My cat is called buffy. She is snuggly.",
    });
    expect(msg).toContain("She is snuggly");
  });
});
