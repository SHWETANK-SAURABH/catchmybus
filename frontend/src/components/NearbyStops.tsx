import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
    <section aria-labelledby="nearby-h">
      <h2 id="nearby-h" className="mb-2 font-semibold">Stops near you</h2>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setAskConsent(true)}>📍 Use my location</button>
        <button className="btn-ghost" onClick={() => { setGeoError(null); onLocation(DEMO_LOCATION); }}>
          Use demo location
        </button>
      </div>
      {geoError && <p role="alert" className="mt-2 text-sm text-red-600">{geoError}</p>}

      {location && (
        <div className="mt-3">
          <label htmlFor="radius" className="label">Radius: {fmtDistance(radius)}</label>
          <input id="radius" type="range" min={200} max={2000} step={100} value={radius}
            onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
          {nearby.data?.length === 0 && <p className="text-sm text-slate-500">No stops within this radius.</p>}
          <ul className="mt-2 space-y-1">
            {nearby.data?.map((s) => (
              <li key={s.id}>
                <button className="flex w-full justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  aria-expanded={selected === s.id} onClick={() => setSelected(selected === s.id ? null : s.id)}>
                  <span>🚏 {s.name}</span>
                  <span className="text-slate-500">{fmtDistance(s.distance_m)}</span>
                </button>
                {selected === s.id && <Arrivals stopId={s.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {askConsent && (
        <Modal title="Share your location?" onClose={() => setAskConsent(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            CatchMyBus uses your location only to find bus stops near you. It is sent with that one
            search and is <strong>not stored</strong> on our servers. You can use the demo location instead.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAskConsent(false)}>Cancel</button>
            <button className="btn-ghost" onClick={() => { setAskConsent(false); onLocation(DEMO_LOCATION); }}>Use demo location</button>
            <button className="btn-primary" onClick={useBrowserLocation}>Allow</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function Arrivals({ stopId }: { stopId: number }) {
  const arrivals = useArrivals(stopId);
  const buses = useBusMeta();
  const name = (id: number) => buses.data?.find((b) => b.id === id)?.bus_number ?? `Bus ${id}`;
  if (arrivals.isLoading) return <p className="px-2 text-xs text-slate-500">Loading arrivals…</p>;
  if (!arrivals.data?.length) return <p className="px-2 text-xs text-slate-500">No live buses for this stop.</p>;
  return (
    <ul className="mb-2 ml-6 space-y-0.5 text-sm">
      {arrivals.data.slice(0, 4).map((a) => (
        <li key={a.bus_id} className="flex justify-between">
          <Link to={`/bus/${a.bus_id}`} className="text-brand-600 underline dark:text-brand-100">{name(a.bus_id)}</Link>
          <span>{fmtEta(a.eta_minutes)}{a.predicted_delay_min >= 1 && <span className="text-amber-600"> (+{Math.round(a.predicted_delay_min)})</span>}</span>
        </li>
      ))}
    </ul>
  );
}
