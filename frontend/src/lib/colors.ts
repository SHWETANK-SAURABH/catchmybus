import type { CrowdLevel } from "./types";

const ROUTE_COLORS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed"];

export const routeColor = (routeId: number) => ROUTE_COLORS[(routeId - 1) % ROUTE_COLORS.length];

/** Crowd badge colours: green / amber / red (text paired with colour for accessibility). */
export const crowdStyle: Record<CrowdLevel, { bg: string; dot: string; label: string }> = {
  LOW: { bg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200", dot: "#16a34a", label: "Low" },
  MEDIUM: { bg: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200", dot: "#d97706", label: "Medium" },
  HIGH: { bg: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200", dot: "#dc2626", label: "High" },
};
