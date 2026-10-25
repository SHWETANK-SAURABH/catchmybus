import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { chartRouteColor, chartTheme, crowdStyle } from "../lib/colors";
import type { CrowdLevel } from "../lib/types";

interface AnalyticsData {
  days: number;
  total_trips: number;
  ridership_by_route: { route_id: number; route: string; trips: number }[];
  ridership_by_hour: { hour: number; trips: number }[];
  avg_delay_by_route: { route_id: number; route: string; avg_delay_min: number; samples: number }[];
  crowd_distribution: { level: CrowdLevel; count: number }[];
  sos: { total: number; open: number; resolved: number };
}

interface Metrics {
  trained_at: string;
  dataset: { rows: number; synthetic: boolean };
  crowd: { accuracy: number; labels: string[]; confusion_matrix: number[][]; f1_per_class: Record<string, number>; model: string };
  delay: { mae_min: number; r2: number; baseline_mae_min: number; model: string };
}

const shortRoute = (name: string) => name.split(" ")[0]; // "R1 Katpadi - ..." -> "R1"

/** Admin analytics dashboard (FR33) plus the AI model evaluation metrics. */
export default function Analytics() {
  const [days, setDays] = useState(14);
  const q = useQuery({ queryKey: ["admin", "analytics", days], queryFn: () => api<AnalyticsData>(`/admin/analytics?days=${days}`), refetchInterval: 30000 });
  const metrics = useQuery({ queryKey: ["ai-metrics"], queryFn: () => api<Metrics>("/ai/metrics"), retry: false });
  const t = chartTheme();
  const d = q.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="days" className="text-sm">Period</label>
        <select id="days" className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 14, 30].map((n) => <option key={n} value={n}>Last {n} day{n > 1 ? "s" : ""}</option>)}
        </select>
      </div>

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Trips" value={d.total_trips.toLocaleString()} />
            <Tile label="Busiest route" value={shortRoute([...d.ridership_by_route].sort((a, b) => b.trips - a.trips)[0]?.route ?? "—")} />
            <Tile label="SOS alerts" value={String(d.sos.total)} />
            <Tile label="SOS open" value={String(d.sos.open)} warn={d.sos.open > 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ridership by hour of day" table={
              <SimpleTable head={["Hour", "Trips"]} rows={d.ridership_by_hour.map((r) => [`${r.hour}:00`, r.trips])} />}>
              <BarChart data={d.ridership_by_hour} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey="hour" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.grid }} />
                <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: t.grid, opacity: 0.4 }} labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                <Bar dataKey="trips" name="Trips" fill={t.series1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Ridership by route" table={
              <SimpleTable head={["Route", "Trips"]} rows={d.ridership_by_route.map((r) => [r.route, r.trips])} />}>
              <BarChart data={d.ridership_by_route.map((r) => ({ ...r, short: shortRoute(r.route) }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey="short" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.grid }} />
                <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: t.grid, opacity: 0.4 }} labelFormatter={(_l, p) => p?.[0]?.payload.route ?? ""} />
                <Bar dataKey="trips" name="Trips" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {d.ridership_by_route.map((r) => <Cell key={r.route_id} fill={chartRouteColor(r.route_id)} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="Average delay by route (minutes)" table={
              <SimpleTable head={["Route", "Avg delay (min)", "Samples"]} rows={d.avg_delay_by_route.map((r) => [r.route, r.avg_delay_min, r.samples])} />}>
              <BarChart data={d.avg_delay_by_route.map((r) => ({ ...r, short: shortRoute(r.route) }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey="short" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.grid }} />
                <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: t.grid, opacity: 0.4 }} labelFormatter={(_l, p) => p?.[0]?.payload.route ?? ""}
                  formatter={(v: number) => [`${v.toFixed(2)} min`, "Avg delay"]} />
                <Bar dataKey="avg_delay_min" name="Avg delay" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {d.avg_delay_by_route.map((r) => <Cell key={r.route_id} fill={chartRouteColor(r.route_id)} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="Crowd level distribution (predictions)" table={
              <SimpleTable head={["Level", "Count"]} rows={d.crowd_distribution.map((c) => [crowdStyle[c.level].label, c.count])} />}>
              <BarChart data={d.crowd_distribution.map((c) => ({ ...c, label: crowdStyle[c.level].label }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.grid }} />
                <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: t.grid, opacity: 0.4 }} />
                <Bar dataKey="count" name="Predictions" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {d.crowd_distribution.map((c) => <Cell key={c.level} fill={crowdStyle[c.level].dot} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      <section className="card" aria-labelledby="ai-h">
        <h2 id="ai-h" className="font-semibold">AI model metrics</h2>
        {metrics.isError && <p className="text-sm text-slate-500">Models not trained yet: run <code>make train</code>.</p>}
        {metrics.data && (
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">Crowd classifier</h3>
              <p className="text-xs text-slate-500">{metrics.data.crowd.model}</p>
              <p className="mt-1 text-2xl font-semibold">{(metrics.data.crowd.accuracy * 100).toFixed(1)}% <span className="text-sm font-normal">accuracy</span></p>
              <table className="mt-2 text-center text-xs" aria-label="Confusion matrix, rows are true labels, columns are predictions">
                <thead>
                  <tr><th scope="col" className="p-1 text-left">true \ pred</th>{metrics.data.crowd.labels.map((l) => <th key={l} scope="col" className="p-1">{l}</th>)}</tr>
                </thead>
                <tbody>
                  {metrics.data.crowd.confusion_matrix.map((row, i) => (
                    <tr key={i}>
                      <th scope="row" className="p-1 text-left">{metrics.data!.crowd.labels[i]}</th>
                      {row.map((v, j) => (
                        <td key={j} className={`p-1 tabular-nums ${i === j ? "bg-brand-100 font-semibold dark:bg-brand-700/40" : ""}`}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-sm font-medium">Delay regressor</h3>
              <p className="text-xs text-slate-500">{metrics.data.delay.model}</p>
              <dl className="mt-1 grid grid-cols-3 gap-2 text-center">
                <Tile label="MAE" value={`${metrics.data.delay.mae_min.toFixed(2)} min`} />
                <Tile label="R²" value={metrics.data.delay.r2.toFixed(3)} />
                <Tile label="Baseline MAE" value={`${metrics.data.delay.baseline_mae_min.toFixed(2)} min`} />
              </dl>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 md:col-span-2">
              ⚠️ Trained on {metrics.data.dataset.rows.toLocaleString()} rows of <strong>synthetic</strong> data (scripts/generate_data.py). For demonstration only.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${warn ? "text-red-600 dark:text-red-400" : ""}`}>{value}</div>
    </div>
  );
}

/** Chart with a "Show table" toggle so the data is never available only as colour/shape. */
function ChartCard({ title, children, table }: { title: string; children: React.ReactElement; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card" aria-label={title}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <button className="text-xs underline" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? table : <div className="h-56"><ResponsiveContainer>{children}</ResponsiveContainer></div>}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-56 overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500">{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-700">{r.map((c, j) => <td key={j} className="tabular-nums">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
