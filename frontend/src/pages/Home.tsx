import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Info, Navigation, Search } from "lucide-react";
import LiveMap from "../components/LiveMap";
import NearbyStops from "../components/NearbyStops";
import SearchBar from "../components/SearchBar";
import { FULL_HEIGHT } from "../components/Layout";
import { useTracking } from "../hooks/useTracking";
import { useRouteDetails } from "../lib/queries";
import { useCrowdAll } from "../components/CrowdBadge";
import { crowdStyle, routeColor } from "../lib/colors";

type Tab = "search" | "nearby";

/** Full-screen live map with a floating Search / Nearby panel (bottom sheet on phones). */
export default function Home() {
  const { buses, connected } = useTracking();
  const routes = useRouteDetails();
  const navigate = useNavigate();
  const crowd = useCrowdAll().data;
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [tab, setTab] = useState<Tab>("search");
  const [panelOpen, setPanelOpen] = useState(true);
  const busCount = Object.keys(buses).length;

  return (
    <div className={`relative ${FULL_HEIGHT}`}>
      <LiveMap routes={routes.data ?? []} buses={Object.values(buses)} userLocation={location}
        onBusClick={(b) => navigate(`/bus/${b.bus_id}`)}
        busDot={(b) => (crowd?.[b.bus_id] ? crowdStyle[crowd[b.bus_id].level].dot : undefined)} />

      <aside aria-label="Search and nearby stops"
        className="absolute inset-x-2 bottom-2 z-[500] flex max-h-[65%] flex-col sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-4 sm:max-h-[calc(100%-2rem)] sm:w-[22rem]">
        <div className="card flex min-h-0 flex-col p-0 shadow-float">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${connected
              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-green-500" : "bg-amber-500"}`} aria-hidden />
              {connected ? "Live" : "Reconnecting"} · {busCount} bus{busCount === 1 ? "" : "es"}
            </span>
            <button className="btn-subtle px-2 py-1 text-xs sm:hidden" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>
              {panelOpen ? "Hide" : "Show"} <ChevronDown className={`h-3.5 w-3.5 transition ${panelOpen ? "" : "rotate-180"}`} aria-hidden />
            </button>
          </div>

          <div className={`min-h-0 flex-col ${panelOpen ? "flex" : "hidden sm:flex"}`}>
            <div className="px-4 pt-3">
              <div role="tablist" aria-label="Panel" className="tabs grid w-full grid-cols-2">
                <button role="tab" aria-selected={tab === "search"} className={`tab justify-center ${tab === "search" ? "tab-active" : ""}`} onClick={() => setTab("search")}>
                  <Search className="h-4 w-4" aria-hidden /> Plan trip
                </button>
                <button role="tab" aria-selected={tab === "nearby"} className={`tab justify-center ${tab === "nearby" ? "tab-active" : ""}`} onClick={() => setTab("nearby")}>
                  <Navigation className="h-4 w-4" aria-hidden /> Nearby
                </button>
              </div>
            </div>
            <div role="tabpanel" className="min-h-0 overflow-auto px-4 py-4">
              {tab === "search" ? <SearchBar /> : <NearbyStops location={location} onLocation={setLocation} />}
            </div>
            <MapLegend routes={(routes.data ?? []).map((r) => ({ id: r.id, name: r.name }))} />
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Route colours and the crowd dot meaning, so identity is never colour-alone. */
function MapLegend({ routes }: { routes: { id: number; name: string }[] }) {
  return (
    <details className="group border-t border-slate-200/80 px-4 py-3 text-xs dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
        <Info className="h-3.5 w-3.5" aria-hidden /> Map legend
        <ChevronDown className="ml-auto h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="mt-2 space-y-1.5">
        {routes.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full" style={{ background: routeColor(r.id) }} aria-hidden /> {r.name}
          </li>
        ))}
        {(["LOW", "MEDIUM", "HIGH"] as const).map((l) => (
          <li key={l} className="flex items-center gap-2">
            <span className="ml-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ background: crowdStyle[l].dot }} aria-hidden />
            <span className="ml-1.5">Bus dot: {crowdStyle[l].label} crowd</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
