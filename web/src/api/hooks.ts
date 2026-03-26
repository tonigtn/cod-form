import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  AnalyticsData,
  BlacklistResponse,
  CurrentStore,
  OrderStats,
  OrdersResponse,
  StoreConfig,
} from "./types";

// ─── Store Identity ─────────────────────────────────────────────────────────

export function useCurrentStore() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentStore>("/me"),
    staleTime: Infinity,
  });
}

// ─── Config ─────────────────────────────────────────────────────────────────

export function useStoreConfig(shop: string) {
  return useQuery({
    queryKey: ["config", shop],
    queryFn: () => apiFetch<StoreConfig>("/config/current"),
    enabled: !!shop,
  });
}

export interface StoreLocale {
  language: string;
  country_code: string;
  currency: string;
  phone_placeholder: string;
  provinces: string[];
  labels: Record<string, string>;
}

export function useStoreLocale(shop: string) {
  return useQuery({
    queryKey: ["locale", shop],
    queryFn: () => apiFetch<{ locale: StoreLocale }>("/config/locale"),
    enabled: !!shop,
    staleTime: Infinity,
  });
}

export function useUpdateConfigSection(_shop: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      section,
      data,
    }: {
      section: string;
      data: Record<string, unknown>;
    }) =>
      apiFetch(`/config/current/${section}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export function useOrders(
  shop: string,
  page: number,
  limit = 20,
  search = "",
  dateFrom = "",
  dateTo = ""
) {
  return useQuery({
    queryKey: ["orders", shop, page, limit, search, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      return apiFetch<OrdersResponse>(`/orders?${params}`);
    },
    enabled: !!shop,
  });
}

export function useOrderStats(shop: string, days = 7) {
  return useQuery({
    queryKey: ["stats", shop, days],
    queryFn: () => apiFetch<OrderStats>(`/orders/stats?days=${days}`),
    enabled: !!shop,
  });
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function useAnalytics(shop: string, days = 7) {
  return useQuery({
    queryKey: ["analytics", shop, days],
    queryFn: () => apiFetch<AnalyticsData>(`/analytics?days=${days}`),
    enabled: !!shop,
  });
}

// ─── Products ───────────────────────────────────────────────────────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  image_url: string;
  price: string;
}

export function useProducts(shop: string, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["products", shop, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return apiFetch<{ products: ShopifyProduct[] }>(`/products?${params}`);
    },
    enabled: !!shop && enabled,
  });
}

// ─── Blacklists ─────────────────────────────────────────────────────────────

export function useBlacklist(type: "phones" | "ips") {
  return useQuery({
    queryKey: ["blacklist", type],
    queryFn: () => apiFetch<BlacklistResponse>(`/blacklist/${type}`),
  });
}

export function useAddToBlacklist(type: "phones" | "ips") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: string) =>
      apiFetch(`/blacklist/${type}`, {
        method: "POST",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blacklist", type] });
    },
  });
}

export function useRemoveFromBlacklist(type: "phones" | "ips") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: string) =>
      apiFetch(`/blacklist/${type}`, {
        method: "DELETE",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blacklist", type] });
    },
  });
}
