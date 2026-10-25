import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AlarmClock, BellPlus, Bus, Crosshair, Gauge, Ticket, Star, TriangleAlert, Users } from "lucide-react";
import { api, post } from "../lib/api";
import type { Crowd, Delay, Eta } from "../lib/types";
import { useBusMeta, useFavourites, useRouteDetails } from "../lib/queries";
import { useTracking } from "../hooks/useTracking";
import { fmtDistance } from "../lib/format";
import { routeColor } from "../lib/colors";
import LiveMap from "../components/LiveMap";
import Modal from "../components/Modal";
import CrowdBadge from "../components/CrowdBadge";
import { EtaPill } from "../components/NearbyStops";
import { EmptyState, StatTile, SuccessNote } from "../components/ui";

/** Bus detail: live position, ETA per stop, delay, and Track / Set alert / Favourite actions. */
export default function BusDetail() {
  const busId = Number(useParams().id);
  const { buses } = useTracking();
  const meta = useBusMeta().data?.find((b) => b.id === busId);
  const routes = useRouteDetails().data ?? [];
  const live = buses[busId];
  const route = routes.find((r) => r.id === (live?.route_id ?? meta?.route_id));
  const favs = useFavourites();
  const [tracking, setTracking] = useState(true);
  const [alertOpen, setAlertOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);

  const etas = useQuery({
    queryKey: ["eta-bus", busId],
    queryFn: () => api<Eta[]>(`/eta/bus/${busId}`),
    refetchInterval: 4000,
  });
  const crowd = useQuery({ queryKey: ["crowd", busId], queryFn: () => api<Crowd>(`/ai/crowd?bus_id=${busId}`), refetchInterval: 15000 });
  const delay = useQuery({ queryKey: ["delay", busId], queryFn: () => api<Delay>(`/ai/delay?bus_id=${busId}`), refetchInterval: 5000 });
  const stopName = (id: number) => route?.stops.find((s) => s.stop.id === id)?.stop.name ?? `Stop ${id}`;
  const maxDelay = delay.data?.total_delay_min ?? 0;
  const isFav = route ? !!favs.find("ROUTE", route.id) : false;
  const color = route ? routeColor(route.id) : "#64748b";

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
      <div className="card h-[42vh] overflow-hidden p-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <LiveMap className="h-full w-full" routes={route ? [route] : []}
          buses={Object.values(buses).filter((b) => b.route_id === route?.id)}
          highlightBusId={tracking ? busId : null} highlightRouteId={route?.id} />
      </div>

      <div className="space-y-4">
        <section className="card space-y-4" aria-labelledby="bus-h">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: color }}>
              <Bus className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="bus-h" className="text-xl font-bold tracking-tight">{meta?.bus_number ?? `Bus ${busId}`}</h1>
              {route && (
                <Link to={`/routes/${route.id}`} className="text-sm text-slate-500 hover:text-brand-600 hover:underline dark:text-slate-400">
                  {route.name}
                </Link>
              )}
            </div>
            <CrowdBadge level={crowd.data?.level}
              title={crowd.data ? `Predicted for ${crowd.data.hour}:00 (${crowd.data.source})` : undefined} />
          </div>

          {live ? (
            <dl className="grid grid-cols-3 gap-2">
              <StatTile icon={Gauge} label="Speed" value={<>{Math.round(live.speed_kmh)}<span className="text-xs font-normal"> km/h</span></>} />
              <StatTile icon={Users} label="Live load" value={<>{live.load}<span className="text-xs font-normal">/{live.capacity}</span></>} />
              <StatTile icon={AlarmClock} label="Pred. delay" value={<>{Math.round(maxDelay)}<span className="text-xs font-normal"> min</span></>}
                tone={maxDelay >= 10 ? "warn" : "default"} />
            </dl>
          ) : (
            <p className="muted">This bus is not live right now.</p>
          )}

          {live?.delay_min ? (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              Held by an incident: about {Math.round(live.delay_min)} min more.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button className={tracking ? "btn-primary" : "btn-ghost"} aria-pressed={tracking} onClick={() => setTracking(!tracking)}>
              <Crosshair className="h-4 w-4" aria-hidden /> {tracking ? "Tracking" : "Track bus"}
            </button>
            <button className="btn-ghost" onClick={() => setAlertOpen(true)} disabled={!route}>
              <BellPlus className="h-4 w-4" aria-hidden /> Set alert
            </button>
            <button className="btn-ghost" onClick={() => setTripOpen(true)} disabled={!route}>
              <Ticket className="h-4 w-4" aria-hidden /> Start trip
            </button>
            {route && (
              <button className="btn-ghost" aria-pressed={isFav} onClick={() => favs.toggle("ROUTE", route.id)}>
                <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} aria-hidden /> {isFav ? "Favourited" : "Favourite"}
              </button>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="eta-h">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="eta-h" className="card-title">Upcoming stops</h2>
            <span className="text-xs text-slate-400">updates every 4 s</span>
          </div>
          {etas.data?.length ? (
            <ol>
              {etas.data.map((e, i) => (
                <li key={e.stop_id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < etas.data.length - 1 && (
                    <span className="absolute bottom-0 left-[11px] top-6 w-0.5 bg-slate-200 dark:bg-slate-700" aria-hidden />
                  )}
                  <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                    style={i === 0 ? { borderColor: color } : undefined} aria-hidden>
                    {i === 0 && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${i === 0 ? "font-semibold" : "font-medium"}`}>
                      {stopName(e.stop_id)}
                      {i === 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">next stop</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fmtDistance(e.distance_m)} · {Math.round(e.confidence * 100)}% confidence
                    </p>
                  </div>
                  <EtaPill minutes={e.eta_minutes} />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={Bus} title="No live ETAs">This bus isn't sending positions right now.</EmptyState>
          )}
        </section>
      </div>

      {tripOpen && route && (
        <TripModal busId={busId} stops={route.stops.map((s) => s.stop)} onClose={() => setTripOpen(false)} />
      )}
      {alertOpen && route && (
        <AlertModal busId={busId} stops={route.stops.map((s) => s.stop)} onClose={() => setAlertOpen(false)} />
      )}
    </div>
  );
}

function TripModal({ busId, stops, onClose }: { busId: number; stops: { id: number; name: string }[]; onClose: () => void }) {
  const unique = [...new Map(stops.map((s) => [s.id, s])).values()];
  const [board, setBoard] = useState(unique[0]?.id ?? 0);
  const [alight, setAlight] = useState(unique[unique.length - 1]?.id ?? 0);
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  const save = () =>
    post("/trips/start", { bus_id: busId, board_stop_id: board, alight_stop_id: alight })
      .then(() => setState("done"))
      .catch((e) => setState((e as Error).message));
  return (
    <Modal title="Start a trip" onClose={onClose}>
      {state === "done" ? (
        <>
          <SuccessNote>
            Trip started. You'll get delay alerts for this bus; see it under <Link className="font-medium underline" to="/trips">Trips</Link>.
          </SuccessNote>
          <div className="mt-5 text-right"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="trip-board" className="label">Boarding at</label>
            <select id="trip-board" className="input" value={board} onChange={(e) => setBoard(Number(e.target.value))}>
              {unique.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="trip-alight" className="label">Getting off at</label>
            <select id="trip-alight" className="input" value={alight} onChange={(e) => setAlight(Number(e.target.value))}>
              {unique.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {state !== "idle" && <p role="alert" className="text-sm text-red-600">{state}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={board === alight}>Start trip</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AlertModal({ busId, stops, onClose }: { busId: number; stops: { id: number; name: string }[]; onClose: () => void }) {
  const unique = [...new Map(stops.map((s) => [s.id, s])).values()];
  const [stopId, setStopId] = useState(unique[0]?.id ?? 0);
  const [minutes, setMinutes] = useState(5);
  const [state, setState] = useState<"idle" | "saving" | "done" | string>("idle");

  const save = async () => {
    setState("saving");
    try {
      await post("/alerts/subscribe", { bus_id: busId, stop_id: stopId, minutes_before: minutes });
      setState("done");
    } catch (e) {
      setState((e as Error).message);
    }
  };

  return (
    <Modal title="Set an arrival alert" onClose={onClose}>
      {state === "done" ? (
        <>
          <SuccessNote>We'll notify you when this bus is {minutes} min away, and if it is delayed.</SuccessNote>
          <div className="mt-5 text-right"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="alert-stop" className="label">Stop</label>
            <select id="alert-stop" className="input" value={stopId} onChange={(e) => setStopId(Number(e.target.value))}>
              {unique.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="alert-min" className="label">Notify me when the bus is this many minutes away</label>
            <input id="alert-min" type="number" min={1} max={60} className="input" value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))} />
          </div>
          {state !== "idle" && state !== "saving" && <p role="alert" className="text-sm text-red-600">{state}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={state === "saving"}>Set alert</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
