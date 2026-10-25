import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, post } from "../lib/api";
import type { Crowd, Delay, Eta } from "../lib/types";
import { useBusMeta, useFavourites, useRouteDetails } from "../lib/queries";
import { useTracking } from "../hooks/useTracking";
import { fmtDistance, fmtEta } from "../lib/format";
import LiveMap from "../components/LiveMap";
import Modal from "../components/Modal";
import CrowdBadge from "../components/CrowdBadge";

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

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
      <div className="card h-[45vh] p-0 lg:h-[calc(100vh-90px)]">
        <LiveMap className="h-full w-full rounded-xl" routes={route ? [route] : []}
          buses={Object.values(buses).filter((b) => b.route_id === route?.id)}
          highlightBusId={tracking ? busId : null} highlightRouteId={route?.id} />
      </div>

      <div className="space-y-4">
        <section className="card space-y-3" aria-labelledby="bus-h">
          <div>
            <h1 id="bus-h" className="text-xl font-semibold">🚌 {meta?.bus_number ?? `Bus ${busId}`}</h1>
            {route && <Link to={`/routes/${route.id}`} className="text-sm text-brand-600 underline dark:text-brand-100">{route.name}</Link>}
            <div className="mt-1">
              <CrowdBadge level={crowd.data?.level}
                title={crowd.data ? `Predicted for ${crowd.data.hour}:00 (${crowd.data.source})` : undefined} />
            </div>
          </div>
          {live ? (
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Speed" value={`${Math.round(live.speed_kmh)} km/h`} />
              <Stat label="Load" value={`${live.load}/${live.capacity}`} />
              <Stat label="Pred. delay" value={`${Math.round(maxDelay)} min`} warn={maxDelay >= 10} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">This bus is not live right now.</p>
          )}
          {live?.delay_min ? (
            <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200">
              Held by an incident: about {Math.round(live.delay_min)} min more.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button className={tracking ? "btn-primary" : "btn-ghost"} aria-pressed={tracking} onClick={() => setTracking(!tracking)}>
              🎯 {tracking ? "Tracking" : "Track this bus"}
            </button>
            <button className="btn-ghost" onClick={() => setAlertOpen(true)} disabled={!route}>🔔 Set alert</button>
            <button className="btn-ghost" onClick={() => setTripOpen(true)} disabled={!route}>🧾 Start trip</button>
            {route && (
              <button className="btn-ghost" aria-pressed={isFav} onClick={() => favs.toggle("ROUTE", route.id)}>
                {isFav ? "★ Favourited" : "☆ Favourite"}
              </button>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="eta-h">
          <h2 id="eta-h" className="mb-2 font-semibold">ETA per stop</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th scope="col" className="py-1">Stop</th>
                <th scope="col">Distance</th>
                <th scope="col">ETA</th>
                <th scope="col" title="Confidence">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {etas.data?.map((e) => (
                <tr key={e.stop_id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1">{stopName(e.stop_id)}</td>
                  <td>{fmtDistance(e.distance_m)}</td>
                  <td className="font-medium">{fmtEta(e.eta_minutes)}</td>
                  <td>{Math.round(e.confidence * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-700">
      <dt className="text-xs text-slate-500 dark:text-slate-300">{label}</dt>
      <dd className={`font-semibold ${warn ? "text-red-600 dark:text-red-400" : ""}`}>{value}</dd>
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
          <p className="text-sm">✅ Trip started. You'll get delay alerts for this bus; see it under <Link className="underline" to="/trips">Trips</Link>.</p>
          <div className="mt-4 text-right"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <div className="space-y-3">
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
          <p className="text-sm">✅ We'll notify you when this bus is {minutes} min away, and if it is delayed.</p>
          <div className="mt-4 text-right"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <div className="space-y-3">
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
