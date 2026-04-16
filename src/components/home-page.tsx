"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WRITING_TYPES, getLevel, type WritingType } from "@/lib/levels";
import type { SkillProgress, Essay } from "@/lib/queries";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { NewEssayDialog } from "./new-essay-dialog";
import { LevelInfoDialog } from "./level-info-dialog";

export function HomePage({
  name,
  skillProgress,
  essays,
}: {
  name: string;
  skillProgress: SkillProgress[];
  essays: Essay[];
  settings: Record<string, string>;
}) {
  const router = useRouter();
  const [showNewEssay, setShowNewEssay] = useState(false);
  const [levelInfoType, setLevelInfoType] = useState<WritingType | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">✏️</span>
            <span className="font-semibold text-base">Writing Tutor</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await fetch("/api/auth", { method: "DELETE" });
                router.push("/login");
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {/* Welcome & New Essay */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Hey {name}! 👋</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ready to write something awesome?
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2 shadow-lg shadow-primary/20"
            onClick={() => setShowNewEssay(true)}
          >
            <Plus className="h-4 w-4" />
            New Essay
          </Button>
        </div>

        {/* Skill Trees */}
        <div className="mb-8">
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Your Writing Skills
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {WRITING_TYPES.map((type) => {
              const progress = skillProgress.find(
                (p) => p.writing_type === type.id
              );
              const level = progress?.current_level ?? 1;
              const levelDef = getLevel(level);
              const completed = progress?.essays_completed_at_level ?? 0;
              const needed = levelDef.essaysToPass;
              const pct = (completed / needed) * 100;

              return (
                <Card
                  key={type.id}
                  className="bg-card hover:bg-accent/40 transition-colors cursor-pointer"
                  onClick={() => setLevelInfoType(type.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">
                        {type.icon} {type.name}
                      </span>
                      <Badge variant="outline" className={type.color}>
                        Level {level}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {levelDef.name}
                    </p>
                    <Progress value={pct} className="h-1.5 mb-1" />
                    <p className="text-[11px] text-muted-foreground">
                      {completed} of {needed} essays done
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Essay Collection */}
        <div>
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            My Essays
          </h2>
          {essays.length === 0 ? (
            <Card className="bg-card">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No essays yet. Click &quot;New Essay&quot; to start writing!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {essays.map((essay) => {
                const type = WRITING_TYPES.find(
                  (t) => t.id === essay.writing_type
                );
                const isComplete = essay.status === "completed";
                return (
                  <Card
                    key={essay.id}
                    className="bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/essays/${essay.id}`)}
                  >
                    <CardContent className="p-3.5 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {isComplete ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-amber-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{essay.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {type?.icon} {type?.name} &bull; Level {essay.level}{" "}
                            &bull;{" "}
                            {isComplete
                              ? "Completed"
                              : `Step: ${essay.current_step}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(essay.updated_at).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <NewEssayDialog
        open={showNewEssay}
        onOpenChange={setShowNewEssay}
        skillProgress={skillProgress}
      />

      {levelInfoType && (
        <LevelInfoDialog
          open={!!levelInfoType}
          onOpenChange={(open) => !open && setLevelInfoType(null)}
          writingType={levelInfoType}
          currentLevel={
            skillProgress.find((p) => p.writing_type === levelInfoType)
              ?.current_level ?? 1
          }
          essaysAtLevel={
            skillProgress.find((p) => p.writing_type === levelInfoType)
              ?.essays_completed_at_level ?? 0
          }
        />
      )}
    </div>
  );
}
