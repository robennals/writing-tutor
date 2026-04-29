const ESSAY_PATH_RE = /\/essays\/(\d+)/;

export function extractEssayId(arg: string): number {
  const trimmed = arg.trim();
  if (!trimmed) {
    throw new Error("Expected an essay id, URL, or /essays/<id> path");
  }
  const match = trimmed.match(ESSAY_PATH_RE);
  if (match) return Number(match[1]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  throw new Error(
    `Could not extract essay id from "${arg}" — pass a bare integer, /essays/<id>, or a full URL`
  );
}

export function resolveBaseUrl(prod: boolean): string {
  return prod
    ? "https://writingtutor.robennals.org"
    : "http://localhost:3000";
}
