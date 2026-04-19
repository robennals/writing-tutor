import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelInfoDialog } from "./level-info-dialog";

describe("LevelInfoDialog", () => {
  function renderOpen(
    currentLevel = 2,
    essaysAtLevel = 1,
    writingType: "opinion" | "creative" | "informational" = "opinion"
  ) {
    return render(
      <LevelInfoDialog
        open={true}
        onOpenChange={vi.fn()}
        writingType={writingType}
        currentLevel={currentLevel}
        essaysAtLevel={essaysAtLevel}
      />
    );
  }

  it("renders nothing when closed (no level headings present)", () => {
    const onOpenChange = vi.fn();
    render(
      <LevelInfoDialog
        open={false}
        onOpenChange={onOpenChange}
        writingType="opinion"
        currentLevel={1}
        essaysAtLevel={0}
      />
    );
    expect(screen.queryByText(/Level Journey/i)).toBeNull();
  });

  it("shows the writing-type title when open", () => {
    renderOpen(1);
    expect(screen.getByText(/Opinion Writing — Level Journey/)).toBeDefined();
  });

  it("marks the current level with the 'Current' badge and the earned/locked states correctly", () => {
    renderOpen(2);
    // Level 1 is earned (< current), level 2 is current, level 3+ locked.
    expect(screen.getByText("Earned")).toBeDefined();
    expect(screen.getByText("Current")).toBeDefined();
  });

  it("shows essays-at-level progress for the current level", () => {
    renderOpen(2, 1);
    // Level 2 needs 3 essays (from LEVELS data).
    expect(screen.getByText(/1\/3 essays at this level/)).toBeDefined();
  });

  it("expands the current level by default and collapses on a second click", () => {
    renderOpen(2, 0);
    // 'What this level is about' only appears under the expanded level.
    expect(
      screen.getAllByText(/What this level is about/).length
    ).toBeGreaterThan(0);

    // Click on the level 2 row header to collapse it.
    const level2Button = screen.getByRole("button", {
      name: /Level 2: Sentence Expander/,
    });
    fireEvent.click(level2Button);
    expect(screen.queryByText(/What this level is about/)).toBeNull();
  });

  it("expands a different level when clicked, replacing the previously expanded one", () => {
    renderOpen(2, 0);
    const level3 = screen.getByRole("button", {
      name: /Level 3: Idea Holder/,
    });
    fireEvent.click(level3);

    // Level 3's kidExplanation should now be visible.
    expect(screen.getByText(/Your essay should be about ONE thing/)).toBeDefined();
  });

  it("shows which tabs are unlocked at a level (level 3 unlocks brainstorm)", () => {
    renderOpen(3, 0);
    // Level 3 expanded by default; it unlocks the brainstorm tab.
    expect(screen.getByText(/Unlocks:/)).toBeDefined();
    expect(screen.getByText(/Brainstorm tab/)).toBeDefined();
  });

  it("renders the source attribution for a level", () => {
    renderOpen(1, 0);
    // 'Based on:' sits in its own <p>, with source names after a space.
    const sourceLine = screen.getByText(/Based on:/);
    expect(sourceLine.textContent).toMatch(/Hochman/);
  });
});
