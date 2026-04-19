import { describe, it, expect } from "vitest";
import { cn } from "./utils";

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
