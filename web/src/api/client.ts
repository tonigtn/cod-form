/**
 * API client for COD admin panel.
 * Uses Shopify App Bridge session tokens for authentication.
 */

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config?: Record<string, unknown>;
    };
  }
}

/** Get a fresh session token from Shopify App Bridge. */
async function getSessionToken(): Promise<string> {
  // Try App Bridge first (embedded mode)
  if (window.shopify?.idToken) {
    return window.shopify.idToken();
  }

  // Fallback: cached token from sessionStorage (full-page mode)
  const shop = sessionStorage.getItem("cod_shop") || "default";
  const key = `cod_admin_token_${shop}`;
  return sessionStorage.getItem(key) || "";
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

  const token = await getSessionToken();
  if (token) {
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

/** Download a file (CSV export). */
export async function apiDownload(path: string): Promise<void> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
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

// Legacy export for backwards compatibility (no longer used by App.tsx)
export function setSessionTokenGetter(_getter: () => Promise<string>): void {
  // No-op — App Bridge handles tokens now
}
