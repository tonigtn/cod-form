import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Card,
} from "@shopify/polaris";
import { ProductSelector } from "./ProductSelector";
import type { TabProps } from "./types";

export function BumpsTab({ draft, setDraft, save, storeId }: TabProps) {
  const bumps = draft.bumps || { enabled: false, items: [] };

  return (
    <FormLayout>
      <Checkbox
        label="Order Bumps enabled"
        checked={bumps.enabled}
        onChange={(v) =>
          setDraft((d) => ({ ...d, bumps: { ...bumps, enabled: v } }))
        }
      />
      <BlockStack gap="400">
        {bumps.items.map((item, i) => (
          <Card key={i}>
            <BlockStack gap="300">
              <InlineStack gap="400" align="start">
                <Checkbox
                  label="Active"
                  checked={item.enabled}
                  onChange={(v) =>
                    setDraft((d) => {
                      const items = [...bumps.items];
                      items[i] = { ...items[i]!, enabled: v };
                      return { ...d, bumps: { ...bumps, items } };
                    })
                  }
                />
                <Button
                  tone="critical"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      bumps: {
                        ...bumps,
                        items: bumps.items.filter((_, j) => j !== i),
                      },
                    }))
                  }
                >
                  Remove
                </Button>
              </InlineStack>
              <InlineStack gap="400">
                <TextField
                  label="Variant ID"
                  value={String(item.variant_id)}
                  onChange={(v) =>
                    setDraft((d) => {
                      const items = [...bumps.items];
                      items[i] = { ...items[i]!, variant_id: Number(v) || 0 };
                      return { ...d, bumps: { ...bumps, items } };
                    })
                  }
                  type="number"
                  autoComplete="off"
                  helpText="Enter the Shopify variant ID for the bump product"
                />
                <TextField
                  label="Price (RON)"
                  value={item.price}
                  onChange={(v) =>
                    setDraft((d) => {
                      const items = [...bumps.items];
                      items[i] = { ...items[i]!, price: v };
                      return { ...d, bumps: { ...bumps, items } };
                    })
                  }
                  autoComplete="off"
                />
              </InlineStack>
              <TextField
                label="Title"
                value={item.title}
                onChange={(v) =>
                  setDraft((d) => {
                    const items = [...bumps.items];
                    items[i] = { ...items[i]!, title: v };
                    return { ...d, bumps: { ...bumps, items } };
                  })
                }
                autoComplete="off"
              />
              <TextField
                label="Display text (shown to customer)"
                value={item.text}
                onChange={(v) =>
                  setDraft((d) => {
                    const items = [...bumps.items];
                    items[i] = { ...items[i]!, text: v };
                    return { ...d, bumps: { ...bumps, items } };
                  })
                }
                autoComplete="off"
              />
              <TextField
                label="Image URL (optional)"
                value={item.image_url}
                onChange={(v) =>
                  setDraft((d) => {
                    const items = [...bumps.items];
                    items[i] = { ...items[i]!, image_url: v };
                    return { ...d, bumps: { ...bumps, items } };
                  })
                }
                autoComplete="off"
              />
              <ProductSelector
                storeId={storeId}
                selectedIds={item.target_product_ids}
                onChange={(ids) =>
                  setDraft((d) => {
                    const items = [...bumps.items];
                    items[i] = { ...items[i]!, target_product_ids: ids };
                    return { ...d, bumps: { ...bumps, items } };
                  })
                }
                label="Show this bump for"
                helpText="Select which products this bump appears on. Empty = all products."
              />
            </BlockStack>
          </Card>
        ))}
        <InlineStack gap="400">
          <Button
            onClick={() =>
              setDraft((d) => ({
                ...d,
                bumps: {
                  ...bumps,
                  items: [
                    ...bumps.items,
                    {
                      variant_id: 0,
                      title: "",
                      price: "0.00",
                      image_url: "",
                      text: "",
                      target_product_ids: [],
                      enabled: true,
                    },
                  ],
                },
              }))
            }
          >
            Add Bump
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              save("bumps", bumps as unknown as Record<string, unknown>)
            }
          >
            Save Order Bumps
          </Button>
        </InlineStack>
      </BlockStack>
    </FormLayout>
  );
}
