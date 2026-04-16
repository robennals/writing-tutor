import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { getSettings, updateSetting } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "parent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
  const { key, value } = await req.json();
  await updateSetting(key, value);
  return NextResponse.json({ ok: true });
}
