/**
 * API client for COD admin panel.
 * Uses Shopify App Bridge session tokens for authentication.
 */

let sessionTokenGetter: (() => Promise<string>) | null = null;

/** Set the session token getter (called from App.tsx after App Bridge init). */
export function setSessionTokenGetter(getter: () => Promise<string>): void {
  sessionTokenGetter = getter;
}

/** Fetch wrapper that adds session token to all requests. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (sessionTokenGetter) {
    const token = await sessionTokenGetter();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Download a file (CSV export). Opens in new tab or triggers download. */
export async function apiDownload(path: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (sessionTokenGetter) {
    const token = await sessionTokenGetter();
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`/api/admin${path}`, { headers });
  if (!res.ok) throw new Error(`Download error: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
    "export.csv";
  a.click();
  URL.revokeObjectURL(url);
}
