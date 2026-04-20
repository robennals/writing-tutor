import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Essay } from "@/lib/queries";

const redirectSpy = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

const sessionRef: {
  current: { role: "child" | "parent"; name: string } | null;
} = { current: null };
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => sessionRef.current),
}));

vi.mock("@/lib/db-schema", () => ({
  initializeDatabase: vi.fn(async () => {}),
}));

const essayRef: { current: Essay | null } = { current: null };
vi.mock("@/lib/queries", () => ({
  getEssay: vi.fn(async () => essayRef.current),
  getMessages: vi.fn(async () => []),
  getSkillProgress: vi.fn(async () => [
    {
      writing_type: "opinion",
      current_level: 2,
      essays_completed_at_level: 1,
      level_earned_at: null,
    },
  ]),
  getSettings: vi.fn(async () => ({})),
}));

vi.mock("@/components/writing-screen", () => ({
  WritingScreen: ({
    currentLevel,
    isParentView,
    debugLevelActive,
  }: {
    currentLevel: number;
    isParentView: boolean;
    debugLevelActive?: boolean;
  }) => (
    <div data-testid="writing-screen">
      level={currentLevel}|parent={String(isParentView)}|debug=
      {String(Boolean(debugLevelActive))}
    </div>
  ),
}));

function params(
  id: string | number,
  searchParams: Record<string, string> = {}
) {
  return {
    params: Promise.resolve({ id: String(id) }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  redirectSpy.mockClear();
  sessionRef.current = null;
  essayRef.current = null;
});

describe("EssayPage server component", () => {
  it("redirects to /login when unauthenticated", async () => {
    const { default: EssayPage } = await import("./page");
    await expect(EssayPage(params(1))).rejects.toThrow(/REDIRECT:\/login/);
  });

  it("redirects home when the essay doesn't exist", async () => {
    sessionRef.current = { role: "child", name: "Owen" };
    essayRef.current = null;
    const { default: EssayPage } = await import("./page");
    await expect(EssayPage(params(999))).rejects.toThrow(/REDIRECT:\/$/);
  });

  it("renders the WritingScreen with the child's level", async () => {
    sessionRef.current = { role: "child", name: "Owen" };
    essayRef.current = {
      id: 1,
      title: "t",
      content: "",
      brainstorm_notes: "",
      outline: "",
      writing_type: "opinion",
      level: 1,
      current_step: "draft",
      active_tab: "draft",
      status: "in-progress",
      word_count: 0,
      created_at: "",
      updated_at: "",
      completed_at: null,
    };
    const { default: EssayPage } = await import("./page");
    const element = await EssayPage(params(1));

    const { render, screen } = await import("@testing-library/react");
    render(element);
    expect(screen.getByTestId("writing-screen").textContent).toContain(
      "level=2"
    );
    expect(screen.getByTestId("writing-screen").textContent).toContain(
      "parent=false"
    );
  });

  it("renders WritingScreen in parent view when session.role is parent", async () => {
    sessionRef.current = { role: "parent", name: "P" };
    essayRef.current = {
      id: 1,
      title: "t",
      content: "",
      brainstorm_notes: "",
      outline: "",
      writing_type: "opinion",
      level: 1,
      current_step: "draft",
      active_tab: "draft",
      status: "in-progress",
      word_count: 0,
      created_at: "",
      updated_at: "",
      completed_at: null,
    };
    const { default: EssayPage } = await import("./page");
    const element = await EssayPage(params(1));

    const { render, screen } = await import("@testing-library/react");
    render(element);
    expect(screen.getByTestId("writing-screen").textContent).toContain(
      "parent=true"
    );
  });

  it("applies ?debugLevel=N in development to override the skill_progress level", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      sessionRef.current = { role: "child", name: "Owen" };
      essayRef.current = {
        id: 1,
        title: "t",
        content: "",
        brainstorm_notes: "",
        outline: "",
        writing_type: "opinion",
        level: 1,
        current_step: "draft",
        active_tab: "draft",
        status: "in-progress",
        word_count: 0,
        created_at: "",
        updated_at: "",
        completed_at: null,
      };
      const { default: EssayPage } = await import("./page");
      const element = await EssayPage(params(1, { debugLevel: "8" }));

      const { render, screen } = await import("@testing-library/react");
      render(element);
      const text = screen.getByTestId("writing-screen").textContent;
      expect(text).toContain("level=8");
      expect(text).toContain("debug=true");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ignores ?debugLevel in dev when the value is missing, non-numeric, or out of range", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      sessionRef.current = { role: "child", name: "Owen" };
      essayRef.current = {
        id: 1,
        title: "t",
        content: "",
        brainstorm_notes: "",
        outline: "",
        writing_type: "opinion",
        level: 1,
        current_step: "draft",
        active_tab: "draft",
        status: "in-progress",
        word_count: 0,
        created_at: "",
        updated_at: "",
        completed_at: null,
      };
      const { default: EssayPage } = await import("./page");
      const { render, screen } = await import("@testing-library/react");

      // Each of these should fall through to the skill_progress level (2).
      const cases: Record<string, string>[] = [
        {},
        { debugLevel: "" },
        { debugLevel: "banana" },
        { debugLevel: "0" },
        { debugLevel: "999" },
      ];
      for (const raw of cases) {
        const element = await EssayPage(params(1, raw));
        const { unmount } = render(element);
        const text = screen.getByTestId("writing-screen").textContent;
        expect(text).toContain("level=2");
        expect(text).toContain("debug=false");
        unmount();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ignores ?debugLevel in production and uses the skill_progress level", async () => {
    // NODE_ENV defaults to 'test' in vitest — parseDebugLevel only honors
    // 'development', so the override must be silently dropped here.
    sessionRef.current = { role: "child", name: "Owen" };
    essayRef.current = {
      id: 1,
      title: "t",
      content: "",
      brainstorm_notes: "",
      outline: "",
      writing_type: "opinion",
      level: 1,
      current_step: "draft",
      active_tab: "draft",
      status: "in-progress",
      word_count: 0,
      created_at: "",
      updated_at: "",
      completed_at: null,
    };
    const { default: EssayPage } = await import("./page");
    const element = await EssayPage(params(1, { debugLevel: "8" }));

    const { render, screen } = await import("@testing-library/react");
    render(element);
    const text = screen.getByTestId("writing-screen").textContent;
    expect(text).toContain("level=2");
    expect(text).toContain("debug=false");
  });

  it("falls back to level 1 when the child has no progress row for the writing type", async () => {
    sessionRef.current = { role: "child", name: "Owen" };
    essayRef.current = {
      id: 1,
      title: "t",
      content: "",
      brainstorm_notes: "",
      outline: "",
      writing_type: "creative",
      level: 1,
      current_step: "draft",
      active_tab: "draft",
      status: "in-progress",
      word_count: 0,
      created_at: "",
      updated_at: "",
      completed_at: null,
    };
    const { default: EssayPage } = await import("./page");
    const element = await EssayPage(params(1));

    const { render, screen } = await import("@testing-library/react");
    render(element);
    expect(screen.getByTestId("writing-screen").textContent).toContain(
      "level=1"
    );
  });
});
