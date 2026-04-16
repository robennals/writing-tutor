import { initializeDatabase } from "@/lib/db-schema";
import { NextResponse } from "next/server";

// Initialize database on first request
let initialized = false;

export async function GET() {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
  return NextResponse.json({ ok: true });
}
