import { describe, it, expect, vi, afterEach } from "vitest";

const createClientSpy = vi.fn();
vi.mock("@libsql/client", () => ({
  createClient: (args: unknown) => {
    createClientSpy(args);
    return { kind: "fake-client" };
  },
}));

afterEach(() => {
  createClientSpy.mockClear();
  vi.resetModules();
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
});

describe("db module", () => {
  it("creates a client using the TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars when present", async () => {
    process.env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    process.env.TURSO_AUTH_TOKEN = "token123";

    const mod = await import("./db");
    expect(mod.default).toEqual({ kind: "fake-client" });
    expect(createClientSpy).toHaveBeenCalledWith({
      url: "libsql://example.turso.io",
      authToken: "token123",
    });
  });

  it("falls back to file:local.db and an undefined auth token when env vars are absent", async () => {
    const mod = await import("./db");
    expect(mod.default).toEqual({ kind: "fake-client" });
    expect(createClientSpy).toHaveBeenCalledWith({
      url: "file:local.db",
      authToken: undefined,
    });
  });
});
