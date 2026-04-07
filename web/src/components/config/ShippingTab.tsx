import { useState } from "react";
import {
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Card,
} from "@shopify/polaris";
import type { TabProps } from "./types";

const ROMANIAN_PROVINCES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brăila", "Brașov", "București", "Buzău", "Călărași", "Caraș-Severin",
  "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
  "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
  "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj",
  "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui", "Vâlcea", "Vrancea",
];

function ProvinceRates({
  rates,
  onChange,
}: {
  rates: Record<string, string>;
  onChange: (r: Record<string, string>) => void;
}) {
  const [bulkRate, setBulkRate] = useState("");

  return (
    <BlockStack gap="300">
      <Text as="p" fontWeight="semibold">Province Rate Overrides</Text>
      <Text as="p" variant="bodySm" tone="subdued">
        Leave empty to use the default rate. Set per-province shipping costs.
      </Text>
      <InlineStack gap="200" blockAlign="end">
        <TextField
          label="Bulk rate (RON)"
          value={bulkRate}
          onChange={setBulkRate}
          autoComplete="off"
          placeholder="e.g. 24.99"
        />
        <Button onClick={() => {
          if (!bulkRate) return;
          const newRates: Record<string, string> = {};
          ROMANIAN_PROVINCES.forEach((p) => { newRates[p] = bulkRate; });
          onChange(newRates);
        }}>
          Apply to All
        </Button>
        <Button tone="critical" onClick={() => onChange({})}>
          Clear All
        </Button>
      </InlineStack>
      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 8, padding: 8 }}>
        <BlockStack gap="100">
          {ROMANIAN_PROVINCES.map((prov) => (
            <InlineStack key={prov} gap="200" blockAlign="center">
              <div style={{ width: 160, fontSize: "0.85rem" }}>{prov}</div>
              <TextField
                label=""
                value={rates[prov] || ""}
                onChange={(v) => {
                  const updated = { ...rates };
                  if (v) updated[prov] = v;
                  else delete updated[prov];
                  onChange(updated);
                }}
                autoComplete="off"
                placeholder="default"
                size="slim"
              />
            </InlineStack>
          ))}
        </BlockStack>
      </div>
    </BlockStack>
  );
}

export function ShippingTab({ draft, setDraft, save }: TabProps) {
  const rates = draft.shipping.rates ?? [];

  return (
    <FormLayout>
      <TextField
        label="Default rate (RON, fallback)"
        value={draft.shipping.default_rate}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            shipping: { ...d.shipping, default_rate: v },
          }))
        }
        autoComplete="off"
      />
      <TextField
        label="Free shipping threshold (RON, 0 = disabled)"
        value={String(draft.shipping.free_threshold)}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            shipping: { ...d.shipping, free_threshold: Number(v) || 0 },
          }))
        }
        type="number"
        autoComplete="off"
      />
      <BlockStack gap="400">
        <Text as="p" fontWeight="semibold">
          Shipping Rate Rules (overrides default when set)
        </Text>
        {rates.map((rate, i) => (
          <Card key={i}>
            <BlockStack gap="300">
              <InlineStack gap="400" align="start" blockAlign="end">
                <TextField
                  label="Name"
                  value={rate.name}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, name: v };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  autoComplete="off"
                />
                <TextField
                  label="Price"
                  value={rate.price}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, price: v };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  autoComplete="off"
                />
                <Button
                  tone="critical"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      shipping: {
                        ...d.shipping,
                        rates: rates.filter((_, j) => j !== i),
                      },
                    }))
                  }
                >
                  Remove
                </Button>
              </InlineStack>
              <InlineStack gap="400">
                <TextField
                  label="Min order (RON)"
                  value={String(rate.min_order)}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, min_order: Number(v) || 0 };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  type="number"
                  autoComplete="off"
                />
                <TextField
                  label="Max order (empty=∞)"
                  value={rate.max_order != null ? String(rate.max_order) : ""}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, max_order: v ? Number(v) : null };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  type="number"
                  autoComplete="off"
                />
                <TextField
                  label="Min qty"
                  value={String(rate.min_qty ?? 0)}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, min_qty: Number(v) || 0 };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  type="number"
                  autoComplete="off"
                />
                <TextField
                  label="Max qty (empty=∞)"
                  value={rate.max_qty != null ? String(rate.max_qty) : ""}
                  onChange={(v) =>
                    setDraft((d) => {
                      const r = [...(d.shipping.rates ?? [])];
                      r[i] = { ...r[i]!, max_qty: v ? Number(v) : null };
                      return { ...d, shipping: { ...d.shipping, rates: r } };
                    })
                  }
                  type="number"
                  autoComplete="off"
                />
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
        <Button
          onClick={() =>
            setDraft((d) => ({
              ...d,
              shipping: {
                ...d.shipping,
                rates: [
                  ...rates,
                  { name: "", price: "0", min_order: 0, max_order: null, min_qty: 0, max_qty: null, product_ids: [], exclude_product_ids: [] },
                ],
              },
            }))
          }
        >
          Add Rate Rule
        </Button>
      </BlockStack>
      <ProvinceRates
        rates={draft.shipping.province_rates ?? {}}
        onChange={(pr) =>
          setDraft((d) => ({
            ...d,
            shipping: { ...d.shipping, province_rates: pr },
          }))
        }
      />
      <Button
        variant="primary"
        onClick={() =>
          save("shipping", draft.shipping as unknown as Record<string, unknown>)
        }
      >
        Save Shipping
      </Button>
    </FormLayout>
  );
}
