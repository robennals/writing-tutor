import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompts";

const baseArgs = {
  writingType: "opinion" as const,
  currentLevel: 1,
  currentStep: "draft",
  activeTab: "draft" as const,
  essayContent: "",
  essayTitle: "",
  brainstormNotes: "",
  outline: "",
};

describe("buildSystemPrompt", () => {
  it("includes the level name and focus for the given level", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, currentLevel: 2 });
    expect(prompt).toContain("Level: 2 — Sentence Expander");
    // Level 2's focus line:
    expect(prompt).toMatch(/because\/but\/so|B\/B\/S/i);
  });

  it("omits the 'Prior Level Skills' section at level 1 (no prior levels)", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, currentLevel: 1 });
    expect(prompt).not.toContain("Prior Level Skills");
  });

  it("includes 'Prior Level Skills' for level > 1", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, currentLevel: 3 });
    expect(prompt).toContain("Prior Level Skills");
    expect(prompt).toContain("Level 1");
    expect(prompt).toContain("Level 2");
  });

  it("mentions the brainstorm section only when brainstorm is an available tab", () => {
    const level1 = buildSystemPrompt({ ...baseArgs, currentLevel: 1 });
    expect(level1).not.toContain("Brainstorm Notes");

    const level3 = buildSystemPrompt({
      ...baseArgs,
      currentLevel: 3,
      brainstormNotes: "pizza is yum",
    });
    expect(level3).toContain("Brainstorm Notes");
    expect(level3).toContain("pizza is yum");
  });

  it("mentions the outline section only when outline is an available tab", () => {
    const level3 = buildSystemPrompt({ ...baseArgs, currentLevel: 3 });
    expect(level3).not.toContain("**Outline:**");

    const level11 = buildSystemPrompt({
      ...baseArgs,
      currentLevel: 11,
      outline: "1. intro 2. body 3. end",
    });
    expect(level11).toContain("**Outline:**");
    expect(level11).toContain("1. intro 2. body 3. end");
  });

  it("includes placeholders for empty title and empty draft", () => {
    const prompt = buildSystemPrompt(baseArgs);
    expect(prompt).toContain("(not yet chosen)");
    expect(prompt).toContain("(nothing written yet)");
  });

  it("includes the writing-type context for each supported type", () => {
    expect(
      buildSystemPrompt({ ...baseArgs, writingType: "opinion" })
    ).toContain("OPINION essay");
    expect(
      buildSystemPrompt({ ...baseArgs, writingType: "creative" })
    ).toContain("CREATIVE/NARRATIVE essay");
    expect(
      buildSystemPrompt({ ...baseArgs, writingType: "informational" })
    ).toContain("INFORMATIONAL essay");
  });

  it("surfaces the review-step instructions when current_step is 'review'", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, currentStep: "review" });
    expect(prompt).toContain("markEssayReady");
  });

  it("surfaces the revise-step instructions when current_step is 'revise'", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, currentStep: "revise" });
    expect(prompt).toContain("revising based on your feedback");
  });

  it("falls back to a generic helper line for unknown steps", () => {
    const prompt = buildSystemPrompt({
      ...baseArgs,
      currentStep: "not-a-real-step",
    });
    expect(prompt).toContain("Help the writer with whatever they need");
  });

  it("tells the AI not to mention brainstorm/outline when only draft is available", () => {
    const prompt = buildSystemPrompt(baseArgs);
    expect(prompt).toContain("don't mention brainstorm or outline tabs");
  });

  it("includes the active tab name in uppercase", () => {
    const prompt = buildSystemPrompt({ ...baseArgs, activeTab: "draft" });
    expect(prompt).toContain("Current Tab: DRAFT");
  });
});
