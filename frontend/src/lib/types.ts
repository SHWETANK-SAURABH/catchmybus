// Types mirroring the backend Pydantic schemas.

export type Role = "COMMUTER" | "ADMIN";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface Stop {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export interface NearbyStop extends Stop {
  distance_m: number;
}

export interface Route {
  id: number;
  name: string;
  source: string;
  destination: string;
  active: boolean;
}

export interface RouteDetail extends Route {
  stops: { seq: number; stop: Stop; distance_m: number }[];
  polyline: [number, number][];
  length_m: number;
  is_loop: boolean;
}

export interface BusLocation {
  bus_id: number;
  bus_number: string;
  route_id: number;
  lat: number;
  lon: number;
  heading: number;
  speed_kmh: number;
  delay_min: number;
  load: number;
  capacity: number;
  next_stop_id: number | null;
  updated_at: string;
}

export interface Eta {
  bus_id: number;
  stop_id: number;
  eta_minutes: number;
  distance_m: number;
  smoothed_speed_kmh: number;
  predicted_delay_min: number;
  confidence: number;
}

export type CrowdLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Crowd {
  bus_id: number;
  level: CrowdLevel;
  probabilities: Record<string, number>;
  hour: number;
  source: string;
}

export interface Delay {
  bus_id: number;
  stop_id: number | null;
  predicted_delay_min: number;
  injected_delay_min: number;
  total_delay_min: number;
  source: string;
}

export interface RouteOption {
  route_id: number;
  route_name: string;
  bus_id: number | null;
  bus_number: string | null;
  board_stop: Stop;
  alight_stop: Stop;
  walk_m: number;
  eta_minutes: number | null;
  crowd_level: CrowdLevel | null;
  predicted_delay_min: number;
  score: number;
  breakdown: { eta: number; walk: number; crowd: number; delay_risk: number };
}

export interface BestRoute {
  source: string;
  destination: string;
  weights: Record<string, number>;
  options: RouteOption[];
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface Favourite {
  id: number;
  type: "ROUTE" | "STOP";
  route_id: number | null;
  stop_id: number | null;
}

export interface Trip {
  id: number;
  bus_id: number | null;
  route_id: number | null;
  board_stop_id: number | null;
  alight_stop_id: number | null;
  trip_date: string;
  status: string;
}

export interface Sos {
  id: number;
  user_id: number;
  bus_id: number | null;
  lat: number;
  lon: number;
  created_at: string;
  status: string;
}
