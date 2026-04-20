import { describe, it, expect } from "vitest";
import {
  LEVELS,
  WRITING_TYPES,
  getLevel,
  getLevelContent,
  type WritingType,
} from "./levels";

describe("getLevel", () => {
  it("returns the level definition matching the 1-based number", () => {
    expect(getLevel(1).name).toBe("Sentence Writer");
    expect(getLevel(2).name).toBe("Sentence Expander");
    expect(getLevel(LEVELS.length).level).toBe(LEVELS.length);
  });

  it("falls back to level 1 for out-of-range inputs instead of throwing", () => {
    // Guards against a malformed row in skill_progress pushing current_level
    // past what's defined.
    expect(getLevel(0).level).toBe(1);
    expect(getLevel(LEVELS.length + 1).level).toBe(1);
    expect(getLevel(-5).level).toBe(1);
  });
});

describe("LEVELS data integrity", () => {
  it("levels are numbered sequentially starting at 1", () => {
    LEVELS.forEach((l, idx) => {
      expect(l.level).toBe(idx + 1);
    });
  });

  it("every level declares essaysToPass > 0", () => {
    for (const l of LEVELS) expect(l.essaysToPass).toBeGreaterThan(0);
  });

  it("every level includes the draft tab", () => {
    // The UI relies on draft always being available as the fallback.
    for (const l of LEVELS) expect(l.availableTabs).toContain("draft");
  });

  it("every level has exactly one of content or byGenre", () => {
    for (const l of LEVELS) {
      const hasContent = l.content !== undefined;
      const hasByGenre = l.byGenre !== undefined;
      expect(hasContent !== hasByGenre).toBe(true);
    }
  });

  it("every byGenre level defines all three writing types", () => {
    for (const l of LEVELS) {
      if (!l.byGenre) continue;
      expect(l.byGenre.opinion).toBeDefined();
      expect(l.byGenre.creative).toBeDefined();
      expect(l.byGenre.informational).toBeDefined();
    }
  });
});

describe("WRITING_TYPES", () => {
  it("exposes the three expected writing-type ids", () => {
    const ids = WRITING_TYPES.map((t) => t.id);
    expect(ids).toEqual(["opinion", "creative", "informational"]);
  });
});

describe("getLevelContent", () => {
  const genres: WritingType[] = ["opinion", "creative", "informational"];

  it("returns the shared content for genre-agnostic levels regardless of genre", () => {
    const speller = getLevel(10);
    const criteria = genres.map((g) => getLevelContent(speller, g).criteria);
    expect(new Set(criteria).size).toBe(1);
  });

  it("returns genre-specific content for branched levels", () => {
    // L8 Paragraph Builder is branched — opinion should talk about claims,
    // creative about scenes, informational about sub-topics. Use distinctive
    // phrasing as a signal.
    const l8 = getLevel(8);
    expect(getLevelContent(l8, "opinion").criteria).toMatch(/claim/i);
    expect(getLevelContent(l8, "creative").criteria).toMatch(/scene/i);
    expect(getLevelContent(l8, "informational").criteria).toMatch(
      /sub-topic/i
    );
  });

  it("returns a different example per genre for branched levels", () => {
    const l6 = getLevel(6);
    const examples = genres.map((g) => getLevelContent(l6, g).example);
    expect(new Set(examples).size).toBe(3);
  });

  it("can resolve content for every level across every genre", () => {
    for (const l of LEVELS) {
      for (const g of genres) {
        const c = getLevelContent(l, g);
        expect(c.criteria).toBeTruthy();
        expect(c.kidExplanation).toBeTruthy();
        expect(c.techniques.length).toBeGreaterThan(0);
      }
    }
  });

  it("throws for a malformed level that has neither content nor byGenre", () => {
    // The LEVELS data is validated by the integrity tests above, so this
    // branch can only be hit by a programming error. We still guard it at
    // runtime because TypeScript can't express "exactly one of A/B".
    const broken = {
      level: 99,
      name: "Broken",
      focus: "",
      essaysToPass: 1,
      availableTabs: ["draft" as const],
      sources: [],
    };
    expect(() => getLevelContent(broken, "opinion")).toThrow(/neither/);
  });
});
