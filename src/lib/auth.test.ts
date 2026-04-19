import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => cookieStore.get(name),
  })),
}));

describe("validateLogin", () => {
  beforeEach(() => {
    // Reset env between tests since validateLogin reads process.env each call.
    delete process.env.CHILD_PASSWORD;
    delete process.env.PARENT_PASSWORD;
  });

  it("returns a child session for valid owen credentials using the default password", async () => {
    const { validateLogin } = await import("./auth");
    expect(validateLogin("owen", "owen123")).toEqual({
      role: "child",
      name: "Owen",
    });
  });

  it("accepts uppercase/mixed-case usernames (normalized via toLowerCase)", async () => {
    const { validateLogin } = await import("./auth");
    expect(validateLogin("OWEN", "owen123")?.role).toBe("child");
    expect(validateLogin("Parent", "parent123")?.role).toBe("parent");
  });

  it("returns a parent session for valid parent credentials", async () => {
    const { validateLogin } = await import("./auth");
    expect(validateLogin("parent", "parent123")).toEqual({
      role: "parent",
      name: "Parent",
    });
  });

  it("honors overridden passwords from env vars", async () => {
    process.env.CHILD_PASSWORD = "secretKid";
    process.env.PARENT_PASSWORD = "secretGrownup";
    const { validateLogin } = await import("./auth");
    expect(validateLogin("owen", "owen123")).toBeNull();
    expect(validateLogin("owen", "secretKid")?.role).toBe("child");
    expect(validateLogin("parent", "secretGrownup")?.role).toBe("parent");
  });

  it("returns null on wrong password or unknown username", async () => {
    const { validateLogin } = await import("./auth");
    expect(validateLogin("owen", "wrong")).toBeNull();
    expect(validateLogin("stranger", "owen123")).toBeNull();
    expect(validateLogin("", "")).toBeNull();
  });
});

describe("getSession", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it("returns null when no session cookie is set", async () => {
    const { getSession } = await import("./auth");
    expect(await getSession()).toBeNull();
  });

  it("returns the parsed session when the cookie contains valid JSON", async () => {
    cookieStore.set("session", {
      value: JSON.stringify({ role: "child", name: "Owen" }),
    });
    const { getSession } = await import("./auth");
    expect(await getSession()).toEqual({ role: "child", name: "Owen" });
  });

  it("returns null when the cookie value isn't valid JSON (doesn't throw)", async () => {
    cookieStore.set("session", { value: "not-json{" });
    const { getSession } = await import("./auth");
    expect(await getSession()).toBeNull();
  });
});
