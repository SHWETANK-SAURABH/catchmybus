import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bus, LogOut, Map, Ticket, ShieldCheck, Star, UserPlus, type LucideIcon } from "lucide-react";
import { isGuest, useAuth } from "../lib/auth";
import type { User } from "../lib/types";
import { NotificationBell, Toasts } from "./NotificationBell";
import SosButton from "./SosButton";
import DemoTimeSelect from "./DemoTimeSelect";

/** Height left for a full-bleed page (the map) under the top bar and above the phone tab bar. */
export const FULL_HEIGHT = "h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-4rem)]";

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; adminOnly?: boolean }

const NAV: NavItem[] = [
  { to: "/", label: "Live map", icon: Map, end: true },
  { to: "/favourites", label: "Favourites", icon: Star },
  { to: "/trips", label: "Trips", icon: Ticket },
  { to: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Live map"], [/^\/search/, "Route search"], [/^\/bus\//, "Bus details"],
  [/^\/routes\//, "Route details"], [/^\/favourites/, "Favourites"], [/^\/trips/, "Trip history"],
  [/^\/admin/, "Admin console"],
];

/**
 * App shell: sidebar on desktop, compact top bar + bottom tab bar on phones.
 * Demo time, SOS and notifications stay in the top bar on every screen size.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const items = NAV.filter((n) => !n.adminOnly || user?.role === "ADMIN");
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "CatchMyBus";

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[4000] focus:rounded-lg focus:bg-white focus:p-2 focus:text-black">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Brand />
        <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}`}>
              <n.icon className="h-5 w-5" aria-hidden /> {n.label}
            </NavLink>
          ))}
        </nav>
        {user && <UserCard user={user} />}
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-[1000] flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-4 lg:h-16 lg:px-6">
        <div className="lg:hidden"><Brand compact /></div>
        <h1 className="hidden text-lg font-semibold text-slate-900 dark:text-white lg:block">{title}</h1>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <DemoTimeSelect />
          {user?.role === "COMMUTER" && <SosButton />}
          <NotificationBell />
          {user && <div className="lg:hidden"><UserMenu user={user} /></div>}
        </div>
      </header>

      <main id="main" className="pb-16 lg:pb-0">{children}</main>

      {/* Phone tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[1000] flex h-16 border-t border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive
                ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`}>
            <n.icon className="h-5 w-5" aria-hidden /> {n.label.replace("Live map", "Map")}
          </NavLink>
        ))}
      </nav>

      <Toasts />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/" className={`flex items-center gap-2.5 font-semibold text-slate-900 dark:text-white ${compact ? "" : "h-16 border-b border-slate-200/80 px-5 dark:border-slate-800"}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-700 text-white shadow-sm">
        <Bus className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className={compact ? "hidden text-base sm:inline" : "text-lg"}>CatchMyBus</span>
    </NavLink>
  );
}

function Avatar({ user }: { user: User }) {
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 text-sm font-semibold text-white" aria-hidden>
      {initials}
    </span>
  );
}

function roleLabel(user: User) {
  return isGuest(user) ? "Guest" : user.role === "ADMIN" ? "Administrator" : "Commuter";
}

/** Signed-in user + sign-out at the bottom of the sidebar. */
function UserCard({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const guest = isGuest(user);
  return (
    <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
      {guest && (
        <button className="btn-primary mb-2 w-full" onClick={() => { logout(); navigate("/register"); }}>
          <UserPlus className="h-4 w-4" aria-hidden /> Create account
        </button>
      )}
      <div className="flex items-center gap-3 rounded-xl p-2">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel(user)}</p>
        </div>
        <button className="icon-btn btn-subtle h-9 w-9" onClick={logout} aria-label={guest ? "Exit guest mode" : "Sign out"} title={guest ? "Exit guest" : "Sign out"}>
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Phone-only avatar menu with the same actions as the sidebar card. */
function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const guest = isGuest(user);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Avatar user={user} />
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-56 p-2 shadow-float" role="menu">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabel(user)}</p>
          </div>
          {guest && (
            <button role="menuitem" className="btn-subtle w-full justify-start" onClick={() => { logout(); navigate("/register"); }}>
              <UserPlus className="h-4 w-4" aria-hidden /> Create account
            </button>
          )}
          <button role="menuitem" className="btn-subtle w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden /> {guest ? "Exit guest" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
