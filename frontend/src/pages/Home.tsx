import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LiveMap from "../components/LiveMap";
import NearbyStops from "../components/NearbyStops";
import SearchBar from "../components/SearchBar";
import { useTracking } from "../hooks/useTracking";
import { useRouteDetails } from "../lib/queries";
import { useCrowdAll } from "../components/CrowdBadge";
import { crowdStyle, routeColor } from "../lib/colors";

/** Full-screen live map with a search + nearby-stops panel (bottom sheet on phones). */
export default function Home() {
  const { buses, connected } = useTracking();
  const routes = useRouteDetails();
  const navigate = useNavigate();
  const crowd = useCrowdAll().data;
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="relative h-[calc(100dvh-106px)] sm:h-[calc(100dvh-57px)]">
      <LiveMap routes={routes.data ?? []} buses={Object.values(buses)} userLocation={location}
        onBusClick={(b) => navigate(`/bus/${b.bus_id}`)}
        busDot={(b) => (crowd?.[b.bus_id] ? crowdStyle[crowd[b.bus_id].level].dot : undefined)} />

      <aside aria-label="Search and nearby stops"
        className="absolute inset-x-2 bottom-2 z-[500] max-h-[60%] overflow-auto sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-80">
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs" role="status">
              {connected ? "🟢 Live" : "🟠 Reconnecting…"} · {Object.keys(buses).length} buses
            </span>
            <button className="text-xs underline sm:hidden" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>
              {panelOpen ? "Hide" : "Show"} panel
            </button>
          </div>
          <div className={panelOpen ? "space-y-4" : "hidden sm:block sm:space-y-4"}>
            <MapLegend routes={(routes.data ?? []).map((r) => ({ id: r.id, name: r.name }))} />
            <SearchBar />
            <hr className="border-slate-200 dark:border-slate-700" />
            <NearbyStops location={location} onLocation={setLocation} />
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Route colours and the crowd dot meaning, so identity is never colour-alone. */
function MapLegend({ routes }: { routes: { id: number; name: string }[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium">Legend</summary>
      <ul className="mt-1 space-y-0.5">
        {routes.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="h-1 w-5 rounded" style={{ background: routeColor(r.id) }} aria-hidden /> {r.name}
          </li>
        ))}
        {(["LOW", "MEDIUM", "HIGH"] as const).map((l) => (
          <li key={l} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: crowdStyle[l].dot }} aria-hidden />
            Bus dot: {crowdStyle[l].label} crowd
          </li>
        ))}
      </ul>
    </details>
  );
}
