import { describe, it, expect } from "vitest";
import { cn, htmlToPlainText } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("skips falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("applies tailwind-merge: later utility wins over earlier conflicting one", () => {
    // twMerge collapses `p-2 p-4` → `p-4`.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("accepts object and array inputs (clsx behavior)", () => {
    expect(cn({ a: true, b: false }, ["c", "d"])).toBe("a c d");
  });
});

describe("htmlToPlainText", () => {
  it("returns empty for empty/undefined input", () => {
    expect(htmlToPlainText("")).toBe("");
  });

  it("strips a single <p> wrapper", () => {
    expect(htmlToPlainText("<p>Hello world</p>")).toBe("Hello world");
  });

  it("preserves capitalization exactly — the whole reason we're switching from HTML", () => {
    expect(htmlToPlainText("<p>I love food. Fruit is good.</p>")).toBe(
      "I love food. Fruit is good."
    );
  });

  it("turns paragraph breaks into a blank line", () => {
    expect(htmlToPlainText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
  });

  it("turns <br> into a single newline", () => {
    expect(htmlToPlainText("<p>Line 1<br>Line 2</p>")).toBe("Line 1\nLine 2");
    expect(htmlToPlainText("<p>Line 1<br/>Line 2</p>")).toBe("Line 1\nLine 2");
  });

  it("decodes the entities Tiptap actually emits", () => {
    expect(htmlToPlainText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
    expect(htmlToPlainText("<p>Don&#39;t stop</p>")).toBe("Don't stop");
    expect(htmlToPlainText("<p>&quot;hi&quot;</p>")).toBe('"hi"');
    expect(htmlToPlainText("<p>a&nbsp;b</p>")).toBe("a b");
    expect(htmlToPlainText("<p>2 &lt; 3 &gt; 1</p>")).toBe("2 < 3 > 1");
  });

  it("strips inline tags like <strong> without leaking content", () => {
    expect(htmlToPlainText("<p>Hello <strong>world</strong>!</p>")).toBe(
      "Hello world!"
    );
  });

  it("trims leading/trailing whitespace from the final result", () => {
    expect(htmlToPlainText("<p>  hi  </p>")).toBe("hi");
  });
});
