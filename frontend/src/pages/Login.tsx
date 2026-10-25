import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/types";

interface Shortcuts {
  enabled: boolean; // demo accounts (DEMO_LOGIN_ENABLED)
  guest: boolean; // "Skip sign-in" (GUEST_LOGIN_ENABLED)
}

/** One form for commuters and admins; the role comes back from the server (FR02, FR28). */
export default function Login() {
  const { login, demoLogin, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running

  // The server says which shortcuts are switched on.
  const shortcuts = useQuery({ queryKey: ["demo-login"], queryFn: () => api<Shortcuts>("/auth/demo"), retry: false });

  async function signIn(action: string, attempt: () => Promise<User>) {
    setBusy(action);
    setError(null);
    try {
      const user = await attempt();
      navigate(user.role === "ADMIN" ? "/admin" : "/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn("password", () => login(email, password));
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to track your buses and get alerts.">
      {shortcuts.isError && (
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Can't reach the CatchMyBus server at <code>{API_URL}</code>. Start the backend
          (<code>uvicorn app.main:app --port 8000</code> in <code>backend/</code>) and reload.
        </p>
      )}

      {shortcuts.data?.guest && (
        <>
          <button type="button" disabled={!!busy} onClick={() => signIn("guest", guestLogin)}
            className="group flex w-full items-center gap-3 rounded-xl border-2 border-brand-500 bg-brand-50 p-4 text-left transition hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 dark:bg-brand-700/20 dark:hover:bg-brand-700/30">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg text-white" aria-hidden>🚀</span>
            <span className="flex-1">
              <span className="block font-semibold text-brand-700 dark:text-brand-100">
                {busy === "guest" ? "Starting…" : "Skip sign-in"}
              </span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">
                Explore the live map as a guest. No account needed.
              </span>
            </span>
            <span className="text-xl text-brand-600 transition group-hover:translate-x-1 dark:text-brand-100" aria-hidden>→</span>
          </button>
          <Divider label="or sign in" />
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4" aria-label="Login form">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input"
            placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
              className="input pr-16" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={!!busy}>
          {busy === "password" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {shortcuts.data?.enabled && (
        <section aria-labelledby="demo-h" className="mt-6">
          <h2 id="demo-h" className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Or try a demo account
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <DemoButton icon="🧑" label="Commuter" hint="Arun" busy={busy === "COMMUTER"} disabled={!!busy}
              onClick={() => signIn("COMMUTER", () => demoLogin("COMMUTER"))} />
            <DemoButton icon="🛠️" label="Admin" hint="Control room" busy={busy === "ADMIN"} disabled={!!busy}
              onClick={() => signIn("ADMIN", () => demoLogin("ADMIN"))} />
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        New here? <Link to="/register" className="font-medium text-brand-600 underline dark:text-brand-100">Create an account</Link>
      </p>
    </AuthCard>
  );
}

function DemoButton({ icon, label, hint, busy, disabled, onClick }: {
  icon: string; label: string; hint: string; busy: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm transition hover:border-brand-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700">
      <span aria-hidden className="text-lg">{icon}</span>
      <span>
        <span className="block font-medium">{busy ? "Signing in…" : `Demo ${label.toLowerCase()}`}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400" role="separator">
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      {label}
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

const FEATURES = [
  { icon: "📍", title: "Live bus tracking", text: "Watch every bus move on the map, updated every 2 seconds." },
  { icon: "⏱️", title: "ETAs you can trust", text: "Arrival times that count down, with delay alerts." },
  { icon: "👥", title: "Crowd predictions", text: "Know how full the bus is before it arrives." },
];

/** Shared layout for the sign-in and register pages: brand panel + form panel. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section aria-hidden className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <RouteArt />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <span className="text-2xl">🚌</span> CatchMyBus
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Catch your bus,<br />not a long wait.</h2>
          <p className="mt-3 text-brand-100">Live tracking and smart travel help for buses around Vellore.</p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-lg">{f.icon}</span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-sm text-brand-100">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-100/80">Katpadi · VIT · Gandhi Nagar · Vellore CMC</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 text-lg font-semibold lg:hidden">
            <span className="text-2xl" aria-hidden>🚌</span> CatchMyBus
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  );
}

/** Decorative bus-route lines with stops for the brand panel. */
function RouteArt() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
      <path d="M-20 620 C 120 560, 160 420, 300 400 S 520 260, 640 120" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 18" />
      <path d="M-20 300 C 140 330, 220 520, 360 560 S 560 640, 640 700" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
      {[[300, 400], [470, 250], [130, 560], [360, 560], [540, 650]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="none" stroke="white" strokeWidth="3" />
      ))}
    </svg>
  );
}
