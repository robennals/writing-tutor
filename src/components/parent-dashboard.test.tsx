import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParentDashboard } from "./parent-dashboard";
import type { SkillProgress, Essay } from "@/lib/queries";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
}));

const progress: SkillProgress[] = [
  {
    writing_type: "opinion",
    current_level: 3,
    essays_completed_at_level: 1,
    level_earned_at: null,
  },
  {
    writing_type: "creative",
    current_level: 2,
    essays_completed_at_level: 0,
    level_earned_at: null,
  },
  {
    writing_type: "informational",
    current_level: 1,
    essays_completed_at_level: 0,
    level_earned_at: null,
  },
];

function makeEssay(overrides: Partial<Essay> = {}): Essay {
  return {
    id: 1,
    title: "E",
    content: "",
    brainstorm_notes: "",
    outline: "",
    writing_type: "opinion",
    level: 1,
    current_step: "draft",
    active_tab: "draft",
    status: "in-progress",
    word_count: 0,
    created_at: "2026-01-01",
    updated_at: "2026-04-18",
    completed_at: null,
    ...overrides,
  };
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  pushSpy.mockClear();
  fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
  // @ts-expect-error — override for observation.
  globalThis.fetch = fetchSpy;
});

describe("ParentDashboard", () => {
  const baseSettings = {
    tts_essay: "true",
    tts_tutor: "true",
    dyslexia_font: "false",
  };

  it("shows summary stats: completed essays, levels earned, and total essays", () => {
    const essays = [
      makeEssay({ id: 1, status: "completed" }),
      makeEssay({ id: 2, status: "completed" }),
      makeEssay({ id: 3, status: "in-progress" }),
    ];
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={essays}
        settings={baseSettings}
      />
    );
    // Levels earned = (3-1)+(2-1)+(1-1) = 3. Completed essays = 2. Total = 3.
    const completedLabel = screen.getByText(/Completed Essays/);
    const levelsLabel = screen.getByText(/Levels Earned/);
    const totalLabel = screen.getByText(/Total Essays/);
    // The number is a sibling of the label within the same card.
    expect(completedLabel.previousElementSibling?.textContent).toBe("2");
    expect(levelsLabel.previousElementSibling?.textContent).toBe("3");
    expect(totalLabel.previousElementSibling?.textContent).toBe("3");
  });

  it("shows an empty state when there are no essays", () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    expect(screen.getByText(/No essays yet/)).toBeDefined();
  });

  it("displays each skill's current level", () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    expect(screen.getByText(/Level 3 — Idea Holder/)).toBeDefined();
    expect(screen.getByText(/Level 2 — Sentence Expander/)).toBeDefined();
  });

  it("routes to /essays/:id when an essay row is clicked", () => {
    const essays = [makeEssay({ id: 77, title: "Dogs" })];
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={essays}
        settings={baseSettings}
      />
    );
    fireEvent.click(screen.getByText("Dogs"));
    expect(pushSpy).toHaveBeenCalledWith("/essays/77");
  });

  it("toggles a setting: optimistic UI update and POSTs /api/settings", async () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    const toggle = screen.getByRole("switch", {
      name: /Text-to-speech for essays/,
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ key: "tts_essay", value: "false" }),
        })
      )
    );
  });

  it("'Student's View' button routes to /", () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Student.+View/ }));
    expect(pushSpy).toHaveBeenCalledWith("/");
  });

  it("Log out button calls DELETE /api/auth and routes to /login", async () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Log out/ }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth", { method: "DELETE" })
    );
    expect(pushSpy).toHaveBeenCalledWith("/login");
  });

  it("toggles the tts-tutor and dyslexia-font settings with separate POSTs", async () => {
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={[]}
        settings={baseSettings}
      />
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /Text-to-speech for tutor/ })
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /Dyslexia-friendly font/ })
    );
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          body: JSON.stringify({ key: "tts_tutor", value: "false" }),
        })
      )
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        body: JSON.stringify({ key: "dyslexia_font", value: "true" }),
      })
    );
  });

  it("caps the essay list at 10 rows", () => {
    const essays = Array.from({ length: 15 }, (_, i) =>
      makeEssay({ id: i + 1, title: `Essay ${i + 1}` })
    );
    render(
      <ParentDashboard
        skillProgress={progress}
        essays={essays}
        settings={baseSettings}
      />
    );
    // Should see 1..10, not 11..15.
    expect(screen.queryByText("Essay 11")).toBeNull();
    expect(screen.getByText("Essay 10")).toBeDefined();
  });
});
