import { useAuth } from "../lib/auth";

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">The live map arrives in Phase 2.</p>
    </div>
  );
}
