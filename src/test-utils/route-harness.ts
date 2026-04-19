/**
 * Test-only: shared setup for API route tests.
 * - Swaps @/lib/db for an in-memory libsql client (fresh per test)
 * - Mocks @/lib/auth.getSession to a configurable session
 * - Provides `buildRequest` and `sessionControl` helpers
 */
import { vi } from "vitest";
import type { Client } from "@libsql/client";
import type { NextRequest } from "next/server";
import { createInMemoryDb } from "./in-memory-db";

export interface SessionLike {
  role: "child" | "parent";
  name: string;
}

export interface RouteHarness {
  db: Client;
  session: { current: SessionLike | null };
}

export function createRouteHarness(): RouteHarness {
  const db = createInMemoryDb();
  const session = { current: null as SessionLike | null };

  vi.doMock("@/lib/db", () => ({
    get default() {
      return db;
    },
  }));

  vi.doMock("@/lib/auth", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth")>(
      "@/lib/auth"
    );
    return {
      ...actual,
      getSession: vi.fn(async () => session.current),
    };
  });

  return { db, session };
}

export function buildRequest(
  url: string,
  init: RequestInit = {}
): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

export function jsonRequest(
  url: string,
  body: unknown,
  method = "POST"
): NextRequest {
  return buildRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
