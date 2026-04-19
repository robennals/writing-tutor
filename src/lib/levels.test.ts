import { describe, it, expect } from "vitest";
import { LEVELS, WRITING_TYPES, getLevel } from "./levels";

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
});

describe("WRITING_TYPES", () => {
  it("exposes the three expected writing-type ids", () => {
    const ids = WRITING_TYPES.map((t) => t.id);
    expect(ids).toEqual(["opinion", "creative", "informational"]);
  });
});
