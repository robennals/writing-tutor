import { validateLogin } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db-schema";
import { NextRequest, NextResponse } from "next/server";

let dbInitialized = false;

export async function POST(req: NextRequest) {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }

  const { username, password } = await req.json();
  const session = validateLogin(username, password);

  if (!session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: session.role });
  response.cookies.set("session", JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session");
  return response;
}
