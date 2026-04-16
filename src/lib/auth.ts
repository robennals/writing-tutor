import { cookies } from "next/headers";

export type UserRole = "child" | "parent";

interface Session {
  role: UserRole;
  name: string;
}

const CHILD_USERNAME = "owen";
const PARENT_USERNAME = "parent";

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;
  try {
    return JSON.parse(sessionCookie.value) as Session;
  } catch {
    return null;
  }
}

export function validateLogin(
  username: string,
  password: string
): Session | null {
  const childPassword = process.env.CHILD_PASSWORD ?? "owen123";
  const parentPassword = process.env.PARENT_PASSWORD ?? "parent123";

  if (username.toLowerCase() === CHILD_USERNAME && password === childPassword) {
    return { role: "child", name: "Owen" };
  }
  if (
    username.toLowerCase() === PARENT_USERNAME &&
    password === parentPassword
  ) {
    return { role: "parent", name: "Parent" };
  }
  return null;
}
