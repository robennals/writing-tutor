import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/queries", () => ({
  getSkillProgress: vi.fn(async () => [
    {
      writing_type: "opinion",
      current_level: 1,
      essays_completed_at_level: 0,
      level_earned_at: null,
    },
  ]),
  getEssays: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({ tts_essay: "true" })),
}));

// HomePage is tested separately — stub it so we only verify that Home passes
// the right props down.
vi.mock("@/components/home-page", () => ({
  HomePage: ({ name }: { name: string }) => <div data-testid="home">{name}</div>,
}));

beforeEach(() => {
  redirectSpy.mockClear();
  sessionRef.current = null;
});

describe("Home server component", () => {
  it("redirects to /login when there's no session", async () => {
    const { default: Home } = await import("./page");
    await expect(Home()).rejects.toThrow(/REDIRECT:\/login/);
  });

  it("redirects parents to /parent", async () => {
    sessionRef.current = { role: "parent", name: "Parent" };
    const { default: Home } = await import("./page");
    await expect(Home()).rejects.toThrow(/REDIRECT:\/parent/);
  });

  it("renders HomePage with the child's name when authenticated as child", async () => {
    sessionRef.current = { role: "child", name: "Owen" };
    const { default: Home } = await import("./page");
    const element = await Home();

    const { render, screen } = await import("@testing-library/react");
    render(element);
    expect(screen.getByTestId("home").textContent).toBe("Owen");
  });
});
