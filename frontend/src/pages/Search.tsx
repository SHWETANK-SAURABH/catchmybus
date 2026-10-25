import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Bus, Footprints, Route as RouteIcon, Sparkles, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import type { BestRoute, RouteDetail, RouteOption } from "../lib/types";
import { routeColor } from "../lib/colors";
import { fmtDistance, fmtEta } from "../lib/format";
import CrowdBadge from "../components/CrowdBadge";
import { EmptyState, Page, PageHeader } from "../components/ui";

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
    <Page>
      <PageHeader icon={RouteIcon}
        title={<span className="flex flex-wrap items-center gap-2">{source} <ArrowRight className="h-5 w-5 text-slate-400" aria-label="to" /> {destination}</span>}
        subtitle="Direct buses ranked by time, walking, crowding and delay risk." />

      <section className="card mb-4" aria-labelledby="best-h">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden />
          <h2 id="best-h" className="card-title">Best options</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Lower score is better: time × {best.data?.weights.eta}, walking metres × {best.data?.weights.walk},
          crowd penalty × {best.data?.weights.crowd}, predicted delay × {best.data?.weights.delay_risk}.
        </p>
        {best.isLoading && <p role="status" className="muted">Ranking routes…</p>}
        {best.isError && <p role="alert" className="text-sm text-red-600">{(best.error as Error).message}</p>}
        {best.data?.options.length === 0 && (
          <EmptyState icon={Bus} title="No direct bus">No single bus connects these two places.</EmptyState>
        )}
        <ol className="space-y-3">
          {best.data?.options.map((o, i) => (
            <li key={`${o.route_id}-${o.board_stop.id}`}
              className={`rounded-2xl border p-4 ${i === 0 ? "border-brand-300 bg-brand-50/60 ring-1 ring-brand-200 dark:border-brand-700 dark:bg-brand-900/20 dark:ring-brand-800" : "border-slate-200/80 dark:border-slate-800"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {i + 1}
                </span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: routeColor(o.route_id) }} aria-hidden />
                <Link to={`/routes/${o.route_id}`} className="font-semibold hover:underline">{o.route_name}</Link>
                {i === 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Recommended</span>}
                <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">score <strong className="text-slate-900 dark:text-white">{o.score.toFixed(1)}</strong></span>
              </div>

              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Board at <strong>{o.board_stop.name}</strong>, get off at <strong>{o.alight_stop.name}</strong>.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {o.bus_id ? (
                  <Link to={`/bus/${o.bus_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-brand-700 ring-1 ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:text-brand-300 dark:ring-slate-700">
                    <Bus className="h-3.5 w-3.5" aria-hidden /> {o.bus_number} · {fmtEta(o.eta_minutes ?? 0)}
                  </Link>
                ) : <span className="muted">No live bus right now</span>}
                {o.walk_m > 30 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Footprints className="h-3.5 w-3.5" aria-hidden /> walk {fmtDistance(o.walk_m)}
                  </span>
                )}
                <CrowdBadge level={o.crowd_level} />
                {o.predicted_delay_min >= 1 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> ~{Math.round(o.predicted_delay_min)} min delay
                  </span>
                )}
              </div>

              {/* Stacked bar: how much each term contributes to the score */}
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img"
                aria-label={TERMS.map((t) => `${t.label} ${o.breakdown[t.key]}`).join(", ")}>
                {TERMS.map((t) => (
                  <div key={t.key} style={{ width: `${(o.breakdown[t.key] / maxScore) * 100}%`, background: t.color }} />
                ))}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                {TERMS.map((t) => (
                  <div key={t.key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: t.color }} aria-hidden />
                    <dt className="text-slate-500 dark:text-slate-400">{t.label}</dt>
                    <dd className="ml-auto font-medium tabular-nums">{o.breakdown[t.key].toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="routes-h">
        <h2 id="routes-h" className="card-title mb-3">All routes serving both stops</h2>
        {routes.data?.length === 0 && <p className="muted">No direct route found.</p>}
        <ul className="space-y-2">
          {routes.data?.map((r) => (
            <li key={r.id}>
              <Link to={`/routes/${r.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200/80 p-3 transition hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: routeColor(r.id) }} aria-hidden />
                <span className="flex-1 text-sm font-medium">{r.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{r.stops.length} stops</span>
                <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
