"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getLevel, WRITING_TYPES } from "@/lib/levels";
import { Suspense } from "react";

function LevelUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newLevel = Number(searchParams.get("newLevel") ?? 2);
  const writingType = searchParams.get("type") ?? "opinion";

  const levelDef = getLevel(newLevel);
  const type = WRITING_TYPES.find((t) => t.id === writingType);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center px-6 max-w-md">
        {/* Big Star */}
        <div className="text-7xl mb-4 animate-bounce">⭐</div>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent mb-2">
          LEVEL UP!
        </h1>

        <p className="text-muted-foreground mb-6">You&apos;re now a</p>

        <div className="inline-block border-2 border-amber-400/50 bg-amber-400/10 rounded-2xl px-8 py-4 mb-6">
          <p className="text-sm text-amber-400 mb-1">
            {type?.icon} {type?.name} Writing
          </p>
          <p className="text-2xl font-bold">
            Level {newLevel}: {levelDef.name}
          </p>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {levelDef.focus} — that&apos;s a superpower! 💪
        </p>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`text-2xl ${i < newLevel ? "text-amber-400" : "text-muted"}`}
            >
              ★
            </span>
          ))}
        </div>

        {newLevel < 10 && (
          <p className="text-xs text-muted-foreground mb-6">
            Next up: <strong>Level {newLevel + 1}: {getLevel(newLevel + 1).name}</strong> — {getLevel(newLevel + 1).focus}
          </p>
        )}

        <Button
          size="lg"
          className="shadow-lg shadow-primary/20"
          onClick={() => router.push("/")}
        >
          Keep Writing!
        </Button>
      </div>
    </div>
  );
}

export default function LevelUpPage() {
  return (
    <Suspense>
      <LevelUpContent />
    </Suspense>
  );
}
