import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffView } from "./diff-view";

describe("DiffView", () => {
  it("renders plain content with '(first version)' caption when prev is null", () => {
    render(<DiffView prev={null} current="<p>Hello world</p>" />);
    expect(screen.getByText(/first version/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
  });

  it("renders '(no edits ...)' caption when prev and current are identical text", () => {
    const html = "<p>Same text</p>";
    render(<DiffView prev={html} current={html} />);
    expect(screen.getByText(/no edits between this version/i)).toBeInTheDocument();
    expect(screen.getByText(/Same text/)).toBeInTheDocument();
  });

  it("marks added words bold + underlined and removed words struck-through and faint", () => {
    const { container } = render(
      <DiffView prev="<p>The cat sat</p>" current="<p>The fluffy cat ran</p>" />
    );
    // Added: "fluffy" and "ran"
    const added = Array.from(container.querySelectorAll("[data-diff='added']"));
    const addedText = added.map((n) => n.textContent).join(" ");
    expect(addedText).toMatch(/fluffy/);
    expect(addedText).toMatch(/ran/);

    // Removed: "sat"
    const removed = Array.from(
      container.querySelectorAll("[data-diff='removed']")
    );
    const removedText = removed.map((n) => n.textContent).join(" ");
    expect(removedText).toMatch(/sat/);

    // Styling sanity: added is bold + underline, removed is line-through + low opacity.
    expect(added[0].className).toMatch(/font-bold/);
    expect(added[0].className).toMatch(/underline/);
    expect(removed[0].className).toMatch(/line-through/);
    expect(removed[0].className).toMatch(/text-rose-400\/50/);
  });

  it("preserves paragraph breaks", () => {
    const { container } = render(
      <DiffView
        prev={null}
        current="<p>First paragraph.</p><p>Second paragraph.</p>"
      />
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});
