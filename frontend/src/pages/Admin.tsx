import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Page } from "../lib/types";
import CrudTable from "../admin/CrudTable";
import Analytics from "../admin/Analytics";
import { AnnouncementsPanel, AuditLogPanel, RouteStopsPanel, SimDelayPanel, SosFeedPanel } from "../admin/Panels";

type Named = { id: number; name?: string; bus_number?: string };

const useOptions = (path: string) =>
  useQuery({
    queryKey: ["admin", path, "options"],
    queryFn: () => api<Page<Named>>(`/admin/${path}?size=200`),
    select: (p) => p.items.map((x) => ({ value: x.id, label: x.name ?? x.bus_number ?? String(x.id) })),
  });

const TABS = ["Live ops", "Analytics", "Fleet", "Network", "Schedules", "Audit log"] as const;
type Tab = (typeof TABS)[number];

/** Admin console (FR29-31): CRUD, announcements, SOS feed, delay simulation, audit log. */
export default function Admin() {
  const [tab, setTab] = useState<Tab>("Live ops");
  const drivers = useOptions("drivers").data ?? [];
  const routes = useOptions("routes").data ?? [];
  const stops = useOptions("stops").data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Admin console</h1>
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={tab === t ? "btn-primary" : "btn-ghost"}>{t}</button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab}>
        {tab === "Live ops" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SosFeedPanel />
            <div className="space-y-4">
              <SimDelayPanel />
              <AnnouncementsPanel routes={routes} />
            </div>
          </div>
        )}
        {tab === "Analytics" && <Analytics />}
        {tab === "Fleet" && (
          <div className="space-y-4">
            <CrudTable path="buses" title="Buses" defaults={{ capacity: 50, status: "ACTIVE" }} fields={[
              { key: "bus_number", label: "Number" },
              { key: "capacity", label: "Capacity", type: "number" },
              { key: "driver_id", label: "Driver", type: "select", options: drivers, optional: true },
              { key: "route_id", label: "Route", type: "select", options: routes, optional: true },
              { key: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE", "MAINTENANCE"].map((s) => ({ value: s, label: s })) },
            ]} />
            <CrudTable path="drivers" title="Drivers" defaults={{}} fields={[
              { key: "name", label: "Name" },
              { key: "phone", label: "Phone", optional: true },
              { key: "license_no", label: "Licence no." },
            ]} />
          </div>
        )}
        {tab === "Network" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <CrudTable path="routes" title="Routes" defaults={{ active: true }} fields={[
                { key: "name", label: "Name" },
                { key: "source", label: "Source" },
                { key: "destination", label: "Destination" },
                { key: "active", label: "Active", type: "checkbox" },
              ]} />
              <RouteStopsPanel routes={routes} stops={stops} />
            </div>
            <CrudTable path="stops" title="Stops" defaults={{}} fields={[
              { key: "name", label: "Name" },
              { key: "lat", label: "Lat", type: "number" },
              { key: "lon", label: "Lon", type: "number" },
            ]} />
          </div>
        )}
        {tab === "Schedules" && (
          <CrudTable path="schedules" title="Schedules" defaults={{ day_of_week: 0 }} fields={[
            { key: "route_id", label: "Route", type: "select", options: routes },
            { key: "stop_id", label: "Stop", type: "select", options: stops },
            { key: "arrival_time", label: "Arrives", type: "time" },
            { key: "departure_time", label: "Departs", type: "time" },
            { key: "day_of_week", label: "Day", type: "select",
              options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ value: i, label: d })) },
          ]} />
        )}
        {tab === "Audit log" && <AuditLogPanel />}
      </div>
    </div>
  );
}
