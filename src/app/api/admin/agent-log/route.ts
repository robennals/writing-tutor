import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { initializeDatabase } from "@/lib/db-schema";
import { getAgentCalls } from "@/lib/queries";

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

/**
 * Constant-time compare. Rejects mismatched lengths first (which itself
 * leaks length, but the secret's length is fixed in any real deployment, so
 * a misconfigured-shorter key is the operator's problem).
 */
function keyMatches(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_LOG_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "admin endpoint not configured" },
      { status: 503 }
    );
  }
  if (!keyMatches(req.headers.get("x-admin-key"), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = authorize(req);
  if (authError) return authError;

  const essayIdRaw = new URL(req.url).searchParams.get("essayId");
  if (!essayIdRaw || !/^\d+$/.test(essayIdRaw)) {
    return NextResponse.json({ error: "essayId required" }, { status: 400 });
  }

  await ensureDb();
  const rows = await getAgentCalls(Number(essayIdRaw));
  return NextResponse.json(rows);
}
