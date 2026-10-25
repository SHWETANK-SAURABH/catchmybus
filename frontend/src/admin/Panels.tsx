import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, del, post } from "../lib/api";
import type { Page, Sos } from "../lib/types";
import { fmtDateTime } from "../lib/format";
import { useBusMeta } from "../lib/queries";

interface Opt { value: number; label: string }

interface Audit {
  id: number; admin_id: number | null; action: string; entity: string; entity_id: string | null;
  performed_at: string; details_json: Record<string, unknown> | null;
}

export function AuditLogPanel() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const q = useQuery({
    queryKey: ["admin", "audit-log", page, entity],
    queryFn: () => api<Page<Audit>>(`/admin/audit-log?page=${page}&size=15${entity ? `&entity=${entity}` : ""}`),
    refetchInterval: 10000,
  });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / 15)) : 1;
  return (
    <section className="card" aria-labelledby="audit-h">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="audit-h" className="font-semibold">Audit log</h2>
        <label className="text-sm">
          <span className="sr-only">Filter by entity</span>
          <select className="input" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            <option value="">All entities</option>
            {["bus", "driver", "route", "stop", "route_stop", "schedule", "announcement", "sos_alert"].map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th scope="col" className="py-1">When</th><th scope="col">Admin</th><th scope="col">Action</th>
              <th scope="col">Entity</th><th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top dark:border-slate-700">
                <td className="whitespace-nowrap py-1 pr-2">{fmtDateTime(a.performed_at)}</td>
                <td className="pr-2">#{a.admin_id}</td>
                <td className="pr-2 font-medium">{a.action}</td>
                <td className="pr-2">{a.entity} {a.entity_id}</td>
                <td><code className="break-all text-xs">{JSON.stringify(a.details_json)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-sm">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span>Page {page} / {pages}</span>
        <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  );
}

/** Live SOS feed: refreshed instantly when an SOS notification arrives, and every 10 s. */
export function SosFeedPanel() {
  const qc = useQueryClient();
  const buses = useBusMeta().data ?? [];
  const q = useQuery({ queryKey: ["sos"], queryFn: () => api<Page<Sos>>("/admin/sos?size=20"), refetchInterval: 10000 });
  const resolve = useMutation({
    mutationFn: (id: number) => post(`/admin/sos/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sos"] }),
  });
  const open = q.data?.items.filter((s) => s.status === "OPEN").length ?? 0;
  return (
    <section className="card" aria-labelledby="sos-h">
      <h2 id="sos-h" className="mb-2 font-semibold">
        Live SOS feed {open > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 text-xs text-white">{open} open</span>}
      </h2>
      {q.data?.items.length === 0 && <p className="text-sm text-slate-500">No SOS alerts.</p>}
      <ul className="space-y-2" aria-live="polite">
        {q.data?.items.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-2 rounded-lg p-2 text-sm ${s.status === "OPEN" ? "bg-red-50 dark:bg-red-900/30" : "bg-slate-100 dark:bg-slate-700"}`}>
            <strong>🆘 #{s.id}</strong>
            <span>user #{s.user_id}</span>
            {s.bus_id && <span>bus {buses.find((b) => b.id === s.bus_id)?.bus_number ?? s.bus_id}</span>}
            <a className="text-brand-600 underline dark:text-brand-100" target="_blank" rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=17/${s.lat}/${s.lon}`}>
              {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
            </a>
            <span className="text-slate-500">{fmtDateTime(s.created_at)}</span>
            {s.status === "OPEN" ? (
              <button className="btn-ghost ml-auto" onClick={() => resolve.mutate(s.id)}>Mark resolved</button>
            ) : <span className="ml-auto text-green-700 dark:text-green-300">Resolved</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SimDelayPanel() {
  const buses = useBusMeta().data ?? [];
  const qc = useQueryClient();
  const [busId, setBusId] = useState<number | "">("");
  const [minutes, setMinutes] = useState(15);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (m: number) => {
    if (!busId) return;
    try {
      await post("/admin/sim/delay", { bus_id: busId, minutes: m });
      setMsg(m > 0 ? `Bus held for ${m} min. Subscribers get a delay alert within a few seconds.` : "Delay cleared.");
      qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <section className="card space-y-3" aria-labelledby="sim-h">
      <h2 id="sim-h" className="font-semibold">Simulate delay</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="sim-bus" className="label">Bus</label>
          <select id="sim-bus" className="input" value={busId} onChange={(e) => setBusId(Number(e.target.value) || "")}>
            <option value="">Select bus</option>
            {buses.map((b) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sim-min" className="label">Minutes</label>
          <input id="sim-min" type="number" min={0} max={180} className="input" value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-danger" disabled={!busId} onClick={() => send(minutes)}>Inject delay</button>
        <button className="btn-ghost" disabled={!busId} onClick={() => send(0)}>Clear</button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

interface Ann { id: number; route_id: number | null; message: string; posted_on: string }

export function AnnouncementsPanel({ routes }: { routes: Opt[] }) {
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const q = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => api<Page<Ann>>("/admin/announcements?size=20") });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
  };
  const create = useMutation({
    mutationFn: () => post("/admin/announcements", { route_id: routeId || null, message }),
    onSuccess: () => { setMessage(""); refresh(); },
  });
  const remove = useMutation({ mutationFn: (id: number) => del(`/admin/announcements/${id}`), onSuccess: refresh });
  return (
    <section className="card space-y-3" aria-labelledby="ann-h">
      <h2 id="ann-h" className="font-semibold">Announcements</h2>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <label htmlFor="ann-route" className="label">Route (optional)</label>
        <select id="ann-route" className="input" value={routeId} onChange={(e) => setRouteId(Number(e.target.value) || "")}>
          <option value="">All routes</option>
          {routes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <label htmlFor="ann-msg" className="label">Message</label>
        <textarea id="ann-msg" className="input" rows={2} minLength={3} maxLength={500} required value={message}
          onChange={(e) => setMessage(e.target.value)} />
        <button className="btn-primary" disabled={create.isPending}>Post to commuters</button>
      </form>
      <ul className="space-y-1 text-sm">
        {q.data?.items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 border-t border-slate-100 pt-1 dark:border-slate-700">
            <span className="flex-1">📢 {a.message} <span className="text-slate-500">· {routes.find((r) => r.value === a.route_id)?.label ?? "all routes"} · {fmtDateTime(a.posted_on)}</span></span>
            <button className="text-red-600 underline" onClick={() => remove.mutate(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RS { route_id: number; seq: number; stop_id: number }

export function RouteStopsPanel({ routes, stops }: { routes: Opt[]; stops: Opt[] }) {
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState<number>(routes[0]?.value ?? 1);
  const [stopId, setStopId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "route-stops", routeId], queryFn: () => api<RS[]>(`/admin/route-stops?route_id=${routeId}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "route-stops"] });
    qc.invalidateQueries({ queryKey: ["routes-detail"] });
    qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
  };
  const nextSeq = (q.data?.reduce((m, r) => Math.max(m, r.seq), -1) ?? -1) + 1;
  const add = useMutation({
    mutationFn: () => post("/admin/route-stops", { route_id: routeId, seq: nextSeq, stop_id: stopId }),
    onSuccess: () => { setError(null); refresh(); },
    onError: (e) => setError((e as Error).message),
  });
  const remove = useMutation({ mutationFn: (r: RS) => del(`/admin/route-stops/${r.route_id}/${r.seq}`), onSuccess: refresh });
  return (
    <section className="card space-y-3" aria-labelledby="rs-h">
      <h2 id="rs-h" className="font-semibold">Route stops (order)</h2>
      <label htmlFor="rs-route" className="label">Route</label>
      <select id="rs-route" className="input" value={routeId} onChange={(e) => setRouteId(Number(e.target.value))}>
        {routes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <ol className="space-y-1 text-sm">
        {q.data?.map((r) => (
          <li key={r.seq} className="flex justify-between">
            <span>{r.seq}. {stops.find((s) => s.value === r.stop_id)?.label ?? r.stop_id}</span>
            <button className="text-red-600 underline" onClick={() => remove.mutate(r)}>Remove</button>
          </li>
        ))}
      </ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (stopId) add.mutate(); }}>
        <label htmlFor="rs-stop" className="sr-only">Stop to append</label>
        <select id="rs-stop" className="input" value={stopId} onChange={(e) => setStopId(Number(e.target.value) || "")}>
          <option value="">Append stop…</option>
          {stops.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="btn-primary" disabled={!stopId}>Add</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
