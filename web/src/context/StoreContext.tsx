import { createContext, useContext, useState, type ReactNode } from "react";
import { useCurrentStore } from "../api/hooks";

interface StoreContextValue {
  shop: string;
  storeName: string;
  currency: string;
  allStores: { shop_domain: string; store_name: string }[];
  setShop: (shop: string) => void;
  /** @deprecated Use shop instead */
  storeId: string;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useCurrentStore();
  const [overrideShop, setOverrideShop] = useState("");

  if (isLoading) return <div style={{ padding: 40 }}>Loading store...</div>;
  if (error || !data) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        Failed to load store identity: {String(error)}
      </div>
    );
  }

  const activeShop = overrideShop || data.shop;
  const activeName =
    overrideShop && data.all_stores
      ? data.all_stores.find((s) => s.shop_domain === overrideShop)?.store_name ?? data.store_name
      : data.store_name;

  return (
    <StoreContext.Provider
      value={{
        shop: activeShop,
        storeName: activeName,
        currency: data.currency,
        allStores: data.all_stores ?? [],
        setShop: setOverrideShop,
        storeId: activeShop,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
