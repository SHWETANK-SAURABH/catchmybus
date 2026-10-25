import { Link, useParams } from "react-router-dom";
import { useBusMeta, useFavourites, useRouteDetails } from "../lib/queries";
import { useTracking } from "../hooks/useTracking";
import { fmtDistance } from "../lib/format";
import { routeColor } from "../lib/colors";
import LiveMap from "../components/LiveMap";
import { Arrivals } from "../components/NearbyStops";
import { useState } from "react";

export default function RouteDetail() {
  const routeId = Number(useParams().id);
  const route = useRouteDetails().data?.find((r) => r.id === routeId);
  const { buses } = useTracking();
  const meta = useBusMeta().data?.filter((b) => b.route_id === routeId) ?? [];
  const favs = useFavourites();
  const [openStop, setOpenStop] = useState<number | null>(null);

  if (!route) return <p className="p-6" role="status">Loading route…</p>;
  const isFav = !!favs.find("ROUTE", route.id);
  const stops = route.is_loop ? route.stops.slice(0, -1) : route.stops;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
      <div className="card h-[45vh] p-0 lg:h-[calc(100vh-90px)]">
        <LiveMap className="h-full w-full rounded-xl" routes={[route]}
          buses={Object.values(buses).filter((b) => b.route_id === routeId)} />
      </div>
      <div className="space-y-4">
        <section className="card space-y-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span className="h-3 w-3 rounded-full" style={{ background: routeColor(route.id) }} aria-hidden />
            {route.name}
          </h1>
          <p className="text-sm text-slate-500">
            {route.source} → {route.destination} · {fmtDistance(route.length_m)}{route.is_loop ? " · loop" : ""}
          </p>
          <button className="btn-ghost" aria-pressed={isFav} onClick={() => favs.toggle("ROUTE", route.id)}>
            {isFav ? "★ Favourite route" : "☆ Add to favourites"}
          </button>
        </section>
        <section className="card" aria-labelledby="buses-h">
          <h2 id="buses-h" className="mb-2 font-semibold">Buses on this route</h2>
          <ul className="space-y-1">
            {meta.map((b) => (
              <li key={b.id}>
                <Link to={`/bus/${b.id}`} className="text-brand-600 underline dark:text-brand-100">{b.bus_number}</Link>
                <span className="ml-2 text-sm text-slate-500">{buses[b.id] ? `${Math.round(buses[b.id].speed_kmh)} km/h` : "offline"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card" aria-labelledby="stops-h">
          <h2 id="stops-h" className="mb-2 font-semibold">Stops</h2>
          <ol className="space-y-1">
            {stops.map((s) => {
              const fav = !!favs.find("STOP", s.stop.id);
              return (
                <li key={s.seq}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-right text-slate-500">{s.seq + 1}.</span>
                    <button className="flex-1 text-left hover:underline" aria-expanded={openStop === s.stop.id}
                      onClick={() => setOpenStop(openStop === s.stop.id ? null : s.stop.id)}>{s.stop.name}</button>
                    <button aria-label={fav ? `Remove ${s.stop.name} from favourites` : `Favourite ${s.stop.name}`}
                      aria-pressed={fav} className="text-amber-500" onClick={() => favs.toggle("STOP", s.stop.id)}>
                      {fav ? "★" : "☆"}
                    </button>
                  </div>
                  {openStop === s.stop.id && <Arrivals stopId={s.stop.id} />}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
