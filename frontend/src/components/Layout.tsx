import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { NotificationBell, Toasts } from "./NotificationBell";
import SosButton from "./SosButton";
import DemoTimeSelect from "./DemoTimeSelect";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm ${isActive ? "bg-brand-600 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700"}`;

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[4000] focus:rounded focus:bg-white focus:p-2 focus:text-black">
        Skip to content
      </a>
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <NavLink to="/" className="mr-2 flex items-center gap-1 font-semibold">
            <span aria-hidden>🚌</span> CatchMyBus
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkClass}>Map</NavLink>
            <NavLink to="/favourites" className={linkClass}>Favourites</NavLink>
            <NavLink to="/trips" className={linkClass}>Trips</NavLink>
            {user?.role === "ADMIN" && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <DemoTimeSelect />
            {user?.role === "COMMUTER" && <SosButton />}
            <NotificationBell />
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.name} · {user?.role}</span>
            <button className="btn-ghost" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Toasts />
    </div>
  );
}
