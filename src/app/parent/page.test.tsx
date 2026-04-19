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
  getSkillProgress: vi.fn(async () => []),
  getEssays: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({})),
}));

vi.mock("@/components/parent-dashboard", () => ({
  ParentDashboard: () => <div data-testid="parent-dashboard">ok</div>,
}));

beforeEach(() => {
  redirectSpy.mockClear();
  sessionRef.current = null;
});

describe("ParentPage server component", () => {
  it("redirects to /login when unauthenticated", async () => {
    const { default: ParentPage } = await import("./page");
    await expect(ParentPage()).rejects.toThrow(/REDIRECT:\/login/);
  });

  it("redirects non-parents to /", async () => {
    sessionRef.current = { role: "child", name: "Owen" };
    const { default: ParentPage } = await import("./page");
    await expect(ParentPage()).rejects.toThrow(/REDIRECT:\/$/);
  });

  it("renders the ParentDashboard when authenticated as parent", async () => {
    sessionRef.current = { role: "parent", name: "Parent" };
    const { default: ParentPage } = await import("./page");
    const element = await ParentPage();

    const { render, screen } = await import("@testing-library/react");
    render(element);
    expect(screen.getByTestId("parent-dashboard")).toBeDefined();
  });
});
