import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, del, post } from "./api";
import type { Eta, Favourite, RouteDetail, Stop } from "./types";

export interface BusMeta {
  id: number;
  bus_number: string;
  capacity: number;
  driver_id: number | null;
  route_id: number | null;
  status: string;
}

export const useRouteDetails = () =>
  useQuery({ queryKey: ["routes-detail"], queryFn: () => api<RouteDetail[]>("/routes/all/detail"), staleTime: 60000 });

export const useStops = () =>
  useQuery({ queryKey: ["stops"], queryFn: () => api<Stop[]>("/stops"), staleTime: 60000 });

export const useBusMeta = () =>
  useQuery({ queryKey: ["buses"], queryFn: () => api<BusMeta[]>("/buses"), staleTime: 60000 });

export const useArrivals = (stopId: number | null) =>
  useQuery({
    queryKey: ["arrivals", stopId],
    queryFn: () => api<Eta[]>(`/stops/${stopId}/arrivals`),
    enabled: stopId !== null,
    refetchInterval: 5000,
  });

export function useFavourites() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["favourites"], queryFn: () => api<Favourite[]>("/favourites") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["favourites"] });
  const add = useMutation({
    mutationFn: (f: { type: "ROUTE" | "STOP"; route_id?: number; stop_id?: number }) => post<Favourite>("/favourites", f),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: number) => del(`/favourites/${id}`), onSuccess: refresh });

  const find = (type: "ROUTE" | "STOP", id: number) =>
    list.data?.find((f) => f.type === type && (type === "ROUTE" ? f.route_id : f.stop_id) === id);

  /** Add or remove a favourite in one call (for star buttons). */
  const toggle = (type: "ROUTE" | "STOP", id: number) => {
    const existing = find(type, id);
    if (existing) return remove.mutateAsync(existing.id);
    return add.mutateAsync(type === "ROUTE" ? { type, route_id: id } : { type, stop_id: id });
  };
  return { list, find, toggle, remove };
}
