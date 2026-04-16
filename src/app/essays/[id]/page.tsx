import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { initializeDatabase } from "@/lib/db-schema";
import { getEssay, getMessages, getSkillProgress, getSettings } from "@/lib/queries";
import { WritingScreen } from "@/components/writing-screen";

export default async function EssayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  await initializeDatabase();
  const { id } = await params;
  const essay = await getEssay(Number(id));
  if (!essay) redirect("/");

  const [messages, skillProgress, settings] = await Promise.all([
    getMessages(essay.id),
    getSkillProgress(),
    getSettings(),
  ]);

  const progress = skillProgress.find(
    (p) => p.writing_type === essay.writing_type
  );

  return (
    <WritingScreen
      essay={essay}
      initialMessages={messages}
      currentLevel={progress?.current_level ?? 1}
      essaysAtLevel={progress?.essays_completed_at_level ?? 0}
      settings={settings}
      isParentView={session.role === "parent"}
    />
  );
}
