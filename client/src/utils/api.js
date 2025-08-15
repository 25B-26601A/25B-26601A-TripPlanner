const API_BASE = ""; // CRA proxy handles /api/* to http://localhost:5050
const TOKEN_KEY = "tp_token";

let token = localStorage.getItem(TOKEN_KEY) || "";

export function setToken(t) {
  token = t || "";
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, { method = "GET", headers = {}, body, auth = true } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (auth && token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (isJson && (data?.message || data?.error)) || res.statusText || `Request failed with ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  ping: () => apiFetch("/api/ping", { auth: false }),
  auth: {
    register: (payload) => apiFetch("/api/auth/register", { method: "POST", body: payload, auth: false }),
    login: async (payload) => {
      const resp = await apiFetch("/api/auth/login", { method: "POST", body: payload, auth: false });
      if (resp?.token) setToken(resp.token);
      return resp;
    },
    me: () => apiFetch("/api/auth/me"),
    logout: () => { setToken(""); return Promise.resolve(); },
  },
  trips: {
    list: () => apiFetch("/api/trips"),
    create: (payload, idemKey) =>
      apiFetch("/api/trips", {
        method: "POST",
        body: payload,
        headers: idemKey ? { "Idempotency-Key": idemKey } : undefined,
      }),
    get: (id) => apiFetch(`/api/trips/${id}`),
    patch: (id, payload) => apiFetch(`/api/trips/${id}`, { method: "PATCH", body: payload }),
    remove: (id) => apiFetch(`/api/trips/${id}`, { method: "DELETE" }),
    ai: (payload) =>
      apiFetch("/api/trips/ai", { method: "POST", body: payload, auth: false }),
  },
  route: {
    compute: (payload) => apiFetch("/api/route", { method: "POST", body: payload }),
  },
  images: {
    pick: (query) => apiFetch(`/api/images?query=${encodeURIComponent(query)}`, { auth: false }),
  },
};
