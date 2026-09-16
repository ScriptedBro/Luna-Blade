/**
 * API base + fetch helpers.
 * In dev the SPA and API share an origin via the Vite `/api` proxy.
 */
export const API_URL = import.meta.env.VITE_API_URL || "";

export function apiUrl(path) {
  return `${API_URL}${path}`;
}

export async function apiFetch(path, opts = {}) {
  const { token, ...rest } = opts;
  const headers = {
    "Content-Type": "application/json",
    ...(rest.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { ...rest, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(String(body.error || "api_error"));
    err.status = res.status;
    throw err;
  }
  return res.json();
}