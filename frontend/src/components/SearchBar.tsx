import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownUp, CircleDot, MapPin, Search } from "lucide-react";
import { useStops } from "../lib/queries";

/** Source/destination search: pick two stops, press Search (3 taps to results). */
export default function SearchBar() {
  const stops = useStops();
  const navigate = useNavigate();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (source && destination) {
      navigate(`/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`);
    }
  };
  const swap = () => {
    setSource(destination);
    setDestination(source);
  };

  return (
    <form onSubmit={submit} aria-label="Route search" className="space-y-3">
      <div className="relative space-y-2">
        <StopSelect id="src" label="From" icon={<CircleDot className="h-4 w-4 text-brand-600" aria-hidden />}
          value={source} onChange={setSource} options={stops.data?.map((s) => s.name) ?? []} />
        <StopSelect id="dst" label="To" icon={<MapPin className="h-4 w-4 text-red-500" aria-hidden />}
          value={destination} onChange={setDestination}
          options={stops.data?.map((s) => s.name).filter((n) => n !== source) ?? []} />
        <button type="button" onClick={swap} aria-label="Swap from and to"
          className="icon-btn btn-ghost absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-sm">
          <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <button type="submit" className="btn-primary w-full py-2.5" disabled={!source || !destination}>
        <Search className="h-4 w-4" aria-hidden /> Find best route
      </button>
    </form>
  );
}

function StopSelect({ id, label, icon, value, onChange, options }: {
  id: string; label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
      <select id={id} className="input appearance-none pl-9 pr-12" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">{label}: choose a stop</option>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
