import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { AppProvider, Frame, Navigation } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import {
  HomeIcon,
  SettingsIcon,
  OrderIcon,
  ShieldCheckMarkIcon,
  AdjustIcon,
} from "@shopify/polaris-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setSessionTokenGetter } from "./api/client";
import { StoreProvider } from "./context/StoreContext";
import { Dashboard } from "./pages/Dashboard";
import { Config } from "./pages/Config";
import { Orders } from "./pages/Orders";
import { Blacklists } from "./pages/Blacklists";
import { Settings } from "./pages/Settings";

/** Get the shop domain — persisted from initial Shopify load. */
function getShop(): string {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop");
  if (shop) {
    sessionStorage.setItem("cod_shop", shop);
    return shop;
  }
  return sessionStorage.getItem("cod_shop") || "default";
}

/** Per-shop session storage key to isolate tokens between apps. */
function tokenKey(): string {
  return `cod_admin_token_${getShop()}`;
}

/** Initialize auth — try id_token (App Bridge), then HMAC exchange, then cached token. */
async function initAuth(): Promise<void> {
  const key = tokenKey();
  const params = new URLSearchParams(window.location.search);

  // 1. Try Shopify App Bridge id_token (embedded mode)
  const idToken = params.get("id_token");
  if (idToken) {
    sessionStorage.setItem(key, idToken);
    setSessionTokenGetter(() => Promise.resolve(idToken));
    return;
  }

  // 2. Check sessionStorage for a valid cached token
  const stored = sessionStorage.getItem(key);
  if (stored) {
    try {
      const payload = JSON.parse(atob(stored.split(".")[1]!));
      if (payload.exp && payload.exp > Date.now() / 1000) {
        setSessionTokenGetter(() => Promise.resolve(stored));
        return;
      }
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  // 3. Clear tokens from other shops (privacy isolation)
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith("cod_admin_token_") && k !== key) {
      sessionStorage.removeItem(k);
    }
  }

  // 4. Fallback: exchange HMAC query params for JWT (full-page mode)
  if (!params.get("hmac")) return;

  const body: Record<string, string> = {};
  params.forEach((v, k) => { body[k] = v; });

  const res = await fetch("/api/admin/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data: { token: string } = await res.json();
    sessionStorage.setItem(key, data.token);
    setSessionTokenGetter(() => Promise.resolve(data.token));
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  return (
    <Frame>
      <ErrorBoundary>
        <StoreProvider>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="config" element={<Config />} />
            <Route path="orders" element={<Orders />} />
            <Route path="blacklists" element={<Blacklists />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </StoreProvider>
      </ErrorBoundary>
    </Frame>
  );
}

class ErrorBoundary extends Component<{children: ReactNode}, {error: string}> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) return (
      <div style={{padding: 40, color: "red"}}>
        <h2>Render Error</h2>
        <pre style={{whiteSpace: "pre-wrap"}}>{this.state.error}</pre>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initAuth()
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div style={{ padding: 40 }}>Loading...</div>;

  if (error) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        <h2>Auth Error</h2>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <AppProvider i18n={enTranslations}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </AppProvider>
  );
}
