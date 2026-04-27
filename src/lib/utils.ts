import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert Tiptap-style HTML into the plain text we send to the model.
 * The AI doesn't need <p> tags to grade an essay; HTML noise distracts the
 * model from character-level checks like capitalization. Paragraph breaks
 * become blank lines, <br> becomes a newline, and remaining tags are dropped.
 * Decodes the few entities Tiptap actually emits (&amp;, &lt;, &gt;, &nbsp;,
 * &#39;, &quot;) — anything else is left as-is rather than swallowed.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}
