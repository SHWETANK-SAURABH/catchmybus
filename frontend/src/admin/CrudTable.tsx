import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, del, post, put } from "../lib/api";
import type { Page } from "../lib/types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
import { Pagination } from "../components/ui";

export interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "time" | "checkbox" | "select";
  options?: { value: string | number; label: string }[];
  optional?: boolean;
}

type Row = Record<string, unknown> & { id: number };

/** Generic paginated admin table with create / edit / delete for one /admin/<path> resource. */
export default function CrudTable({ path, title, fields, defaults }: {
  path: string;
  title: string;
  fields: Field[];
  defaults: Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const size = 10;
  const q = useQuery({
    queryKey: ["admin", path, page],
    queryFn: () => api<Page<Row>>(`/admin/${path}?page=${page}&size=${size}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", path] });
    qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
  };

  const save = useMutation({
    mutationFn: (body: { id?: number; data: Record<string, unknown> }) =>
      body.id ? put(`/admin/${path}/${body.id}`, body.data) : post(`/admin/${path}`, body.data),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      refresh();
    },
    onError: (e) => setError((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => del(`/admin/${path}/${id}`),
    onSuccess: refresh,
    onError: (e) => alert((e as Error).message),
  });

  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / size)) : 1;
  const show = (f: Field, v: unknown) =>
    f.type === "select" ? f.options?.find((o) => String(o.value) === String(v))?.label ?? (v ?? "—")
      : f.type === "checkbox" ? (v ? "Yes" : "No") : (v ?? "—");

  return (
    <section className="card" aria-labelledby={`${path}-h`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={`${path}-h`} className="card-title">
          {title}
          {q.data && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{q.data.total}</span>}
        </h2>
        <button className="btn-primary" onClick={() => { setError(null); setEditing("new"); }}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              {fields.map((f) => <th scope="col" key={f.key}>{f.label}</th>)}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="tabular-nums text-slate-400">{row.id}</td>
                {fields.map((f) => <td key={f.key}>{String(show(f, row[f.key]))}</td>)}
                <td className="whitespace-nowrap text-right">
                  <button className="icon-btn btn-subtle h-8 w-8" aria-label={`Edit ${title.toLowerCase()} ${row.id}`}
                    onClick={() => { setError(null); setEditing(row); }}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button className="icon-btn btn-subtle h-8 w-8 hover:text-red-600 dark:hover:text-red-400" aria-label={`Delete ${title.toLowerCase()} ${row.id}`}
                    onClick={() => confirm(`Delete ${title.toLowerCase()} #${row.id}?`) && remove.mutate(row.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && <Pagination page={page} pages={pages} onPage={setPage} />}

      {editing && (
        <EditModal title={`${editing === "new" ? "Add" : "Edit"} ${title.replace(/s$/, "")}`} fields={fields}
          initial={editing === "new" ? defaults : editing} error={error} busy={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => save.mutate({ id: editing === "new" ? undefined : editing.id, data })} />
      )}
    </section>
  );
}

function EditModal({ title, fields, initial, onSave, onClose, error, busy }: {
  title: string; fields: Field[]; initial: Record<string, unknown>; error: string | null; busy: boolean;
  onSave: (d: Record<string, unknown>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(
    Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? (f.type === "checkbox" ? false : "")])),
  );
  const submit = () => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      let v = form[f.key];
      if (v === "" && f.optional) v = null;
      else if ((f.type === "number" || (f.type === "select" && typeof f.options?.[0]?.value === "number")) && v !== null) v = Number(v);
      data[f.key] = v;
    }
    onSave(data);
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {fields.map((f) => {
          const id = `f-${f.key}`;
          const val = form[f.key];
          const set = (v: unknown) => setForm({ ...form, [f.key]: v });
          if (f.type === "checkbox") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!val} onChange={(e) => set(e.target.checked)} /> {f.label}
              </label>
            );
          }
          return (
            <div key={f.key}>
              <label htmlFor={id} className="label">{f.label}{f.optional ? " (optional)" : ""}</label>
              {f.type === "select" ? (
                <select id={id} className="input" value={String(val ?? "")} onChange={(e) => set(e.target.value)} required={!f.optional}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input id={id} className="input" type={f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
                  step={f.type === "number" ? "any" : f.type === "time" ? 1 : undefined}
                  value={String(val ?? "")} onChange={(e) => set(e.target.value)} required={!f.optional} />
              )}
            </div>
          );
        })}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
