import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { demoTimeStore } from "../lib/api";

export const DEMO_PRESETS = [
  { value: "", label: "Real time" },
  { value: "08:30", label: "Weekday 08:30 (peak)" },
  { value: "14:00", label: "Weekday 14:00" },
  { value: "18:00", label: "Weekday 18:00 (peak)" },
  { value: "Sat 12:00", label: "Saturday 12:00" },
];

/** Header control that makes the AI endpoints reason about another time of day. */
export default function DemoTimeSelect() {
  const qc = useQueryClient();
  const [value, setValue] = useState(demoTimeStore.get() ?? "");
  const change = (v: string) => {
    setValue(v);
    demoTimeStore.set(v || null);
    qc.invalidateQueries(); // every AI-backed view refetches with the new header
  };
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="hidden md:inline">Demo time</span>
      <select aria-label="Demo time override" className="input w-auto py-1 text-xs" value={value}
        onChange={(e) => change(e.target.value)}>
        {DEMO_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    </label>
  );
}
