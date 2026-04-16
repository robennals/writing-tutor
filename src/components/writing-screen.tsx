"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EssayEditor } from "./editor";
import { TtsButton } from "./tts-button";
import { WRITING_TYPES, getLevel, type Tab } from "@/lib/levels";
import type { Essay, Message } from "@/lib/queries";
import { Check, ArrowLeft, Send, Lightbulb, ListOrdered, PenLine } from "lucide-react";
import { LevelInfoDialog } from "./level-info-dialog";

/**
 * Returns true if the given assistant message contains a `markEssayReady`
 * tool call — i.e. the AI has explicitly signaled the essay meets criteria.
 * In AI SDK v6, tool call parts have type `tool-<toolName>`.
 */
function hasMarkEssayReady(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return message.parts.some(
    (p) => "type" in p && p.type === "tool-markEssayReady"
  );
}

const TAB_CONFIG: Record<
  Tab,
  { label: string; icon: typeof Lightbulb; hint: string; placeholder: string }
> = {
  brainstorm: {
    label: "Brainstorm",
    icon: Lightbulb,
    hint: "Jot down any ideas about your topic. Doesn't have to be neat!",
    placeholder: "Write any ideas here — bullet points, random thoughts, anything...",
  },
  outline: {
    label: "Outline",
    icon: ListOrdered,
    hint: "Plan the order of your essay. What comes first, middle, last?",
    placeholder: "1. First I'll write about...\n2. Then...\n3. Finally...",
  },
  draft: {
    label: "Draft",
    icon: PenLine,
    hint: "Write your real essay here! This is what I'll check.",
    placeholder: "",
  },
};

export function WritingScreen({
  essay: initialEssay,
  initialMessages,
  currentLevel,
  essaysAtLevel,
  settings,
  isParentView,
}: {
  essay: Essay;
  initialMessages: Message[];
  currentLevel: number;
  essaysAtLevel: number;
  settings: Record<string, string>;
  isParentView: boolean;
}) {
  const router = useRouter();
  const [essay, setEssay] = useState(initialEssay);
  const [draftContent, setDraftContent] = useState(initialEssay.content);
  const [draftText, setDraftText] = useState("");
  const [brainstormNotes, setBrainstormNotes] = useState(
    initialEssay.brainstorm_notes ?? ""
  );
  const [outline, setOutline] = useState(initialEssay.outline ?? "");
  const [activeTab, setActiveTab] = useState<Tab>(
    (initialEssay.active_tab as Tab) ?? "draft"
  );
  const [currentStep, setCurrentStep] = useState(initialEssay.current_step);
  const [chatInput, setChatInput] = useState("");
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const writingType = WRITING_TYPES.find((t) => t.id === essay.writing_type);
  const levelDef = getLevel(currentLevel);
  const availableTabs = levelDef.availableTabs;

  // If current active_tab isn't available at this level, fall back to draft.
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab("draft");
    }
  }, [availableTabs, activeTab]);

  // Convert DB messages to UIMessage format ONCE for the initial seed.
  // Do NOT recompute on every render — useChat would reset its state.
  const initialSeedMessages = useMemo<UIMessage[]>(
    () =>
      initialMessages.map((m) => ({
        id: `db-${m.id}`,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep a ref to the latest tab/step/content so the transport body function
  // always sends the current state without needing to recreate the transport.
  const bodyStateRef = useRef({
    essayId: essay.id,
    essayContent: draftContent,
    essayTitle: essay.title,
    brainstormNotes,
    outline,
    activeTab,
    currentStep,
    writingType: essay.writing_type,
    currentLevel,
  });
  useEffect(() => {
    bodyStateRef.current = {
      essayId: essay.id,
      essayContent: draftContent,
      essayTitle: essay.title,
      brainstormNotes,
      outline,
      activeTab,
      currentStep,
      writingType: essay.writing_type,
      currentLevel,
    };
  });

  // Memoize transport so useChat doesn't see a new instance on every render.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => bodyStateRef.current,
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    id: `essay-${essay.id}`,
    transport,
    messages: initialSeedMessages,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial greeting only once. Guard against React Strict Mode
  // double-mounting in development, which would otherwise send twice.
  const greetingSentRef = useRef(false);
  useEffect(() => {
    if (greetingSentRef.current) return;
    if (initialMessages.length === 0 && messages.length === 0 && !isParentView) {
      greetingSentRef.current = true;
      sendMessage({
        text: `I want to write about: ${essay.title}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save
  const scheduleSave = useCallback(
    (updates: Record<string, string | number>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        await fetch(`/api/essays/${essay.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }, 800);
    },
    [essay.id]
  );

  const handleDraftUpdate = useCallback(
    (html: string, text: string) => {
      setDraftContent(html);
      setDraftText(text);
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      scheduleSave({ content: html, word_count: wordCount });
    },
    [scheduleSave]
  );

  const handleBrainstormUpdate = useCallback(
    (val: string) => {
      setBrainstormNotes(val);
      scheduleSave({ brainstorm_notes: val });
    },
    [scheduleSave]
  );

  const handleOutlineUpdate = useCallback(
    (val: string) => {
      setOutline(val);
      scheduleSave({ outline: val });
    },
    [scheduleSave]
  );

  const handleTabChange = useCallback(
    async (newTab: string) => {
      const tab = newTab as Tab;
      setActiveTab(tab);
      // Map tab to step
      const newStep =
        tab === "brainstorm"
          ? "brainstorm"
          : tab === "outline"
            ? "organize"
            : currentStep === "brainstorm" || currentStep === "organize"
              ? "draft"
              : currentStep;
      setCurrentStep(newStep);
      await fetch(`/api/essays/${essay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_tab: tab, current_step: newStep }),
      });
    },
    [essay.id, currentStep]
  );

  const handleStepChange = useCallback(
    async (newStep: string) => {
      setCurrentStep(newStep);
      await fetch(`/api/essays/${essay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_step: newStep }),
      });
    },
    [essay.id]
  );

  const handleCheckWriting = useCallback(async () => {
    await handleStepChange("review");
    sendMessage({ text: "Please check my writing!" });
  }, [handleStepChange, sendMessage]);

  const handleChangesSubmit = useCallback(async () => {
    await handleStepChange("review");
    sendMessage({ text: "I've made changes! Can you check again?" });
  }, [handleStepChange, sendMessage]);

  const handleBrainstormHelp = useCallback(() => {
    sendMessage({ text: "Can you help me brainstorm some ideas?" });
  }, [sendMessage]);

  const handleOutlineHelp = useCallback(() => {
    sendMessage({ text: "Can you help me plan my outline?" });
  }, [sendMessage]);

  const handleComplete = useCallback(async () => {
    const res = await fetch(`/api/essays/${essay.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", current_step: "complete" }),
    });
    const data = await res.json();
    if (data.leveledUp) {
      router.push(
        `/essays/${essay.id}/level-up?newLevel=${data.newLevel}&type=${essay.writing_type}`
      );
    } else {
      setCurrentStep("complete");
      setEssay({ ...essay, status: "completed" });
    }
  }, [essay, router]);

  const handleSendChat = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      sendMessage({ text: text.trim() });
      setChatInput("");
    },
    [isStreaming, sendMessage]
  );

  const wordCount = draftText.trim().split(/\s+/).filter(Boolean).length;
  const isComplete = essay.status === "completed";
  const canEdit = !isParentView && !isComplete;
  const isReviewing = currentStep === "review" || currentStep === "revise";

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card px-4 py-2.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(isParentView ? "/parent" : "/")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
          <span className="text-muted-foreground">|</span>
          <span className="text-sm font-medium">✏️ Writing Tutor</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="gap-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setShowLevelInfo(true)}
          >
            <span className="text-amber-400">★</span>
            {writingType?.name}: Level {currentLevel}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {essaysAtLevel}/{levelDef.essaysToPass} essays
            </span>
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor with Tabs */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          {/* Essay Header */}
          <div className="px-5 py-3 border-b border-border/50 shrink-0">
            <h1 className="text-lg font-medium">{essay.title}</h1>
            <div className="flex gap-2 mt-1.5">
              <Badge variant="secondary" className="text-[11px]">
                {writingType?.icon} {writingType?.name}
              </Badge>
              {isComplete && (
                <Badge variant="secondary" className="text-[11px] text-green-400">
                  ✓ Completed
                </Badge>
              )}
              {isReviewing && !isComplete && (
                <Badge variant="secondary" className="text-[11px] text-amber-400">
                  🔍 Reviewing
                </Badge>
              )}
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-5 mt-3 shrink-0 w-fit">
              {availableTabs.map((tab) => {
                const config = TAB_CONFIG[tab];
                const Icon = config.icon;
                return (
                  <TabsTrigger key={tab} value={tab} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab hint */}
            <div className="px-5 pt-2 pb-1 shrink-0">
              <p className="text-xs text-muted-foreground">
                💡 {TAB_CONFIG[activeTab].hint}
              </p>
            </div>

            {/* Brainstorm tab */}
            {availableTabs.includes("brainstorm") && (
              <TabsContent
                value="brainstorm"
                className="flex-1 flex flex-col min-h-0 mt-0"
              >
                <Textarea
                  value={brainstormNotes}
                  onChange={(e) => handleBrainstormUpdate(e.target.value)}
                  placeholder={TAB_CONFIG.brainstorm.placeholder}
                  disabled={!canEdit}
                  className="flex-1 mx-5 my-3 text-base leading-[1.8] font-[inherit] resize-none"
                />
                {canEdit && (
                  <div className="px-5 py-3 border-t border-border flex justify-end shrink-0">
                    <Button
                      size="lg"
                      variant="default"
                      className="gap-2 shadow-lg shadow-primary/30"
                      onClick={handleBrainstormHelp}
                      disabled={isStreaming}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Help me brainstorm!
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Outline tab */}
            {availableTabs.includes("outline") && (
              <TabsContent
                value="outline"
                className="flex-1 flex flex-col min-h-0 mt-0"
              >
                <Textarea
                  value={outline}
                  onChange={(e) => handleOutlineUpdate(e.target.value)}
                  placeholder={TAB_CONFIG.outline.placeholder}
                  disabled={!canEdit}
                  className="flex-1 mx-5 my-3 text-base leading-[1.8] font-[inherit] resize-none"
                />
                {canEdit && (
                  <div className="px-5 py-3 border-t border-border flex justify-end shrink-0">
                    <Button
                      size="lg"
                      variant="default"
                      className="gap-2 shadow-lg shadow-primary/30"
                      onClick={handleOutlineHelp}
                      disabled={isStreaming}
                    >
                      <ListOrdered className="h-4 w-4" />
                      Help me plan!
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Draft tab */}
            <TabsContent
              value="draft"
              className="flex-1 flex flex-col min-h-0 mt-0"
            >
              <EssayEditor
                content={draftContent}
                onUpdate={handleDraftUpdate}
                editable={canEdit}
              />
              {canEdit && (
                <div className="px-5 py-3 border-t border-border flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    {settings.tts_essay === "true" && (
                      <TtsButton text={draftText} label="Hear My Essay" />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {wordCount} words
                    </span>
                  </div>
                  {isReviewing ? (
                    <Button
                      size="lg"
                      className="gap-2 shadow-lg shadow-primary/30 font-semibold"
                      onClick={handleChangesSubmit}
                      disabled={wordCount < 3 || isStreaming}
                    >
                      <Check className="h-4 w-4" />
                      I&apos;ve Made Changes!
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="gap-2 shadow-lg shadow-primary/30 font-semibold"
                      onClick={handleCheckWriting}
                      disabled={wordCount < 3 || isStreaming}
                    >
                      <Check className="h-4 w-4" />
                      Check My Writing!
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Tutor Panel */}
        <div className="w-[360px] flex flex-col bg-card/50 shrink-0">
          {/* Tutor Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-base">
              🤖
            </div>
            <div>
              <p className="text-sm font-medium">Writing Buddy</p>
              <p className="text-[11px] text-muted-foreground">
                Helping with: {levelDef.name}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => {
              const text = msg.parts
                .filter(
                  (p): p is { type: "text"; text: string } => p.type === "text"
                )
                .map((p) => p.text)
                .join("");
              return (
                <div key={msg.id}>
                  {msg.role === "assistant" ? (
                    <div className="bg-indigo-950/30 rounded-xl p-3.5 space-y-2">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {text}
                      </p>
                      {settings.tts_tutor === "true" && text && (
                        <TtsButton text={text} label="Hear this" size="sm" />
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="bg-indigo-600/20 rounded-xl px-3.5 py-2 max-w-[85%]">
                        <p className="text-sm">{text}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <div className="bg-indigo-950/30 rounded-xl p-3.5">
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Thinking...
                  </p>
                </div>
              )}

            {/* Complete button only appears when the AI has called the
                markEssayReady tool in the most recent assistant message. */}
            {canEdit &&
              activeTab === "draft" &&
              hasMarkEssayReady(messages[messages.length - 1]) && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-green-600/30 text-green-400 hover:bg-green-600/10"
                  onClick={handleComplete}
                >
                  ✨ Mark as Complete
                </Button>
              )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          {canEdit && (
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSendChat(chatInput)
                  }
                  placeholder="Ask me anything..."
                  className="text-sm"
                  disabled={isStreaming}
                />
                <Button
                  size="sm"
                  onClick={() => handleSendChat(chatInput)}
                  disabled={isStreaming || !chatInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LevelInfoDialog
        open={showLevelInfo}
        onOpenChange={setShowLevelInfo}
        writingType={essay.writing_type}
        currentLevel={currentLevel}
        essaysAtLevel={essaysAtLevel}
      />
    </div>
  );
}
