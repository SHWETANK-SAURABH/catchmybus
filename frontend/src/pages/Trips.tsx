import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, post } from "../lib/api";
import type { Page, Trip } from "../lib/types";
import { useBusMeta, useRouteDetails, useStops } from "../lib/queries";
import { fmtDateTime } from "../lib/format";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Trip history with a date-range filter (FR22). */
export default function Trips() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 7 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["trips", from, to, page],
    queryFn: () => api<Page<Trip>>(`/trips?date_from=${from}&date_to=${to}&page=${page}&size=15`),
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
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Trip history</h1>
      <form className="card flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Date range">
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" type="date" className="input" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" type="date" className="input" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <p className="text-sm text-slate-500">{q.data?.total ?? 0} trips</p>
      </form>

      <section className="card overflow-x-auto">
        {q.data?.items.length === 0 && <p className="text-sm text-slate-500">No trips in this period. Start one from a bus page.</p>}
        {!!q.data?.items.length && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th scope="col" className="py-1">Date</th><th scope="col">Route</th><th scope="col">Bus</th>
                <th scope="col">From</th><th scope="col">To</th><th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="whitespace-nowrap py-1 pr-2">{fmtDateTime(t.trip_date)}</td>
                  <td className="pr-2">{routes.find((r) => r.id === t.route_id)?.name ?? "—"}</td>
                  <td className="pr-2">{t.bus_id ? <Link className="underline" to={`/bus/${t.bus_id}`}>{buses.find((b) => b.id === t.bus_id)?.bus_number}</Link> : "—"}</td>
                  <td className="pr-2">{stop(t.board_stop_id)}</td>
                  <td className="pr-2">{stop(t.alight_stop_id)}</td>
                  <td>
                    {t.status === "ONGOING"
                      ? <button className="btn-ghost py-1" onClick={() => complete.mutate(t.id)}>Complete</button>
                      : <span className="text-green-700 dark:text-green-300">Completed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-2 flex items-center justify-end gap-2 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page} / {pages}</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}
