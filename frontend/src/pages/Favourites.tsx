import { Link } from "react-router-dom";
import { ArrowRight, Route as RouteIcon, Signpost, Star, Trash2 } from "lucide-react";
import { useFavourites, useRouteDetails, useStops } from "../lib/queries";
import { routeColor } from "../lib/colors";
import { Arrivals } from "../components/NearbyStops";
import { EmptyState, Page, PageHeader } from "../components/ui";

export default function Favourites() {
  const { list, remove } = useFavourites();
  const routes = useRouteDetails().data ?? [];
  const stops = useStops().data ?? [];
  const favRoutes = list.data?.filter((f) => f.type === "ROUTE") ?? [];
  const favStops = list.data?.filter((f) => f.type === "STOP") ?? [];

  return (
    <Page>
      <PageHeader icon={Star} title="Favourites" subtitle="Your saved routes and stops, with the next buses due." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card" aria-labelledby="fr-h">
          <h2 id="fr-h" className="card-title mb-3">Routes</h2>
          {favRoutes.length === 0 ? (
            <EmptyState icon={RouteIcon} title="No favourite routes yet">Star a route from a route or bus page.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {favRoutes.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200/80 p-2 pl-3 dark:border-slate-800">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: routeColor(f.route_id ?? 1) }} aria-hidden />
                  <Link to={`/routes/${f.route_id}`} className="flex flex-1 items-center gap-1 text-sm font-medium hover:text-brand-600 dark:hover:text-brand-300">
                    {routes.find((r) => r.id === f.route_id)?.name ?? `Route ${f.route_id}`}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </Link>
                  <button className="icon-btn btn-subtle h-8 w-8" aria-label="Remove favourite route" onClick={() => remove.mutate(f.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="fs-h">
          <h2 id="fs-h" className="card-title mb-3">Stops</h2>
          {favStops.length === 0 ? (
            <EmptyState icon={Signpost} title="No favourite stops yet">Star a stop from a route page to see its arrivals here.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {favStops.map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center gap-2">
                    <Signpost className="h-4 w-4 text-slate-400" aria-hidden />
                    <span className="flex-1 text-sm font-medium">{stops.find((s) => s.id === f.stop_id)?.name ?? `Stop ${f.stop_id}`}</span>
                    <button className="icon-btn btn-subtle h-8 w-8" aria-label="Remove favourite stop" onClick={() => remove.mutate(f.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {f.stop_id && <Arrivals stopId={f.stop_id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
