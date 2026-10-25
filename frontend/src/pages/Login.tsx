import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/types";

/** One form for commuters and admins; the role comes back from the server (FR02, FR28). */
export default function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The server says whether one-click demo sign-in is switched on (DEMO_LOGIN_ENABLED).
  const demo = useQuery({ queryKey: ["demo-login"], queryFn: () => api<{ enabled: boolean }>("/auth/demo"), retry: false });

  async function signIn(attempt: () => Promise<User>) {
    setBusy(true);
    setError(null);
    try {
      const user = await attempt();
      navigate(user.role === "ADMIN" ? "/admin" : "/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn(() => login(email, password));
  };

  return (
    <AuthCard title="Sign in to CatchMyBus">
      <form onSubmit={onSubmit} className="space-y-4" aria-label="Login form">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {demo.isError && (
        <p role="alert" className="mt-4 rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Can't reach the CatchMyBus server at <code>{API_URL}</code>. Start the backend
          (<code>uvicorn app.main:app --port 8000</code> in <code>backend/</code>) and reload.
        </p>
      )}
      {demo.data?.enabled && (
        <section aria-labelledby="demo-h" className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h2 id="demo-h" className="mb-2 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            Just looking? Try the demo
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => signIn(() => demoLogin("COMMUTER"))}>
              🧑 Demo commuter
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => signIn(() => demoLogin("ADMIN"))}>
              🛠️ Demo admin
            </button>
          </div>
        </section>
      )}
      <p className="mt-4 text-center text-sm">
        New here? <Link to="/register" className="font-medium text-brand-600 underline dark:text-brand-100">Create an account</Link>
      </p>
    </AuthCard>
  );
}

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl" aria-hidden>🚌</div>
          <h1 className="mt-2 text-xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Live buses around Vellore</p>
        </div>
        {children}
      </div>
    </main>
  );
}
