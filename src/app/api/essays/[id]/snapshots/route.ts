import { getSession } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { createSnapshot, getSnapshots } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "child") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const { id } = await params;
  const { content } = (await req.json()) as { content: string };
  const snapshotId = await createSnapshot(Number(id), content);
  const [snap] = await getSnapshots(Number(id)).then((rows) =>
    rows.filter((r) => r.id === snapshotId)
  );
  return NextResponse.json({ id: snapshotId, created_at: snap.created_at });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const { id } = await params;
  const snapshots = await getSnapshots(Number(id));
  return NextResponse.json({ snapshots });
}
