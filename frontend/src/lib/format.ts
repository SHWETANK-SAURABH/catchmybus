/** The API returns naive UTC timestamps; mark them as UTC before formatting. */
export function parseUtc(ts: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(ts) ? ts : ts + "Z");
}

export const fmtTime = (ts: string) => parseUtc(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (ts: string) =>
  parseUtc(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** "Due" under 1 minute, otherwise whole minutes. */
export function fmtEta(minutes: number): string {
  if (minutes < 1) return "Due";
  return `${Math.round(minutes)} min`;
}

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
