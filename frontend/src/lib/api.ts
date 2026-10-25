// Small fetch wrapper: adds the JWT and the optional "demo time" header to every call.

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL = API_URL.replace(/^http/, "ws");

const TOKEN_KEY = "cmb_token";
const DEMO_TIME_KEY = "cmb_demo_time";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) - ignore */
  }
}

export const tokenStore = {
  get: () => safeGet(TOKEN_KEY),
  set: (t: string | null) => safeSet(TOKEN_KEY, t),
};

/** "HH:MM" override used by the AI endpoints so the demo can show 08:30 vs 14:00. */
export const demoTimeStore = {
  get: () => safeGet(DEMO_TIME_KEY),
  set: (t: string | null) => safeSet(DEMO_TIME_KEY, t),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const demo = demoTimeStore.get();
  if (demo) headers.set("X-Demo-Time", demo);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
