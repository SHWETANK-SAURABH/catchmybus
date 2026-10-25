import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Bus, ChevronDown, Repeat, Route as RouteIcon, Star } from "lucide-react";
import { useBusMeta, useFavourites, useRouteDetails } from "../lib/queries";
import { useTracking } from "../hooks/useTracking";
import { fmtDistance } from "../lib/format";
import { routeColor } from "../lib/colors";
import LiveMap from "../components/LiveMap";
import { Arrivals } from "../components/NearbyStops";

export default function RouteDetail() {
  const routeId = Number(useParams().id);
  const route = useRouteDetails().data?.find((r) => r.id === routeId);
  const { buses } = useTracking();
  const meta = useBusMeta().data?.filter((b) => b.route_id === routeId) ?? [];
  const favs = useFavourites();
  const [openStop, setOpenStop] = useState<number | null>(null);

  if (!route) return <p className="p-6 muted" role="status">Loading route…</p>;
  const isFav = !!favs.find("ROUTE", route.id);
  const stops = route.is_loop ? route.stops.slice(0, -1) : route.stops;
  const color = routeColor(route.id);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
      <div className="card h-[42vh] overflow-hidden p-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <LiveMap className="h-full w-full" routes={[route]}
          buses={Object.values(buses).filter((b) => b.route_id === routeId)} />
      </div>
      <div className="space-y-4">
        <section className="card space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: color }}>
              <RouteIcon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight">{route.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                {route.source} <ArrowRight className="h-3.5 w-3.5" aria-label="to" /> {route.destination}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{fmtDistance(route.length_m)}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{stops.length} stops</span>
            {route.is_loop && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Repeat className="h-3 w-3" aria-hidden /> Loop
              </span>
            )}
          </div>
          <button className="btn-ghost w-full" aria-pressed={isFav} onClick={() => favs.toggle("ROUTE", route.id)}>
            <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} aria-hidden />
            {isFav ? "Favourite route" : "Add to favourites"}
          </button>
        </section>

        <section className="card" aria-labelledby="buses-h">
          <h2 id="buses-h" className="card-title mb-3">Buses on this route</h2>
          <ul className="space-y-2">
            {meta.map((b) => {
              const live = buses[b.id];
              return (
                <li key={b.id}>
                  <Link to={`/bus/${b.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200/80 p-3 transition hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <Bus className="h-5 w-5" style={{ color }} aria-hidden />
                    <span className="flex-1 text-sm font-medium">{b.bus_number}</span>
                    <span className={`text-xs ${live ? "text-slate-500 dark:text-slate-400" : "text-slate-400"}`}>
                      {live ? `${Math.round(live.speed_kmh)} km/h` : "offline"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card" aria-labelledby="stops-h">
          <h2 id="stops-h" className="card-title mb-4">Stops</h2>
          <ol>
            {stops.map((s, i) => {
              const fav = !!favs.find("STOP", s.stop.id);
              const open = openStop === s.stop.id;
              return (
                <li key={s.seq} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < stops.length - 1 && (
                    <span className="absolute bottom-0 left-[9px] top-5 w-0.5" style={{ background: color, opacity: 0.35 }} aria-hidden />
                  )}
                  <span className="relative mt-1 h-5 w-5 shrink-0 rounded-full border-[3px] bg-white dark:bg-slate-900" style={{ borderColor: color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button className="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-brand-600 dark:hover:text-brand-300"
                        aria-expanded={open} onClick={() => setOpenStop(open ? null : s.stop.id)}>
                        {s.stop.name}
                        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      <button aria-label={fav ? `Remove ${s.stop.name} from favourites` : `Favourite ${s.stop.name}`}
                        aria-pressed={fav} className="icon-btn btn-subtle h-8 w-8" onClick={() => favs.toggle("STOP", s.stop.id)}>
                        <Star className={`h-4 w-4 ${fav ? "fill-amber-400 text-amber-400" : ""}`} aria-hidden />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDistance(s.distance_m)} from start</p>
                    {open && <div className="mt-2"><Arrivals stopId={s.stop.id} /></div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
