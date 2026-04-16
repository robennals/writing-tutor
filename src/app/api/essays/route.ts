import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { createEssay, getEssays, getSkillProgress } from "@/lib/queries";
import type { WritingType } from "@/lib/levels";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDb();
  const essays = await getEssays();
  return NextResponse.json(essays);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "child") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const { title, writingType } = (await req.json()) as {
    title: string;
    writingType: WritingType;
  };

  const progress = await getSkillProgress();
  const typeProgress = progress.find((p) => p.writing_type === writingType);
  const level = typeProgress?.current_level ?? 1;

  const id = await createEssay(title, writingType, level);
  return NextResponse.json({ id });
}
