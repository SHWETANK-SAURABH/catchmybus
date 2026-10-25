import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, type LucideIcon } from "lucide-react";

/** Title + optional subtitle and actions at the top of a page. */
export function PageHeader({ title, subtitle, icon: Icon, actions }: {
  title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      {Icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Friendly placeholder for lists with nothing in them yet. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children && <div className="mt-1 max-w-sm muted">{children}</div>}
    </div>
  );
}

/** Small labelled number, e.g. speed or load. */
export function StatTile({ icon: Icon, label, value, tone = "default" }: {
  icon?: LucideIcon; label: string; value: ReactNode; tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />} {label}
      </dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums ${tone === "warn" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Green confirmation box used after a successful action in a dialog. */
export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-900/30 dark:text-green-100" role="status">
      <CircleCheck className="h-5 w-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Prev / "Page x of y" / Next controls for paginated lists. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-sm">
      <button className="btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
      </button>
      <span className="muted tabular-nums">Page {page} of {pages}</span>
      <button className="btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

/** Standard content width + padding for non-map pages. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-4xl"} px-4 py-6 sm:px-6 lg:py-8`}>{children}</div>;
}
