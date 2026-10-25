import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

  return (
    <form onSubmit={submit} aria-label="Route search" className="space-y-2">
      <h2 className="font-semibold">Where to?</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="src" className="label">From</label>
          <select id="src" className="input" value={source} onChange={(e) => setSource(e.target.value)} required>
            <option value="">Select stop</option>
            {stops.data?.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dst" className="label">To</label>
          <select id="dst" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} required>
            <option value="">Select stop</option>
            {stops.data?.filter((s) => s.name !== source).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={!source || !destination}>Search routes</button>
    </form>
  );
}
