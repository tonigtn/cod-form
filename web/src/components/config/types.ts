import type { StoreConfig } from "../../api/types";
import type { StoreLocale } from "../../api/hooks";

export interface TabProps {
  draft: StoreConfig;
  setDraft: (fn: (d: StoreConfig) => StoreConfig) => void;
  save: (section: string, data: Record<string, unknown>) => void;
  storeId: string;
  locale?: StoreLocale;
}
