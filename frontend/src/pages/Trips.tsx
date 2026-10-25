import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Ticket } from "lucide-react";
import { api, post } from "../lib/api";
import type { Page as PageOf, Trip } from "../lib/types";
import { useBusMeta, useRouteDetails, useStops } from "../lib/queries";
import { fmtDateTime } from "../lib/format";
import { routeColor } from "../lib/colors";
import { EmptyState, Page, PageHeader, Pagination } from "../components/ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Trip history with a date-range filter (FR22). */
export default function Trips() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 7 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["trips", from, to, page],
    queryFn: () => api<PageOf<Trip>>(`/trips?date_from=${from}&date_to=${to}&page=${page}&size=15`),
  });
  const complete = useMutation({
    mutationFn: (id: number) => post(`/trips/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
  const routes = useRouteDetails().data ?? [];
  const stops = useStops().data ?? [];
  const buses = useBusMeta().data ?? [];
  const stop = (id: number | null) => stops.find((s) => s.id === id)?.name ?? "—";
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / 15)) : 1;

  return (
    <Page>
      <PageHeader icon={Ticket} title="Trip history" subtitle={`${q.data?.total ?? 0} trips in the selected period`} />

      <form className="card mb-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} aria-label="Date range">
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" type="date" className="input" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" type="date" className="input" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </form>

      <section className="card">
        {q.data?.items.length === 0 ? (
          <EmptyState icon={Ticket} title="No trips in this period">Start a trip from a bus page and it will show up here.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data?.items.map((t) => {
              const route = routes.find((r) => r.id === t.route_id);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: route ? routeColor(route.id) : "#94a3b8" }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {stop(t.board_stop_id)} <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-label="to" /> {stop(t.alight_stop_id)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fmtDateTime(t.trip_date)} · {route?.name ?? "—"}
                      {t.bus_id && <> · <Link className="hover:underline" to={`/bus/${t.bus_id}`}>{buses.find((b) => b.id === t.bus_id)?.bus_number}</Link></>}
                    </p>
                  </div>
                  {t.status === "ONGOING" ? (
                    <button className="btn-ghost py-1.5" onClick={() => complete.mutate(t.id)}>Mark complete</button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Completed
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 && <Pagination page={page} pages={pages} onPage={setPage} />}
      </section>
    </Page>
  );
}
