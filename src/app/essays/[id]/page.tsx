import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { initializeDatabase } from "@/lib/db-schema";
import { getEssay, getMessages, getSkillProgress, getSettings } from "@/lib/queries";
import { WritingScreen } from "@/components/writing-screen";
import { LEVELS } from "@/lib/levels";

export default async function EssayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  await initializeDatabase();
  const { id } = await params;
  const essay = await getEssay(Number(id));
  if (!essay) redirect("/");

  const [messages, skillProgress, settings, query] = await Promise.all([
    getMessages(essay.id),
    getSkillProgress(),
    getSettings(),
    searchParams,
  ]);

  const progress = skillProgress.find(
    (p) => p.writing_type === essay.writing_type
  );

  // Dev-only level override: append ?debugLevel=N to the URL to preview the
  // editor at any level without touching skill_progress. Ignored in production.
  const debugLevel = parseDebugLevel(query.debugLevel);
  const currentLevel = debugLevel ?? progress?.current_level ?? 1;

  return (
    <WritingScreen
      essay={essay}
      initialMessages={messages}
      currentLevel={currentLevel}
      essaysAtLevel={progress?.essays_completed_at_level ?? 0}
      settings={settings}
      isParentView={session.role === "parent"}
      debugLevelActive={debugLevel !== null}
    />
  );
}

function parseDebugLevel(raw: string | string[] | undefined): number | null {
  if (process.env.NODE_ENV !== "development") return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1 || n > LEVELS.length) return null;
  return n;
}
