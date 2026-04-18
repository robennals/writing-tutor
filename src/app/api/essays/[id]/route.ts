import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import {
  getEssay,
  updateEssay,
  getMessages,
  recomputeSkillLevel,
  completeEssayIfInProgress,
} from "@/lib/queries";
import type { WritingType } from "@/lib/levels";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDb();
  const { id } = await params;
  const essay = await getEssay(Number(id));
  if (!essay) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await getMessages(essay.id);
  return NextResponse.json({ essay, messages });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "child") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const { id } = await params;
  const body = await req.json();

  const essay = await getEssay(Number(id));
  if (!essay) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Essay completion. Flipping the status is atomic at the DB level (conditional
  // UPDATE), and the skill level is derived from the essays table by
  // recomputeSkillLevel — so duplicate submits can't inflate progress.
  if (body.status === "completed") {
    await completeEssayIfInProgress(Number(id));
    const { leveledUp, newLevel } = await recomputeSkillLevel(
      essay.writing_type as WritingType
    );
    return NextResponse.json({ ok: true, leveledUp, newLevel });
  }

  await updateEssay(Number(id), body);
  return NextResponse.json({ ok: true });
}
