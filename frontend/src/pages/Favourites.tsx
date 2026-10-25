import { Link } from "react-router-dom";
import { useFavourites, useRouteDetails, useStops } from "../lib/queries";
import { Arrivals } from "../components/NearbyStops";

export default function Favourites() {
  const { list, remove } = useFavourites();
  const routes = useRouteDetails().data ?? [];
  const stops = useStops().data ?? [];
  const favRoutes = list.data?.filter((f) => f.type === "ROUTE") ?? [];
  const favStops = list.data?.filter((f) => f.type === "STOP") ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Favourites</h1>
      <section className="card" aria-labelledby="fr-h">
        <h2 id="fr-h" className="mb-2 font-semibold">Routes</h2>
        {favRoutes.length === 0 && <p className="text-sm text-slate-500">No favourite routes yet. Star one from a route or bus page.</p>}
        <ul className="space-y-1">
          {favRoutes.map((f) => (
            <li key={f.id} className="flex items-center justify-between">
              <Link to={`/routes/${f.route_id}`} className="text-brand-600 underline dark:text-brand-100">
                {routes.find((r) => r.id === f.route_id)?.name ?? `Route ${f.route_id}`}
              </Link>
              <button className="btn-ghost" onClick={() => remove.mutate(f.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card" aria-labelledby="fs-h">
        <h2 id="fs-h" className="mb-2 font-semibold">Stops</h2>
        {favStops.length === 0 && <p className="text-sm text-slate-500">No favourite stops yet.</p>}
        <ul className="space-y-3">
          {favStops.map((f) => (
            <li key={f.id}>
              <div className="flex items-center justify-between">
                <strong>🚏 {stops.find((s) => s.id === f.stop_id)?.name ?? `Stop ${f.stop_id}`}</strong>
                <button className="btn-ghost" onClick={() => remove.mutate(f.id)}>Remove</button>
              </div>
              {f.stop_id && <Arrivals stopId={f.stop_id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
