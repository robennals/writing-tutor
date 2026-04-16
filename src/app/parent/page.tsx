import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { initializeDatabase } from "@/lib/db-schema";
import { getSkillProgress, getEssays, getSettings } from "@/lib/queries";
import { ParentDashboard } from "@/components/parent-dashboard";

export default async function ParentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") redirect("/");

  await initializeDatabase();
  const [skillProgress, essays, settings] = await Promise.all([
    getSkillProgress(),
    getEssays(),
    getSettings(),
  ]);

  return (
    <ParentDashboard
      skillProgress={skillProgress}
      essays={essays}
      settings={settings}
    />
  );
}
