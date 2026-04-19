/**
 * Test-only: build an in-memory libsql client that can substitute for the
 * default export of `./db` inside a `vi.mock` block.
 */
import { createClient, type Client } from "@libsql/client";

export function createInMemoryDb(): Client {
  return createClient({ url: ":memory:" });
}
