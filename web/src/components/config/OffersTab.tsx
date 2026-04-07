import { useState } from "react";
import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Select,
  RangeSlider,
  Divider,
  Card,
} from "@shopify/polaris";
import { useProducts } from "../../api/hooks";
import { ProductPicker } from "../ProductPicker";
import type { OffersStyle } from "../../api/types";
import type { TabProps } from "./types";

const OFFERS_DEFAULTS: OffersStyle = {
  template: "classic",
  show_in: "page",
  border_radius: "8px",
  active_bg: "#FFF8F8",
  active_border: "#C62828",
  inactive_bg: "#ffffff",
  inactive_border: "#e0e0e0",
  tag_bg: "#C62828",
  tag_text_color: "#ffffff",
  tag_text_size: "12px",
  tag_bold: true,
  tag_italic: false,
  label_bg: "#2E7D32",
  label_text_color: "#ffffff",
  label_text_size: "11px",
  label_bold: true,
  label_italic: false,
  title_color: "#333333",
  title_size: "14px",
  title_bold: true,
  title_italic: false,
  price_color: "#C62828",
  price_size: "14px",
  price_bold: true,
  price_italic: false,
  inactive_tag_bg: "#292524",
  hide_product_image: false,
  hide_comparison_price: false,
  hide_offers_higher_qty: false,
  add_title_to_order: false,
  use_comparison_price: false,
  disable_variant_selection: false,
};

const COLOR_PRESETS: { name: string; colors: Partial<OffersStyle> }[] = [
  { name: "Red", colors: { active_bg: "#FFF8F8", active_border: "#C62828", tag_bg: "#C62828", price_color: "#C62828", label_bg: "#2E7D32" } },
  { name: "Blue", colors: { active_bg: "#F0F4FF", active_border: "#1565C0", tag_bg: "#1565C0", price_color: "#1565C0", label_bg: "#2E7D32" } },
  { name: "Purple", colors: { active_bg: "#F5F0FF", active_border: "#6A1B9A", tag_bg: "#6A1B9A", price_color: "#6A1B9A", label_bg: "#E65100" } },
  { name: "Green", colors: { active_bg: "#F0FFF0", active_border: "#2E7D32", tag_bg: "#2E7D32", price_color: "#2E7D32", label_bg: "#C62828" } },
  { name: "Orange", colors: { active_bg: "#FFF8F0", active_border: "#E65100", tag_bg: "#E65100", price_color: "#E65100", label_bg: "#1565C0" } },
  { name: "Teal", colors: { active_bg: "#F0FFFE", active_border: "#00695C", tag_bg: "#00695C", price_color: "#00695C", label_bg: "#C62828" } },
  { name: "Pink", colors: { active_bg: "#FFF0F5", active_border: "#C2185B", tag_bg: "#C2185B", price_color: "#C2185B", label_bg: "#2E7D32" } },
  { name: "Dark", colors: { active_bg: "#F5F5F5", active_border: "#212121", tag_bg: "#212121", price_color: "#212121", label_bg: "#C62828" } },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <TextField label={label} value={value} onChange={onChange} autoComplete="off" />
      </div>
      <div style={{ marginBottom: 4 }}>
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 32, height: 32, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", padding: 0 }}
        />
      </div>
    </div>
  );
}

export function OffersTab({ draft, setDraft, save, storeId }: TabProps) {
  const os = draft.offers_style ?? OFFERS_DEFAULTS;
  const setOs = (updates: Partial<OffersStyle>) =>
    setDraft((d) => ({ ...d, offers_style: { ...os, ...updates } }));
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const groups = draft.offer_groups ?? [];

  // Fetch products to resolve IDs to names
  const { data: productsData } = useProducts(storeId, "", true);
  const productMap = new Map<number, { title: string; image_url: string }>();
  for (const p of productsData?.products ?? []) {
    productMap.set(p.id, { title: p.title, image_url: p.image_url });
  }

  const setGroup = (gi: number, updates: Partial<typeof groups[0]>) =>
    setDraft((d) => {
      const g = [...(d.offer_groups ?? [])];
      g[gi] = { ...g[gi]!, ...updates };
      return { ...d, offer_groups: g };
    });

  return (
    <FormLayout>
      <BlockStack gap="600">
        {/* -- Offer Groups -- */}
        <Text as="h2" variant="headingMd">Offer Groups</Text>
        <BlockStack gap="500">
          {groups.map((group, gi) => (
            <Card key={gi}>
              <BlockStack gap="400">
                {/* Group header */}
                <InlineStack gap="400" align="space-between" blockAlign="center">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Offer name"
                      value={group.name}
                      onChange={(v) => setGroup(gi, { name: v })}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingBottom: 4 }}>
                    <Checkbox
                      label="Enabled"
                      checked={group.enabled}
                      onChange={(v) => setGroup(gi, { enabled: v })}
                    />
                    <Button
                      tone="critical"
                      size="slim"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          offer_groups: (d.offer_groups ?? []).filter((_, j) => j !== gi),
                        }))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </InlineStack>

                {/* Product selection */}
                <div>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Products {group.product_ids.length === 0 ? "(all products)" : ""}
                  </Text>
                  {group.product_ids.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {group.product_ids.map((pid) => {
                        const info = productMap.get(pid);
                        return (
                          <div key={pid} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "3px 8px 3px 3px", border: "1px solid #e1e3e5",
                            borderRadius: 6, background: "#f6f6f7", fontSize: 12,
                          }}>
                            {info?.image_url ? (
                              <img src={info.image_url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                            ) : (
                              <span style={{ width: 22, height: 22, borderRadius: 4, background: "#ddd", display: "inline-block" }} />
                            )}
                            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {info?.title ?? `Product #${pid}`}
                            </span>
                            <button type="button" onClick={() => setGroup(gi, { product_ids: group.product_ids.filter((id) => id !== pid) })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, padding: 0, lineHeight: 1 }}
                            >✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <Button size="slim" onClick={() => setPickerOpen(gi)}>
                      Select Products
                    </Button>
                  </div>
                </div>

                <Divider />

                {/* Quantity tiers */}
                <Text as="p" variant="bodyMd" fontWeight="semibold">Quantity Tiers</Text>
                <BlockStack gap="400">
                  {(group.tiers ?? []).map((tier, ti) => {
                    const dt = tier.discount_type ?? "percentage";
                    const updateTier = (updates: Partial<typeof tier>) => {
                      const tiers = [...(group.tiers ?? [])];
                      tiers[ti] = { ...tiers[ti]!, ...updates };
                      setGroup(gi, { tiers });
                    };
                    return (
                      <Card key={ti} background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <InlineStack gap="300" align="start" blockAlign="end">
                            <TextField label="Quantity" value={String(tier.min_qty)} type="number" autoComplete="off"
                              onChange={(v) => updateTier({ min_qty: Number(v) || 2 })}
                            />
                            <div style={{ flex: 1 }}>
                              <TextField label="Title" value={tier.title ?? ""} autoComplete="off" placeholder={`${tier.min_qty} buc`}
                                onChange={(v) => updateTier({ title: v })}
                              />
                            </div>
                            <div style={{ paddingBottom: 4 }}>
                              <Button tone="critical" size="slim" onClick={() => {
                                const tiers = (group.tiers ?? []).filter((_, j) => j !== ti);
                                setGroup(gi, { tiers });
                              }}>✕</Button>
                            </div>
                          </InlineStack>
                          <InlineStack gap="300" align="start">
                            <Select label="Discount type" value={dt} options={[
                              { label: "No discount", value: "none" },
                              { label: "Fixed amount", value: "fixed" },
                              { label: "Percentage", value: "percentage" },
                            ]} onChange={(v) => updateTier({ discount_type: v })} />
                            {dt === "percentage" && (
                              <TextField label="Discount %" value={String(tier.discount_percent)} type="number" autoComplete="off"
                                onChange={(v) => updateTier({ discount_percent: Number(v) || 0 })}
                              />
                            )}
                            {dt === "fixed" && (
                              <TextField label="Amount (RON)" value={String(tier.discount_fixed ?? 0)} type="number" autoComplete="off"
                                onChange={(v) => updateTier({ discount_fixed: Number(v) || 0 })}
                              />
                            )}
                          </InlineStack>
                          <InlineStack gap="300" align="start">
                            <div style={{ flex: 1 }}>
                              <TextField label="Tag" value={tier.tag ?? ""} autoComplete="off" placeholder="e.g. Preț întreg"
                                onChange={(v) => updateTier({ tag: v })}
                              />
                            </div>
                            <ColorField label="Tag bg color" value={tier.tag_bg ?? ""} onChange={(v) => updateTier({ tag_bg: v })} />
                          </InlineStack>
                          <TextField label="Label" value={tier.label ?? ""} autoComplete="off" placeholder="e.g. Popular"
                            onChange={(v) => updateTier({ label: v })}
                          />
                          <TextField label="Image URL" value={tier.image_url ?? ""} autoComplete="off" placeholder="https://..."
                            onChange={(v) => updateTier({ image_url: v })}
                          />
                          <Checkbox label="Preselect this offer" checked={tier.preselect ?? false}
                            onChange={(v) => updateTier({ preselect: v })}
                          />
                        </BlockStack>
                      </Card>
                    );
                  })}
                  <Button size="slim" onClick={() => {
                    const tiers = [...(group.tiers ?? []), { min_qty: 2, title: "", discount_type: "percentage", discount_percent: 10, discount_fixed: 0, tag: "", tag_bg: "", label: "", image_url: "", preselect: false }];
                    setGroup(gi, { tiers });
                  }}>Add Tier</Button>
                </BlockStack>
              </BlockStack>
            </Card>
          ))}

          <Button onClick={() =>
            setDraft((d) => ({
              ...d,
              offer_groups: [
                ...(d.offer_groups ?? []),
                { name: "New Offer", product_ids: [], enabled: true, tiers: [{ min_qty: 2, title: "", discount_type: "percentage", discount_percent: 10, discount_fixed: 0, tag: "", tag_bg: "", label: "", image_url: "", preselect: false }] },
              ],
            }))
          }>
            Add Offer Group
          </Button>
        </BlockStack>

        <Divider />

        {/* -- Design Template -- */}
        <Text as="h2" variant="headingMd">Design</Text>
        <Select label="Template" options={[
          { label: "Classic (horizontal cards)", value: "classic" },
          { label: "Modern (pill badges)", value: "modern" },
          { label: "Vertical (stacked list)", value: "vertical" },
        ]} value={os.template} onChange={(v) => setOs({ template: v })} />
        <Select label="Show offers in" options={[
          { label: "Above Buy Button (on page)", value: "page" },
          { label: "Inside Form (popup)", value: "form" },
        ]} value={os.show_in} onChange={(v) => setOs({ show_in: v })} />
        <RangeSlider label={`Rounded corners: ${parseInt(os.border_radius)}px`}
          value={parseInt(os.border_radius) || 8} min={0} max={24}
          onChange={(v) => setOs({ border_radius: `${v}px` })} output />

        <Divider />

        {/* -- Color Presets -- */}
        <Text as="h2" variant="headingMd">Color Presets</Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {COLOR_PRESETS.map((preset) => (
            <button key={preset.name} type="button" onClick={() => setOs(preset.colors)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                border: "1px solid #c9cccf", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: preset.colors.active_border, border: "1px solid #ccc" }} />
              {preset.name}
            </button>
          ))}
        </div>

        <Divider />

        <Text as="h2" variant="headingMd">Active Offer Style</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Background" value={os.active_bg} onChange={(v) => setOs({ active_bg: v })} /></div>
          <div style={{ flex: 1 }}><ColorField label="Border" value={os.active_border} onChange={(v) => setOs({ active_border: v })} /></div>
        </InlineStack>

        <Text as="h2" variant="headingMd">Non-Selected Offer Style</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Background" value={os.inactive_bg} onChange={(v) => setOs({ inactive_bg: v })} /></div>
          <div style={{ flex: 1 }}><ColorField label="Border" value={os.inactive_border} onChange={(v) => setOs({ inactive_border: v })} /></div>
          <div style={{ flex: 1 }}><ColorField label="Tag background" value={os.inactive_tag_bg} onChange={(v) => setOs({ inactive_tag_bg: v })} /></div>
        </InlineStack>

        <Divider />

        <Text as="h2" variant="headingMd">Discount Tag</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Background" value={os.tag_bg} onChange={(v) => setOs({ tag_bg: v })} /></div>
          <div style={{ flex: 1 }}><ColorField label="Text color" value={os.tag_text_color} onChange={(v) => setOs({ tag_text_color: v })} /></div>
        </InlineStack>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><TextField label="Text size" value={os.tag_text_size} onChange={(v) => setOs({ tag_text_size: v })} autoComplete="off" /></div>
          <div style={{ flex: 1, paddingTop: 24 }}><Checkbox label="Bold" checked={os.tag_bold} onChange={(v) => setOs({ tag_bold: v })} /></div>
          <div style={{ flex: 1, paddingTop: 24 }}><Checkbox label="Italic" checked={os.tag_italic} onChange={(v) => setOs({ tag_italic: v })} /></div>
        </InlineStack>

        <Text as="h2" variant="headingMd">Offer Label</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Background" value={os.label_bg} onChange={(v) => setOs({ label_bg: v })} /></div>
          <div style={{ flex: 1 }}><ColorField label="Text color" value={os.label_text_color} onChange={(v) => setOs({ label_text_color: v })} /></div>
        </InlineStack>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><TextField label="Text size" value={os.label_text_size} onChange={(v) => setOs({ label_text_size: v })} autoComplete="off" /></div>
          <div style={{ flex: 1, paddingTop: 24 }}><Checkbox label="Bold" checked={os.label_bold} onChange={(v) => setOs({ label_bold: v })} /></div>
          <div style={{ flex: 1, paddingTop: 24 }}><Checkbox label="Italic" checked={os.label_italic} onChange={(v) => setOs({ label_italic: v })} /></div>
        </InlineStack>

        <Divider />

        <Text as="h2" variant="headingMd">Title (Quantity)</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Text color" value={os.title_color} onChange={(v) => setOs({ title_color: v })} /></div>
          <div style={{ flex: 1 }}><TextField label="Text size" value={os.title_size} onChange={(v) => setOs({ title_size: v })} autoComplete="off" /></div>
        </InlineStack>
        <InlineStack gap="400">
          <Checkbox label="Bold" checked={os.title_bold} onChange={(v) => setOs({ title_bold: v })} />
          <Checkbox label="Italic" checked={os.title_italic} onChange={(v) => setOs({ title_italic: v })} />
        </InlineStack>

        <Text as="h2" variant="headingMd">Price</Text>
        <InlineStack gap="400">
          <div style={{ flex: 1 }}><ColorField label="Text color" value={os.price_color} onChange={(v) => setOs({ price_color: v })} /></div>
          <div style={{ flex: 1 }}><TextField label="Text size" value={os.price_size} onChange={(v) => setOs({ price_size: v })} autoComplete="off" /></div>
        </InlineStack>
        <InlineStack gap="400">
          <Checkbox label="Bold" checked={os.price_bold} onChange={(v) => setOs({ price_bold: v })} />
          <Checkbox label="Italic" checked={os.price_italic} onChange={(v) => setOs({ price_italic: v })} />
        </InlineStack>

        <Divider />

        <Text as="h2" variant="headingMd">Options</Text>
        <Checkbox label="Hide product image" checked={os.hide_product_image} onChange={(v) => setOs({ hide_product_image: v })} />
        <Checkbox label="Hide comparison price" checked={os.hide_comparison_price} onChange={(v) => setOs({ hide_comparison_price: v })} />
        <Checkbox label="Hide quantity offers on higher quantity" checked={os.hide_offers_higher_qty} onChange={(v) => setOs({ hide_offers_higher_qty: v })} />
        <Checkbox label="Add offer title to product title in order" checked={os.add_title_to_order} onChange={(v) => setOs({ add_title_to_order: v })} />
        <Checkbox label="Use comparison price as old price in offers" checked={os.use_comparison_price} onChange={(v) => setOs({ use_comparison_price: v })} />
        <Checkbox label="Disable variant selection when offers shown" checked={os.disable_variant_selection} onChange={(v) => setOs({ disable_variant_selection: v })} />

        <Divider />

        <InlineStack gap="400">
          <Button variant="primary" onClick={() => {
            save("offer_groups", (draft.offer_groups ?? []) as unknown as Record<string, unknown>);
            save("offers_style", os as unknown as Record<string, unknown>);
          }}>
            Save Offers
          </Button>
        </InlineStack>
      </BlockStack>

      {/* Product picker modal */}
      {pickerOpen !== null && (
        <ProductPicker
          storeId={storeId}
          selectedIds={groups[pickerOpen]?.product_ids ?? []}
          onSelect={(ids) => {
            const idx = pickerOpen;
            setGroup(idx, { product_ids: ids });
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </FormLayout>
  );
}
