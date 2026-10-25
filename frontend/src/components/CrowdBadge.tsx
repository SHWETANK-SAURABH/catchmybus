import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { crowdStyle } from "../lib/colors";
import type { Crowd, CrowdLevel } from "../lib/types";

/** Green / amber / red badge; always shows the word too, not just the colour. */
export default function CrowdBadge({ level, title }: { level: CrowdLevel | null | undefined; title?: string }) {
  if (!level) return null;
  const s = crowdStyle[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg}`} title={title}>
      <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} aria-hidden />
      Crowd: {s.label}
    </span>
  );
}

/** Crowd level of every live bus, keyed by bus id (respects the demo-time header). */
export function useCrowdAll() {
  return useQuery({
    queryKey: ["crowd-all"],
    queryFn: () => api<Crowd[]>("/ai/crowd/all"),
    refetchInterval: 15000,
    select: (list) => Object.fromEntries(list.map((c) => [c.bus_id, c])) as Record<number, Crowd>,
  });
}
