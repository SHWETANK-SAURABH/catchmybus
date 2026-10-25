import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { BestRoute, RouteDetail, RouteOption } from "../lib/types";
import { routeColor } from "../lib/colors";
import { fmtDistance, fmtEta } from "../lib/format";
import CrowdBadge from "../components/CrowdBadge";

const TERMS: { key: keyof RouteOption["breakdown"]; label: string; color: string }[] = [
  { key: "eta", label: "Time (wait + ride)", color: "#2563eb" },
  { key: "walk", label: "Walking", color: "#16a34a" },
  { key: "crowd", label: "Crowding", color: "#d97706" },
  { key: "delay_risk", label: "Delay risk", color: "#dc2626" },
];

/** Search results: AI-ranked best options with an explained score, then all matching routes. */
export default function Search() {
  const [params] = useSearchParams();
  const source = params.get("source") ?? "";
  const destination = params.get("destination") ?? "";
  const q = new URLSearchParams({ source, destination }).toString();
  const best = useQuery({ queryKey: ["best-route", q], queryFn: () => api<BestRoute>(`/ai/best-route?${q}`), refetchInterval: 15000 });
  const routes = useQuery({ queryKey: ["search", q], queryFn: () => api<RouteDetail[]>(`/routes/search?${q}`) });
  const maxScore = Math.max(1, ...(best.data?.options ?? []).map((o) => o.score));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{source} → {destination}</h1>

      <section className="card" aria-labelledby="best-h">
        <h2 id="best-h" className="font-semibold">Best options</h2>
        <p className="mb-3 text-xs text-slate-500">
          Ranked by a weighted score (lower is better): time × {best.data?.weights.eta}, walking metres × {best.data?.weights.walk},
          crowd penalty × {best.data?.weights.crowd}, predicted delay × {best.data?.weights.delay_risk}.
        </p>
        {best.isLoading && <p role="status">Ranking routes…</p>}
        {best.isError && <p role="alert" className="text-sm text-red-600">{(best.error as Error).message}</p>}
        {best.data?.options.length === 0 && <p className="text-sm text-slate-500">No direct bus between these places.</p>}
        <ol className="space-y-3">
          {best.data?.options.map((o, i) => (
            <li key={`${o.route_id}-${o.board_stop.id}`} className={`rounded-lg border p-3 ${i === 0 ? "border-brand-500 bg-brand-50 dark:bg-brand-700/20" : "border-slate-200 dark:border-slate-700"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">#{i + 1}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: routeColor(o.route_id) }} aria-hidden />
                <Link to={`/routes/${o.route_id}`} className="font-medium underline">{o.route_name}</Link>
                {i === 0 && <span className="rounded bg-brand-600 px-1.5 text-xs text-white">Recommended</span>}
                <span className="ml-auto text-sm">score <strong>{o.score.toFixed(1)}</strong></span>
              </div>
              <p className="mt-1 text-sm">
                Board at <strong>{o.board_stop.name}</strong>{o.walk_m > 30 && ` (walk ${fmtDistance(o.walk_m)})`}, get off at <strong>{o.alight_stop.name}</strong>.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {o.bus_id ? (
                  <Link to={`/bus/${o.bus_id}`} className="text-brand-600 underline dark:text-brand-100">
                    {o.bus_number} in {fmtEta(o.eta_minutes ?? 0)}
                  </Link>
                ) : <span className="text-slate-500">No live bus right now</span>}
                <CrowdBadge level={o.crowd_level} />
                {o.predicted_delay_min >= 1 && <span className="text-amber-700 dark:text-amber-300">~{Math.round(o.predicted_delay_min)} min delay</span>}
              </div>
              {/* Stacked bar: how much each term contributes to the score */}
              <div className="mt-2 flex h-3 overflow-hidden rounded bg-slate-200 dark:bg-slate-700" role="img"
                aria-label={TERMS.map((t) => `${t.label} ${o.breakdown[t.key]}`).join(", ")}>
                {TERMS.map((t) => (
                  <div key={t.key} style={{ width: `${(o.breakdown[t.key] / maxScore) * 100}%`, background: t.color }} />
                ))}
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 text-xs sm:grid-cols-4">
                {TERMS.map((t) => (
                  <div key={t.key} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: t.color }} aria-hidden />
                    <dt>{t.label}</dt><dd className="ml-auto font-medium">{o.breakdown[t.key].toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="routes-h">
        <h2 id="routes-h" className="mb-2 font-semibold">All routes serving both stops</h2>
        {routes.data?.length === 0 && <p className="text-sm text-slate-500">No direct route found.</p>}
        <ul className="space-y-1">
          {routes.data?.map((r) => (
            <li key={r.id}>
              <Link to={`/routes/${r.id}`} className="flex items-center gap-2 rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                <span className="h-3 w-3 rounded-full" style={{ background: routeColor(r.id) }} aria-hidden />
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-sm text-slate-500">{r.stops.length} stops</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
