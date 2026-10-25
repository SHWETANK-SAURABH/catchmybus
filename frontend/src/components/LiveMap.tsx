import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { BusLocation, RouteDetail, Stop } from "../lib/types";
import { routeColor } from "../lib/colors";

export const VELLORE_CENTER: [number, number] = [12.952, 79.142];

interface Props {
  routes: RouteDetail[];
  buses: BusLocation[];
  highlightRouteId?: number | null;
  highlightBusId?: number | null;
  userLocation?: [number, number] | null;
  onBusClick?: (bus: BusLocation) => void;
  onStopClick?: (stop: Stop) => void;
  busDot?: (bus: BusLocation) => string | undefined; // optional crowd colour
  className?: string;
}

/** OpenStreetMap map with route polylines, stops and smoothly moving bus markers. */
export default function LiveMap(p: Props) {
  return (
    <MapContainer center={VELLORE_CENTER} zoom={14} className={p.className ?? "h-full w-full"}
      zoomControl={false} aria-label="Live bus map">
      <ZoomControl position="topright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {p.routes.map((r) => (
        <Polyline key={r.id} positions={r.polyline} pathOptions={{
          color: routeColor(r.id), weight: p.highlightRouteId === r.id ? 7 : 4,
          opacity: p.highlightRouteId && p.highlightRouteId !== r.id ? 0.35 : 0.85,
        }} />
      ))}
      {uniqueStops(p.routes).map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={6}
          pathOptions={{ color: "#0f172a", fillColor: "#ffffff", fillOpacity: 1, weight: 2 }}
          eventHandlers={{ click: () => p.onStopClick?.(s) }}>
          <Popup><strong>{s.name}</strong></Popup>
        </CircleMarker>
      ))}
      {p.userLocation && (
        <CircleMarker center={p.userLocation} radius={8}
          pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      )}
      {p.buses.map((b) => (
        <BusMarker key={b.bus_id} bus={b} highlighted={p.highlightBusId === b.bus_id}
          dot={p.busDot?.(b)} onClick={p.onBusClick} />
      ))}
      <FollowBus bus={p.buses.find((b) => b.bus_id === p.highlightBusId)} />
    </MapContainer>
  );
}

function uniqueStops(routes: RouteDetail[]): Stop[] {
  const seen = new Map<number, Stop>();
  routes.forEach((r) => r.stops.forEach((s) => seen.set(s.stop.id, s.stop)));
  return [...seen.values()];
}

/** Pans the map to a tracked bus when it is first selected. */
function FollowBus({ bus }: { bus?: BusLocation }) {
  const map = useMap();
  const followed = useRef<number | null>(null);
  useEffect(() => {
    if (bus && followed.current !== bus.bus_id) {
      followed.current = bus.bus_id;
      map.setView([bus.lat, bus.lon], Math.max(map.getZoom(), 15));
    }
  }, [bus, map]);
  return null;
}

/**
 * Bus marker created once and then moved with setLatLng, so the CSS transition on
 * `.bus-marker` animates it smoothly between 2-second updates. The arrow rotates to
 * the bus heading.
 */
function BusMarker({ bus, highlighted, dot, onClick }: {
  bus: BusLocation; highlighted: boolean; dot?: string; onClick?: (b: BusLocation) => void;
}) {
  const map = useMap();
  const marker = useRef<L.Marker | null>(null);
  const latest = useRef(bus);
  latest.current = bus;

  useEffect(() => {
    const color = routeColor(bus.route_id);
    const icon = L.divIcon({
      className: "bus-marker",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `
        <div class="bus-arrow" style="width:34px;height:34px;transform:rotate(${bus.heading}deg)">
          <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
            <circle cx="17" cy="17" r="13" fill="${color}" stroke="white" stroke-width="3"/>
            <path d="M17 6 L23 19 L17 16 L11 19 Z" fill="white"/>
          </svg>
        </div>
        <span class="bus-dot" style="position:absolute;right:-2px;top:-2px;width:12px;height:12px;border-radius:9999px;border:2px solid white;display:none"></span>`,
    });
    const m = L.marker([bus.lat, bus.lon], { icon, title: `Bus ${bus.bus_number}`, keyboard: true, zIndexOffset: 500 });
    m.on("click", () => onClick?.(latest.current));
    m.addTo(map);
    marker.current = m;
    return () => {
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bus.bus_id]);

  useEffect(() => {
    const m = marker.current;
    if (!m) return;
    m.setLatLng([bus.lat, bus.lon]);
    const el = m.getElement();
    const arrow = el?.querySelector<HTMLElement>(".bus-arrow");
    if (arrow) arrow.style.transform = `rotate(${bus.heading}deg)`;
    const d = el?.querySelector<HTMLElement>(".bus-dot");
    if (d) {
      d.style.display = dot ? "block" : "none";
      if (dot) d.style.background = dot;
    }
    if (el) el.style.filter = highlighted ? "drop-shadow(0 0 6px #facc15)" : "";
    m.setZIndexOffset(highlighted ? 1000 : 500);
  }, [bus.lat, bus.lon, bus.heading, dot, highlighted]);

  return null;
}
