import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { RouteDetail } from "../lib/types";
import { routeColor } from "../lib/colors";

export default function Search() {
  const [params] = useSearchParams();
  const source = params.get("source") ?? "";
  const destination = params.get("destination") ?? "";
  const q = new URLSearchParams({ source, destination }).toString();
  const routes = useQuery({ queryKey: ["search", q], queryFn: () => api<RouteDetail[]>(`/routes/search?${q}`) });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{source} → {destination}</h1>
      <section className="card" aria-labelledby="routes-h">
        <h2 id="routes-h" className="mb-2 font-semibold">Routes serving both stops</h2>
        {routes.isLoading && <p role="status">Searching…</p>}
        {routes.data?.length === 0 && <p className="text-sm text-slate-500">No direct route found.</p>}
        <ul className="space-y-2">
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
