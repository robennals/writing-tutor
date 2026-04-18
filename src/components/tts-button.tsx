"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "playing";

const STREAM_IDLE_TIMEOUT_MS = 15_000;

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
  const onEndedRef = useRef<(() => void) | null>(null);
  const onErrorRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      if (onEndedRef.current) audio.removeEventListener("ended", onEndedRef.current);
      if (onErrorRef.current) audio.removeEventListener("error", onErrorRef.current);
      onEndedRef.current = null;
      onErrorRef.current = null;
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
    if (!text.trim()) return;

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    const audio = new Audio(objectUrl);
    const abort = new AbortController();

    const isCurrent = () => abortRef.current === abort;
    const finish = () => {
      if (isCurrent()) cleanup();
    };

    const onEnded = () => finish();
    const onError = () => {
      console.error("TTS audio error", audio.error);
      finish();
    };

    audioRef.current = audio;
    objectUrlRef.current = objectUrl;
    abortRef.current = abort;
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    setStatus("loading");

    mediaSource.addEventListener("sourceopen", async () => {
      if (!isCurrent()) return;

      let sourceBuffer: SourceBuffer;
      try {
        sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      } catch (err) {
        console.error("MediaSource addSourceBuffer failed", err);
        finish();
        return;
      }

      const appendChunk = (chunk: Uint8Array) =>
        new Promise<void>((resolve, reject) => {
          if (abort.signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          const detach = () => {
            sourceBuffer.removeEventListener("updateend", onUpdateEnd);
            sourceBuffer.removeEventListener("error", onBufErr);
            abort.signal.removeEventListener("abort", onAbort);
          };
          const onUpdateEnd = () => {
            detach();
            resolve();
          };
          const onBufErr = (e: Event) => {
            detach();
            reject(e);
          };
          const onAbort = () => {
            detach();
            reject(new DOMException("Aborted", "AbortError"));
          };
          sourceBuffer.addEventListener("updateend", onUpdateEnd);
          sourceBuffer.addEventListener("error", onBufErr);
          abort.signal.addEventListener("abort", onAbort);
          try {
            sourceBuffer.appendBuffer(chunk as BufferSource);
          } catch (err) {
            detach();
            reject(err);
          }
        });

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abort.signal,
        });

        if (!isCurrent()) return;

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({}));
          console.error("TTS request failed", response.status, detail);
          finish();
          return;
        }

        const reader = response.body.getReader();
        let firstChunk = true;
        while (true) {
          const timeoutId = window.setTimeout(() => {
            console.error("TTS stream idle timeout");
            abort.abort();
          }, STREAM_IDLE_TIMEOUT_MS);

          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await reader.read();
          } finally {
            window.clearTimeout(timeoutId);
          }
          if (!isCurrent()) return;
          if (readResult.done) break;
          const value = readResult.value;
          if (!value) continue;

          await appendChunk(value);
          if (!isCurrent()) return;

          if (firstChunk) {
            firstChunk = false;
            setStatus("playing");
            void audio.play().catch((err) => {
              console.error("audio.play() rejected", err);
              finish();
            });
          }
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("TTS streaming error", err);
        finish();
      }
    });
  }, [text, status, cleanup]);

  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : status === "playing" ? (
      <VolumeX className="h-4 w-4" aria-hidden="true" />
    ) : (
      <Volume2 className="h-4 w-4" aria-hidden="true" />
    );

  const buttonLabel =
    status === "loading" ? "Loading" : status === "playing" ? "Stop" : label;

  return (
    <Button
      variant="outline"
      size={size}
      onClick={play}
      disabled={status === "idle" && !text.trim()}
      className="gap-1.5"
      aria-busy={status === "loading"}
    >
      {icon}
      {buttonLabel}
    </Button>
  );
}
