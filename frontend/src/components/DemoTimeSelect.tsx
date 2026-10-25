import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
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
    <label className={`flex h-10 items-center gap-1.5 rounded-xl border pl-2.5 pr-1 text-xs font-medium transition ${value
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
      : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
      title="Make the AI predictions behave as if it were another time of day">
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden xl:inline">Demo time</span>
      <select aria-label="Demo time override" className="w-[6.5rem] cursor-pointer truncate bg-transparent py-1 pr-1 text-xs font-medium focus:outline-none sm:w-auto"
        value={value} onChange={(e) => change(e.target.value)}>
        {DEMO_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    </label>
  );
}
