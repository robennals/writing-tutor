"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WRITING_TYPES, getLevel } from "@/lib/levels";
import type { SkillProgress, Essay } from "@/lib/queries";
import { Check } from "lucide-react";
import { useState } from "react";

export function ParentDashboard({
  skillProgress,
  essays,
  settings: initialSettings,
}: {
  skillProgress: SkillProgress[];
  essays: Essay[];
  settings: Record<string, string>;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);

  async function toggleSetting(key: string) {
    const newValue = settings[key] === "true" ? "false" : "true";
    setSettings({ ...settings, [key]: newValue });
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: newValue }),
    });
  }

  const totalEssays = essays.filter((e) => e.status === "completed").length;
  const totalLevels = skillProgress.reduce(
    (sum, p) => sum + (p.current_level - 1),
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">👨‍👩‍👦</span>
            <span className="font-semibold text-base">Parent Dashboard</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              Student&apos;s View
            </Button>
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

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">{totalEssays}</p>
              <p className="text-xs text-muted-foreground">
                Completed Essays
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{totalLevels}</p>
              <p className="text-xs text-muted-foreground">Levels Earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {essays.length}
              </p>
              <p className="text-xs text-muted-foreground">Total Essays</p>
            </CardContent>
          </Card>
        </div>

        {/* Skill Levels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skill Levels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {WRITING_TYPES.map((type, i) => {
              const progress = skillProgress.find(
                (p) => p.writing_type === type.id
              );
              const level = progress?.current_level ?? 1;
              const levelDef = getLevel(level);
              return (
                <div key={type.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm">
                      {type.icon} {type.name}
                    </span>
                    <Badge variant="outline" className={type.color}>
                      Level {level} — {levelDef.name}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Essays */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Essays (click to read)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {essays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No essays yet.</p>
            ) : (
              essays.slice(0, 10).map((essay, i) => {
                const type = WRITING_TYPES.find(
                  (t) => t.id === essay.writing_type
                );
                const isComplete = essay.status === "completed";
                return (
                  <div key={essay.id}>
                    {i > 0 && <Separator className="my-1" />}
                    <div
                      className="py-2 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2"
                      onClick={() => router.push(`/essays/${essay.id}`)}
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-medium">
                          {essay.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isComplete ? "text-green-400" : "text-amber-400"
                          }
                        >
                          {isComplete ? (
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3" /> Completed
                            </span>
                          ) : (
                            "In progress"
                          )}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {type?.icon} {type?.name} &bull; Level {essay.level}{" "}
                        &bull; {essay.word_count} words &bull;{" "}
                        {new Date(essay.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-essay" className="text-sm">
                Text-to-speech for essays
              </Label>
              <Switch
                id="tts-essay"
                checked={settings.tts_essay === "true"}
                onCheckedChange={() => toggleSetting("tts_essay")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-tutor" className="text-sm">
                Text-to-speech for tutor
              </Label>
              <Switch
                id="tts-tutor"
                checked={settings.tts_tutor === "true"}
                onCheckedChange={() => toggleSetting("tts_tutor")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dyslexia-font" className="text-sm">
                Dyslexia-friendly font
              </Label>
              <Switch
                id="dyslexia-font"
                checked={settings.dyslexia_font === "true"}
                onCheckedChange={() => toggleSetting("dyslexia_font")}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
