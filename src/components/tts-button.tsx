"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "playing";

export function TtsButton({
  text,
  label = "Listen",
  size = "sm",
}: {
  text: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const play = useCallback(async () => {
    if (status !== "idle") {
      cleanup();
      return;
    }

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    const audio = new Audio(objectUrl);
    const abort = new AbortController();

    audioRef.current = audio;
    objectUrlRef.current = objectUrl;
    abortRef.current = abort;

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", () => {
      console.error("TTS audio error", audio.error);
      cleanup();
    });

    setStatus("loading");

    mediaSource.addEventListener("sourceopen", async () => {
      let sourceBuffer: SourceBuffer;
      try {
        sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      } catch (err) {
        console.error("MediaSource addSourceBuffer failed", err);
        cleanup();
        return;
      }

      const appendChunk = (chunk: Uint8Array) =>
        new Promise<void>((resolve, reject) => {
          const onUpdateEnd = () => {
            sourceBuffer.removeEventListener("updateend", onUpdateEnd);
            sourceBuffer.removeEventListener("error", onError);
            resolve();
          };
          const onError = (e: Event) => {
            sourceBuffer.removeEventListener("updateend", onUpdateEnd);
            sourceBuffer.removeEventListener("error", onError);
            reject(e);
          };
          sourceBuffer.addEventListener("updateend", onUpdateEnd);
          sourceBuffer.addEventListener("error", onError);
          sourceBuffer.appendBuffer(chunk as BufferSource);
        });

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abort.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({}));
          console.error("TTS request failed", response.status, detail);
          cleanup();
          return;
        }

        const reader = response.body.getReader();
        let firstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          await appendChunk(new Uint8Array(value));
          if (firstChunk) {
            firstChunk = false;
            setStatus("playing");
            void audio.play().catch((err) => {
              console.error("audio.play() rejected", err);
              cleanup();
            });
          }
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("TTS streaming error", err);
        cleanup();
      }
    });
  }, [text, status, cleanup]);

  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : status === "playing" ? (
      <VolumeX className="h-4 w-4" />
    ) : (
      <Volume2 className="h-4 w-4" />
    );

  const buttonLabel =
    status === "loading" ? "Loading" : status === "playing" ? "Stop" : label;

  return (
    <Button
      variant="outline"
      size={size}
      onClick={play}
      className="gap-1.5"
      aria-busy={status === "loading"}
    >
      {icon}
      {buttonLabel}
    </Button>
  );
}
