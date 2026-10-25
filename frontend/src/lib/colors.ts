import type { CrowdLevel } from "./types";

// Categorical slots from the validated reference palette, in fixed order (blue, orange, aqua, ...).
// A route keeps its colour everywhere: map polyline, markers and analytics charts.
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

const prefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/** Route identity colour (map tiles are always light, so the map passes dark=false). */
export const routeColor = (routeId: number, dark = false) =>
  (dark ? SERIES_DARK : SERIES_LIGHT)[(routeId - 1) % SERIES_LIGHT.length];

export const chartRouteColor = (routeId: number) => routeColor(routeId, prefersDark());

/** Crowd badge colours: green / amber / red, always shown with the word for accessibility. */
export const crowdStyle: Record<CrowdLevel, { bg: string; dot: string; label: string }> = {
  LOW: { bg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200", dot: "#16a34a", label: "Low" },
  MEDIUM: { bg: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200", dot: "#d97706", label: "Medium" },
  HIGH: { bg: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200", dot: "#dc2626", label: "High" },
};

/** Chart chrome that must follow light/dark: grid, axis text, single-series fill. */
export const chartTheme = () =>
  prefersDark()
    ? { grid: "#3a3a38", axis: "#c3c2b7", series1: SERIES_DARK[0], surface: "#1e293b" }
    : { grid: "#e5e7eb", axis: "#52514e", series1: SERIES_LIGHT[0], surface: "#ffffff" };
