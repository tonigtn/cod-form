import { Select, Text } from "@shopify/polaris";
import { useStore } from "../context/StoreContext";

/**
 * Store selector for multi-shop setups.
 * Shows a dropdown to switch between installed shops.
 */
export function OwnerStoreSelector() {
  const { shop, storeName, allStores, setShop } = useStore();

  if (allStores.length <= 1) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        {storeName}
      </Text>
    );
  }

  const options = allStores.map((s) => ({
    label: s.store_name,
    value: s.shop_domain,
  }));

  return (
    <Select
      label="Store"
      options={options}
      value={shop}
      onChange={setShop}
    />
  );
}

export const StoreSelector = OwnerStoreSelector;
