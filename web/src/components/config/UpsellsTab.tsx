import { useState } from "react";
import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Tag,
  Card,
} from "@shopify/polaris";
import { useProducts } from "../../api/hooks";
import { ProductPicker } from "../ProductPicker";
import { ProductSelector } from "./ProductSelector";
import type { TabProps } from "./types";

export function UpsellsTab({ draft, setDraft, save, storeId }: TabProps) {
  const [mappingTriggerOpen, setMappingTriggerOpen] = useState(false);
  const [mappingUpsellOpen, setMappingUpsellOpen] = useState(false);
  const [pendingTriggerIds, setPendingTriggerIds] = useState<number[]>([]);
  const [pendingUpsellIds, setPendingUpsellIds] = useState<number[]>([]);
  const [offerPickerIndex, setOfferPickerIndex] = useState<number | null>(null);

  const { data: productsData } = useProducts(storeId, "", true);
  const productMap = new Map(
    (productsData?.products ?? []).map((p) => [p.id, p])
  );
  const productName = (id: number) => productMap.get(id)?.title ?? String(id);

  const upsells = draft.upsells || {
    enabled: false,
    default_product_ids: [],
    product_mappings: {},
    downsell_product_id: null,
  };

  return (
    <FormLayout>
      <Checkbox
        label="Upsells enabled"
        checked={upsells.enabled}
        onChange={(v) =>
          setDraft((d) => ({ ...d, upsells: { ...upsells, enabled: v } }))
        }
      />
      <ProductSelector
        storeId={storeId}
        selectedIds={upsells.default_product_ids}
        onChange={(ids) =>
          setDraft((d) => ({
            ...d,
            upsells: { ...upsells, default_product_ids: ids },
          }))
        }
        label="Default upsell products"
        helpText="Products offered as upsells when no product-specific mapping exists"
      />
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">
          Product-specific upsell mappings
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          When a customer buys a specific product, offer these upsells instead
          of the defaults.
        </Text>
        {Object.entries(upsells.product_mappings).map(([key, ids]) => (
          <Card key={key}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center" wrap>
                <Text as="span" fontWeight="bold">
                  {productName(Number(key))}
                </Text>
                <Text as="span" tone="subdued">
                  →
                </Text>
                {ids.map((id) => (
                  <Tag key={id}>{productName(id)}</Tag>
                ))}
                <Button
                  tone="critical"
                  size="slim"
                  onClick={() =>
                    setDraft((d) => {
                      const mappings = { ...upsells.product_mappings };
                      delete mappings[key];
                      return {
                        ...d,
                        upsells: { ...upsells, product_mappings: mappings },
                      };
                    })
                  }
                >
                  Remove
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
        <InlineStack gap="200">
          <Button onClick={() => setMappingTriggerOpen(true)}>
            Add Mapping
          </Button>
        </InlineStack>
        {/* Step 1: Pick trigger product */}
        {mappingTriggerOpen && (
          <ProductPicker
            storeId={storeId}
            selectedIds={pendingTriggerIds}
            onSelect={(ids) => {
              setPendingTriggerIds(ids);
              setMappingTriggerOpen(false);
              if (ids.length) setMappingUpsellOpen(true);
            }}
            onClose={() => setMappingTriggerOpen(false)}
          />
        )}
        {/* Step 2: Pick upsell products for that trigger */}
        {mappingUpsellOpen && (
          <ProductPicker
            storeId={storeId}
            selectedIds={pendingUpsellIds}
            onSelect={(ids) => {
              if (ids.length && pendingTriggerIds.length) {
                const newMappings = { ...upsells.product_mappings };
                for (const tid of pendingTriggerIds) {
                  newMappings[String(tid)] = ids;
                }
                setDraft((d) => ({
                  ...d,
                  upsells: {
                    ...upsells,
                    product_mappings: newMappings,
                  },
                }));
              }
              setPendingTriggerIds([]);
              setPendingUpsellIds([]);
              setMappingUpsellOpen(false);
            }}
            onClose={() => {
              setPendingTriggerIds([]);
              setPendingUpsellIds([]);
              setMappingUpsellOpen(false);
            }}
          />
        )}
      </BlockStack>
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">Upsell Defaults</Text>
        <InlineStack gap="400">
          <TextField
            label="Timer duration (seconds)"
            value={String(upsells.default_timer_duration ?? 60)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, upsells: { ...upsells, default_timer_duration: Number(v) || 60 } }))
            }
            type="number"
            autoComplete="off"
          />
        </InlineStack>
        <TextField
          label="Accept button text"
          value={upsells.default_accept_text ?? "Da, adaugă la comandă!"}
          onChange={(v) =>
            setDraft((d) => ({ ...d, upsells: { ...upsells, default_accept_text: v } }))
          }
          autoComplete="off"
        />
        <TextField
          label="Reject button text"
          value={upsells.default_reject_text ?? "Nu, mulțumesc"}
          onChange={(v) =>
            setDraft((d) => ({ ...d, upsells: { ...upsells, default_reject_text: v } }))
          }
          autoComplete="off"
        />
      </BlockStack>
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">Per-Product Upsell Overrides</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Customize text, timer, and colors per upsell product. Leave fields empty to use defaults.
        </Text>
        {(upsells.offers || []).map((offer, i) => (
          <Card key={i}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" fontWeight="semibold">
                  {offer.product_id ? productName(offer.product_id) : "No product"}
                </Text>
                <Button size="slim" onClick={() => setOfferPickerIndex(i)}>
                  {offer.product_id ? "Change" : "Select Product"}
                </Button>
                <Button tone="critical" size="slim" onClick={() => {
                  const offers = (upsells.offers || []).filter((_, j) => j !== i);
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }}>Remove</Button>
              </InlineStack>
              <InlineStack gap="400">
                <TextField label="Timer (sec, 0=default)" value={String(offer.timer_duration)} onChange={(v) => {
                  const offers = [...(upsells.offers || [])];
                  offers[i] = { ...offers[i]!, timer_duration: Number(v) || 0 };
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }} type="number" autoComplete="off" />
              </InlineStack>
              <TextField label="Header text" value={offer.header_text} onChange={(v) => {
                const offers = [...(upsells.offers || [])];
                offers[i] = { ...offers[i]!, header_text: v };
                setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
              }} autoComplete="off" />
              <TextField label="Subheader text" value={offer.subheader_text} onChange={(v) => {
                const offers = [...(upsells.offers || [])];
                offers[i] = { ...offers[i]!, subheader_text: v };
                setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
              }} autoComplete="off" />
              <InlineStack gap="400">
                <TextField label="Accept text" value={offer.accept_text} onChange={(v) => {
                  const offers = [...(upsells.offers || [])];
                  offers[i] = { ...offers[i]!, accept_text: v };
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }} autoComplete="off" />
                <TextField label="Accept color" value={offer.accept_color} onChange={(v) => {
                  const offers = [...(upsells.offers || [])];
                  offers[i] = { ...offers[i]!, accept_color: v };
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }} autoComplete="off" placeholder="#2E7D32" />
              </InlineStack>
              <InlineStack gap="400">
                <TextField label="Reject text" value={offer.reject_text} onChange={(v) => {
                  const offers = [...(upsells.offers || [])];
                  offers[i] = { ...offers[i]!, reject_text: v };
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }} autoComplete="off" />
                <TextField label="Discount badge text" value={offer.discount_badge_text} onChange={(v) => {
                  const offers = [...(upsells.offers || [])];
                  offers[i] = { ...offers[i]!, discount_badge_text: v };
                  setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
                }} autoComplete="off" />
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
        {offerPickerIndex !== null && (
          <ProductPicker
            storeId={storeId}
            selectedIds={
              (upsells.offers || [])[offerPickerIndex]?.product_id
                ? [(upsells.offers || [])[offerPickerIndex]!.product_id]
                : []
            }
            onSelect={(ids) => {
              if (ids.length) {
                const offers = [...(upsells.offers || [])];
                offers[offerPickerIndex] = {
                  ...offers[offerPickerIndex]!,
                  product_id: ids[0]!,
                };
                setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
              }
              setOfferPickerIndex(null);
            }}
            onClose={() => setOfferPickerIndex(null)}
          />
        )}
        <Button onClick={() => {
          const offers = [...(upsells.offers || []), {
            product_id: 0, header_text: "", subheader_text: "", discount_badge_text: "",
            timer_duration: 0, accept_text: "", accept_color: "", reject_text: "",
          }];
          setDraft((d) => ({ ...d, upsells: { ...upsells, offers } }));
        }}>Add Per-Product Override</Button>
      </BlockStack>
      <Button
        variant="primary"
        onClick={() =>
          save("upsells", upsells as unknown as Record<string, unknown>)
        }
      >
        Save Upsells
      </Button>
    </FormLayout>
  );
}
