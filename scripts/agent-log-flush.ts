#!/usr/bin/env node
import { resolveBaseUrl } from "../src/lib/agent-log-cli.ts";

async function main() {
  const args = process.argv.slice(2);
  const prod = args.includes("--prod");
  const baseUrl = resolveBaseUrl(prod);

  const key = process.env.ADMIN_LOG_KEY;
  if (!key) {
    console.error(
      "ADMIN_LOG_KEY is not set. Add it to .env.local (the pnpm script loads it via --env-file)."
    );
    process.exit(2);
  }

  const url = `${baseUrl}/api/admin/agent-log`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-admin-key": key },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${url}:`);
    console.error(await res.text());
    process.exit(1);
  }
  const body = (await res.json()) as { deleted: number };
  console.log(`Deleted ${body.deleted} agent_call rows from ${baseUrl}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
