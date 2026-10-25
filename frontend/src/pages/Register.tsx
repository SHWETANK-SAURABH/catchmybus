import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AuthCard } from "./Login";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password, form.phone);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Save favourite routes, trip history and alerts.">
      <form onSubmit={onSubmit} className="space-y-4" aria-label="Registration form">
        <div>
          <label htmlFor="name" className="label">Name</label>
          <input id="name" required minLength={2} className="input" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label htmlFor="phone" className="label">Phone (optional)</label>
          <input id="phone" type="tel" className="input" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password (min 6 characters)</label>
          <input id="password" type="password" required minLength={6} className="input"
            value={form.password} onChange={set("password")} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Already registered? <Link to="/login" className="font-medium text-brand-600 underline dark:text-brand-100">Sign in</Link>
      </p>
    </AuthCard>
  );
}
