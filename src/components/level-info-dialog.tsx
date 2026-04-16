"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LEVELS, WRITING_TYPES, type WritingType } from "@/lib/levels";
import {
  Check,
  Lock,
  Star,
  Lightbulb,
  ListOrdered,
  PenLine,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function LevelInfoDialog({
  open,
  onOpenChange,
  writingType,
  currentLevel,
  essaysAtLevel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  writingType: WritingType;
  currentLevel: number;
  essaysAtLevel: number;
}) {
  const type = WRITING_TYPES.find((t) => t.id === writingType);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(
    currentLevel
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{type?.icon}</span>
            <span>{type?.name} Writing — Level Journey</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Click a level to see what it teaches, the techniques involved, and
            what passing looks like.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          {LEVELS.map((level) => {
            const isEarned = level.level < currentLevel;
            const isCurrent = level.level === currentLevel;
            const isLocked = level.level > currentLevel;
            const isExpanded = expandedLevel === level.level;
            const newTabs = getNewTabsUnlocked(level.level);

            return (
              <div
                key={level.level}
                className={cn(
                  "rounded-lg border transition-colors",
                  isCurrent &&
                    "border-amber-400/60 bg-amber-400/5 ring-1 ring-amber-400/30",
                  isEarned && "border-green-600/30 bg-green-600/5",
                  isLocked && "border-border/40 bg-muted/20"
                )}
              >
                {/* Header — always visible, clickable to expand */}
                <button
                  className="w-full p-3.5 flex items-start gap-3 text-left hover:bg-accent/30 rounded-lg transition-colors"
                  onClick={() =>
                    setExpandedLevel(isExpanded ? null : level.level)
                  }
                >
                  <div className="shrink-0 mt-0.5">
                    {isEarned && (
                      <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      </div>
                    )}
                    {isLocked && (
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center",
                          isLocked && "opacity-60"
                        )}
                      >
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isLocked && "text-muted-foreground"
                        )}
                      >
                        Level {level.level}: {level.name}
                      </span>
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 text-amber-400 border-amber-400/50"
                        >
                          Current
                        </Badge>
                      )}
                      {isEarned && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 text-green-400 border-green-400/50"
                        >
                          Earned
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground mt-0.5 italic",
                        isLocked && "opacity-70"
                      )}
                    >
                      {level.focus}
                    </p>
                    {isCurrent && (
                      <div className="mt-1 text-xs text-amber-400">
                        {essaysAtLevel}/{level.essaysToPass} essays at this
                        level
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40">
                    {/* Kid-friendly explanation */}
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-md p-3">
                      <p className="text-[11px] uppercase tracking-wide text-indigo-400 font-medium mb-1">
                        What this level is about
                      </p>
                      <p className="text-sm leading-relaxed">
                        {level.kidExplanation}
                      </p>
                    </div>

                    {/* What passing looks like */}
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                        What passing looks like
                      </p>
                      <p className="text-sm leading-relaxed">
                        {level.criteria}
                      </p>
                    </div>

                    {/* Techniques */}
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                        Techniques you&apos;ll learn
                      </p>
                      <ul className="space-y-1">
                        {level.techniques.map((t, i) => (
                          <li
                            key={i}
                            className="text-sm leading-relaxed flex gap-2"
                          >
                            <span className="text-indigo-400 shrink-0">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Example */}
                    {level.example && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                          Example of passing writing
                        </p>
                        <div className="bg-muted/30 rounded-md p-3 text-sm leading-relaxed italic text-muted-foreground">
                          &ldquo;{level.example}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* Meta footer — tabs, essays, sources */}
                    <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground font-medium">
                          {level.essaysToPass}
                        </span>{" "}
                        essays to pass
                      </span>

                      {newTabs.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span>Unlocks:</span>
                          {newTabs.map((tab) => (
                            <Badge
                              key={tab}
                              variant="secondary"
                              className="text-[10px] h-5 gap-1"
                            >
                              {tab === "brainstorm" && (
                                <Lightbulb className="h-3 w-3" />
                              )}
                              {tab === "outline" && (
                                <ListOrdered className="h-3 w-3" />
                              )}
                              {tab === "draft" && <PenLine className="h-3 w-3" />}
                              {tab.charAt(0).toUpperCase() + tab.slice(1)} tab
                            </Badge>
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Source attribution — for parents */}
                    {level.sources.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 pt-1 italic">
                        Based on:{" "}
                        {level.sources.join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getNewTabsUnlocked(level: number): string[] {
  const current = LEVELS[level - 1]?.availableTabs ?? [];
  const prior = level > 1 ? LEVELS[level - 2]?.availableTabs ?? [] : [];
  return current.filter((t) => !prior.includes(t));
}
