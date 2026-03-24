import { useEffect, useState } from "react";
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

/** Exchange Shopify HMAC query params for an admin JWT. */
async function exchangeHmacForToken(): Promise<void> {
  const key = tokenKey();

  // Check sessionStorage first (per-shop isolation)
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

  // Clear any tokens from other shops (privacy isolation)
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith("cod_admin_token_") && k !== key) {
      sessionStorage.removeItem(k);
    }
  }

  // Exchange HMAC query params for JWT
  const params = new URLSearchParams(window.location.search);
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
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { url: "/admin/", label: "Dashboard", icon: HomeIcon },
    { url: "/admin/config", label: "Config", icon: SettingsIcon },
    { url: "/admin/orders", label: "Orders", icon: OrderIcon },
    { url: "/admin/blacklists", label: "Blacklists", icon: ShieldCheckMarkIcon },
    { url: "/admin/settings", label: "Settings", icon: AdjustIcon },
  ];

  return (
    <Frame
      navigation={
        <Navigation location={location.pathname}>
          <Navigation.Section
            items={navItems.map((item) => ({
              ...item,
              selected: location.pathname === item.url,
              onClick: () => navigate(item.url),
            }))}
          />
        </Navigation>
      }
    >
      <StoreProvider>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="config" element={<Config />} />
          <Route path="orders" element={<Orders />} />
          <Route path="blacklists" element={<Blacklists />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </StoreProvider>
    </Frame>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    exchangeHmacForToken()
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
        <BrowserRouter basename="/admin">
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </AppProvider>
  );
}
