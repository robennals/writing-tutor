"use client";

import { diffWordsWithSpace } from "diff";

function normalizeWithParagraphs(html: string): string {
  // Convert HTML into plain text, preserving paragraph breaks as \n\n so the
  // diff and the rendered output keep their structure.
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

interface Segment {
  text: string;
  kind: "same" | "added" | "removed";
}

function paragraphs(segments: Segment[]): Segment[][] {
  // Walk the segment stream. Whenever a segment's text contains \n\n, split it
  // and start a new paragraph at each break.
  const out: Segment[][] = [[]];
  for (const seg of segments) {
    const parts = seg.text.split(/\n\n+/);
    parts.forEach((part, i) => {
      if (i > 0) out.push([]);
      if (part.length > 0) out[out.length - 1].push({ ...seg, text: part });
    });
  }
  return out.filter((p) => p.length > 0);
}

export function DiffView({
  prev,
  current,
}: {
  prev: string | null;
  current: string;
}) {
  const currentText = normalizeWithParagraphs(current);

  if (prev === null) {
    return (
      <div className="px-5 py-4 text-base leading-[1.8] space-y-3">
        <p className="text-xs text-muted-foreground italic">(first version)</p>
        {currentText.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    );
  }

  const prevText = normalizeWithParagraphs(prev);
  if (prevText === currentText) {
    return (
      <div className="px-5 py-4 text-base leading-[1.8] space-y-3">
        <p className="text-xs text-muted-foreground italic">
          (no edits between this version and the previous one)
        </p>
        {currentText.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    );
  }

  const raw = diffWordsWithSpace(prevText, currentText);
  const segments: Segment[] = raw.map((c) => ({
    text: c.value,
    kind: c.added ? "added" : c.removed ? "removed" : "same",
  }));

  return (
    <div className="px-5 py-4 text-base leading-[1.8] space-y-3">
      {paragraphs(segments).map((para, pi) => (
        <p key={pi}>
          {para.map((seg, si) => {
            if (seg.kind === "added") {
              return (
                <span
                  key={si}
                  data-diff="added"
                  className="font-bold underline decoration-2 decoration-emerald-400 text-emerald-300"
                >
                  {seg.text}
                </span>
              );
            }
            if (seg.kind === "removed") {
              return (
                <span
                  key={si}
                  data-diff="removed"
                  className="line-through decoration-2 decoration-rose-400 text-rose-400/50"
                >
                  {seg.text}
                </span>
              );
            }
            return <span key={si}>{seg.text}</span>;
          })}
        </p>
      ))}
    </div>
  );
}
