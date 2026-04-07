import { useState } from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Tag,
} from "@shopify/polaris";
import { useProducts } from "../../api/hooks";
import { ProductPicker } from "../ProductPicker";

/** Reusable inline product selector: button + picker modal + selected tags */
export function ProductSelector({
  storeId,
  selectedIds,
  onChange,
  label,
  helpText,
}: {
  storeId: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  label: string;
  helpText?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useProducts(storeId, "", true);
  const products = data?.products ?? [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Text as="span" fontWeight="semibold" variant="bodySm">
          {label}
        </Text>
        <Button size="slim" onClick={() => setOpen(true)}>
          Select Products
        </Button>
      </InlineStack>
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
      {selectedIds.length > 0 && (
        <InlineStack gap="200" wrap>
          {selectedIds.map((id) => {
            const p = productMap.get(id);
            return (
              <Tag
                key={id}
                onRemove={() => onChange(selectedIds.filter((x) => x !== id))}
              >
                {p ? p.title : String(id)}
              </Tag>
            );
          })}
        </InlineStack>
      )}
      {selectedIds.length === 0 && (
        <Text as="p" variant="bodySm" tone="subdued">
          None selected — applies to all products
        </Text>
      )}
      {open && (
        <ProductPicker
          storeId={storeId}
          selectedIds={selectedIds}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </BlockStack>
  );
}
