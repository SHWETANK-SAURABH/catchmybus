import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, LocateFixed, MapPinned, ShieldCheck, Signpost } from "lucide-react";
import { api } from "../lib/api";
import type { NearbyStop } from "../lib/types";
import { useArrivals, useBusMeta } from "../lib/queries";
import { fmtDistance, fmtEta } from "../lib/format";
import Modal from "./Modal";

// Gandhi Nagar, Katpadi: a spot served by all three demo routes.
export const DEMO_LOCATION: [number, number] = [12.959, 79.1385];

/**
 * Nearby stops (FR08). Before touching geolocation we show a short privacy note and
 * ask for consent (NFR13); "Use demo location" skips the browser prompt entirely.
 */
export default function NearbyStops({ location, onLocation }: {
  location: [number, number] | null;
  onLocation: (loc: [number, number]) => void;
}) {
  const [askConsent, setAskConsent] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [radius, setRadius] = useState(800);
  const [selected, setSelected] = useState<number | null>(null);

  const nearby = useQuery({
    queryKey: ["nearby", location, radius],
    queryFn: () => api<NearbyStop[]>(`/stops/nearby?lat=${location![0]}&lon=${location![1]}&radius_m=${radius}`),
    enabled: !!location,
  });

  const useBrowserLocation = () => {
    setAskConsent(false);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setGeoError("Location permission denied - try the demo location."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <section aria-labelledby="nearby-h" className="space-y-3">
      <h2 id="nearby-h" className="sr-only">Stops near you</h2>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={() => setAskConsent(true)}>
          <LocateFixed className="h-4 w-4" aria-hidden /> My location
        </button>
        <button className="btn-ghost" onClick={() => { setGeoError(null); onLocation(DEMO_LOCATION); }}>
          <MapPinned className="h-4 w-4" aria-hidden /> Demo location
        </button>
      </div>
      {geoError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{geoError}</p>}
      {!location && !geoError && (
        <p className="muted">Find bus stops around you and see which buses arrive next.</p>
      )}

      {location && (
        <>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="radius" className="label mb-0">Search radius</label>
              <span className="text-sm font-medium tabular-nums text-brand-600 dark:text-brand-300">{fmtDistance(radius)}</span>
            </div>
            <input id="radius" type="range" min={200} max={2000} step={100} value={radius}
              onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 w-full accent-brand-600" />
          </div>
          {nearby.data?.length === 0 && <p className="muted">No stops within this radius. Try widening it.</p>}
          <ul className="space-y-1.5">
            {nearby.data?.map((s) => {
              const open = selected === s.id;
              return (
                <li key={s.id} className={`rounded-xl border transition ${open ? "border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-900/20" : "border-slate-200/80 dark:border-slate-800"}`}>
                  <button className="flex w-full items-center gap-3 p-2.5 text-left" aria-expanded={open}
                    onClick={() => setSelected(open ? null : s.id)}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <Signpost className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{fmtDistance(s.distance_m)} away</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {open && <div className="px-2.5 pb-2.5"><Arrivals stopId={s.id} /></div>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {askConsent && (
        <Modal title="Share your location?" onClose={() => setAskConsent(false)}>
          <div className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
            <p>
              CatchMyBus uses your location only to find bus stops near you. It is sent with that one
              search and is <strong>not stored</strong> on our servers. You can use the demo location instead.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAskConsent(false)}>Cancel</button>
            <button className="btn-ghost" onClick={() => { setAskConsent(false); onLocation(DEMO_LOCATION); }}>Use demo location</button>
            <button className="btn-primary" onClick={useBrowserLocation}>Allow</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** Next buses due at a stop, soonest first. */
export function Arrivals({ stopId }: { stopId: number }) {
  const arrivals = useArrivals(stopId);
  const buses = useBusMeta();
  const name = (id: number) => buses.data?.find((b) => b.id === id)?.bus_number ?? `Bus ${id}`;
  if (arrivals.isLoading) return <p className="py-1 text-xs text-slate-500">Loading arrivals…</p>;
  if (!arrivals.data?.length) return <p className="py-1 text-xs text-slate-500">No live buses for this stop.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
      {arrivals.data.slice(0, 4).map((a) => (
        <li key={a.bus_id} className="flex items-center justify-between gap-2 px-3 py-2">
          <Link to={`/bus/${a.bus_id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">{name(a.bus_id)}</Link>
          <span className="flex items-center gap-2">
            {a.predicted_delay_min >= 1 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">+{Math.round(a.predicted_delay_min)} min</span>
            )}
            <EtaPill minutes={a.eta_minutes} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Rounded ETA chip; "Due" is highlighted. */
export function EtaPill({ minutes }: { minutes: number }) {
  const due = minutes < 1;
  return (
    <span className={`self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${due
      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
      {fmtEta(minutes)}
    </span>
  );
}
