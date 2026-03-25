import { Text } from "@shopify/polaris";
import { useStore } from "../context/StoreContext";

/**
 * Shows the current store name as a static badge.
 * Each merchant only sees their own store (privacy isolation).
 */
export function OwnerStoreSelector() {
  const { storeName } = useStore();

  return (
    <Text as="p" variant="bodySm" tone="subdued">
      {storeName}
    </Text>
  );
}

export const StoreSelector = OwnerStoreSelector;
