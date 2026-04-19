import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HomePage } from "./home-page";
import type { SkillProgress, Essay } from "@/lib/queries";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn() }),
}));

const progress: SkillProgress[] = [
  {
    writing_type: "opinion",
    current_level: 2,
    essays_completed_at_level: 1,
    level_earned_at: null,
  },
  {
    writing_type: "creative",
    current_level: 1,
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
    title: "My First Essay",
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
  // @ts-expect-error — jsdom does ship fetch, but we want to observe calls.
  globalThis.fetch = fetchSpy;
});

describe("HomePage", () => {
  it("greets the user by name", () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    expect(screen.getByText(/Hey Owen!/)).toBeDefined();
  });

  it("shows the empty-state card when there are no essays", () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    expect(screen.getByText(/No essays yet/)).toBeDefined();
  });

  it("lists each essay with its title, level, and status (in-progress shows the current step)", () => {
    const essays = [
      makeEssay({ id: 1, title: "Dogs" }),
      makeEssay({ id: 2, title: "Pizza", status: "completed", level: 2 }),
    ];
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={essays}
        settings={{}}
      />
    );
    expect(screen.getByText("Dogs")).toBeDefined();
    expect(screen.getByText("Pizza")).toBeDefined();
    expect(screen.getByText(/Step: draft/)).toBeDefined();
    expect(screen.getByText(/Completed/)).toBeDefined();
  });

  it("routes to /essays/:id when an essay row is clicked", () => {
    const essays = [makeEssay({ id: 42 })];
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={essays}
        settings={{}}
      />
    );
    fireEvent.click(screen.getByText("My First Essay"));
    expect(pushSpy).toHaveBeenCalledWith("/essays/42");
  });

  it("opens the New Essay dialog when the top-right button is clicked", () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /New Essay/ }));
    expect(screen.getByText(/What kind of writing\?/)).toBeDefined();
  });

  it("opens the LevelInfoDialog for a type when its skill card is clicked", () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    fireEvent.click(screen.getByText(/💬 Opinion/));
    expect(screen.getByText(/Opinion Writing — Level Journey/)).toBeDefined();
  });

  it("closes the LevelInfoDialog when its onOpenChange handler fires with false", () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    fireEvent.click(screen.getByText(/💬 Opinion/));
    expect(screen.getByText(/Opinion Writing — Level Journey/)).toBeDefined();

    // The dialog is a Radix-style Dialog; simulate close via Escape key on body.
    fireEvent.keyDown(document.body, { key: "Escape" });
    // After close, HomePage clears levelInfoType → dialog unmounts.
    expect(screen.queryByText(/Opinion Writing — Level Journey/)).toBeNull();
  });

  it("logs out: POSTs DELETE /api/auth then routes to /login", async () => {
    render(
      <HomePage
        name="Owen"
        skillProgress={progress}
        essays={[]}
        settings={{}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Log out/ }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth", { method: "DELETE" })
    );
    expect(pushSpy).toHaveBeenCalledWith("/login");
  });

  it("shows the 'No essays' branch even when progress is empty (falls back to level 1)", () => {
    render(
      <HomePage name="Owen" skillProgress={[]} essays={[]} settings={{}} />
    );
    // All three skill cards default to Level 1.
    expect(screen.getAllByText(/Level 1/).length).toBe(3);
  });

  it("opening the level info dialog with no matching progress row falls back to level 1 / 0 essays", () => {
    // No skill_progress rows — the `?? 1` / `?? 0` branches in the dialog
    // props have to kick in.
    render(
      <HomePage name="Owen" skillProgress={[]} essays={[]} settings={{}} />
    );
    fireEvent.click(screen.getByText(/💬 Opinion/));
    // Dialog renders; at level 1 level 1 is 'Current' and essays-at-level 0.
    expect(screen.getByText(/0\/3 essays at this level/)).toBeDefined();
  });
});
