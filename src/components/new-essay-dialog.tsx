"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WRITING_TYPES, getLevel } from "@/lib/levels";
import type { WritingType } from "@/lib/levels";
import type { SkillProgress } from "@/lib/queries";

export function NewEssayDialog({
  open,
  onOpenChange,
  skillProgress,
  initialType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillProgress: SkillProgress[];
  initialType?: WritingType;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "topic">(
    initialType ? "topic" : "type"
  );
  const [selectedType, setSelectedType] = useState<WritingType | null>(
    initialType ?? null
  );
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  function handleClose(open: boolean) {
    if (!open) {
      setStep(initialType ? "topic" : "type");
      setSelectedType(initialType ?? null);
      setTitle("");
    }
    onOpenChange(open);
  }

  async function handleCreate() {
    if (!selectedType || !title.trim()) return;
    setCreating(true);

    const res = await fetch("/api/essays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), writingType: selectedType }),
    });

    const { id } = await res.json();
    handleClose(false);
    router.push(`/essays/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "type"
              ? "What kind of writing?"
              : "What do you want to write about?"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" ? (
          <div className="grid gap-3">
            {WRITING_TYPES.map((type) => {
              const progress = skillProgress.find(
                (p) => p.writing_type === type.id
              );
              const level = progress?.current_level ?? 1;
              const levelDef = getLevel(level);

              return (
                <Card
                  key={type.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setSelectedType(type.id);
                    setStep("topic");
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <span className="text-3xl">{type.icon}</span>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Level {level}: {levelDef.name}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              placeholder="e.g. Why Robots Are Really Cool"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="text-base"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("type")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="flex-1"
              >
                {creating ? "Creating..." : "Start Writing!"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
