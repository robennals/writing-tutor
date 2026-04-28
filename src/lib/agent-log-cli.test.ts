import { describe, it, expect } from "vitest";
import { extractEssayId, resolveBaseUrl } from "./agent-log-cli";

describe("extractEssayId", () => {
  it("returns the integer when given a bare integer string", () => {
    expect(extractEssayId("42")).toBe(42);
  });

  it("extracts the id from a /essays/<id> path", () => {
    expect(extractEssayId("/essays/7")).toBe(7);
  });

  it("extracts the id from a localhost URL", () => {
    expect(extractEssayId("http://localhost:3000/essays/13")).toBe(13);
  });

  it("extracts the id from a production URL with a trailing slash", () => {
    expect(
      extractEssayId("https://writingtutor.robennals.org/essays/99/")
    ).toBe(99);
  });

  it("throws on input that doesn't contain an essay id", () => {
    expect(() => extractEssayId("not-an-id")).toThrow(/essay/i);
    expect(() => extractEssayId("")).toThrow(/essay/i);
    expect(() => extractEssayId("/essays/")).toThrow(/essay/i);
  });
});

describe("resolveBaseUrl", () => {
  it("returns localhost when prod is false", () => {
    expect(resolveBaseUrl(false)).toBe("http://localhost:3000");
  });

  it("returns the production URL when prod is true", () => {
    expect(resolveBaseUrl(true)).toBe("https://writingtutor.robennals.org");
  });
});
