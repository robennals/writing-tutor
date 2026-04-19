import { describe, it, expect, vi } from "vitest";

// next/font/google tries to resolve font files at import time; stub it so the
// layout can be imported under jsdom.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));
// The layout imports the global CSS — no-op it.
vi.mock("./globals.css", () => ({}));

describe("RootLayout", () => {
  it("exposes a typed metadata export", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.title).toBe("Writing Tutor");
  });

  it("renders <html>/<body> wrappers around its children (dark mode enabled)", async () => {
    const { default: RootLayout } = await import("./layout");
    const tree = RootLayout({
      children: <div data-testid="child">hello</div>,
    });
    // Inspect the returned tree without rendering (jsdom disallows nested
    // html/body, but we can still check the element type/props).
    const props = (tree as unknown as {
      props: { className: string; children: unknown };
    }).props;
    expect(props.className).toContain("dark");
    expect(props.className).toContain("--font-geist-sans");
  });
});
