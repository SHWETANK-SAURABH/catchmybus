import { useState } from "react";
import { CircleCheck, Siren } from "lucide-react";
import { post } from "../lib/api";
import { useBusMeta } from "../lib/queries";
import Modal from "./Modal";
import { DEMO_LOCATION } from "./NearbyStops";

type State = "idle" | "confirm" | "sending" | "sent" | "error";

/** SOS (FR25): confirm, attach location (+ optional bus), send, then show a success state. */
export default function SosButton() {
  const [state, setState] = useState<State>("idle");
  const [busId, setBusId] = useState<number | "">("");
  const [error, setError] = useState("");
  const buses = useBusMeta().data ?? [];

  const send = () => {
    setState("sending");
    const submit = (lat: number, lon: number) =>
      post("/sos", { bus_id: busId || null, lat, lon })
        .then(() => setState("sent"))
        .catch((e) => { setError((e as Error).message); setState("error"); });
    // In an emergency we try the real location, but never block on it.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => submit(p.coords.latitude, p.coords.longitude),
        () => submit(...DEMO_LOCATION),
        { timeout: 5000 },
      );
    } else submit(...DEMO_LOCATION);
  };

  return (
    <>
      <button className="btn-danger h-10 px-3" onClick={() => setState("confirm")} aria-haspopup="dialog" aria-label="Send SOS alert">
        <Siren className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">SOS</span>
      </button>
      {state !== "idle" && (
        <Modal title={state === "sent" ? "Help is on the way" : "Send an SOS alert?"} onClose={() => setState("idle")}>
          {state === "sent" ? (
            <>
              <div className="flex gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-900/30 dark:text-green-100">
                <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />
                The control room has your alert and location. Stay where you are if it is safe.
              </div>
              <div className="mt-4 text-right"><button className="btn-primary" onClick={() => setState("idle")}>Close</button></div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This alerts the CatchMyBus control room immediately and shares your current location with them.
              </p>
              <div>
                <label htmlFor="sos-bus" className="label">I'm on bus (optional)</label>
                <select id="sos-bus" className="input" value={busId} onChange={(e) => setBusId(Number(e.target.value) || "")}>
                  <option value="">Not on a bus</option>
                  {buses.map((b) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
                </select>
              </div>
              {state === "error" && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setState("idle")}>Cancel</button>
                <button className="btn-danger" onClick={send} disabled={state === "sending"}>
                  {state === "sending" ? "Sending…" : "Send SOS"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
