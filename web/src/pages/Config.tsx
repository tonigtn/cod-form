import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Tabs,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Banner,
  BlockStack,
  Text,
  Tag,
  InlineStack,
  Select,
  RangeSlider,
  Divider,
} from "@shopify/polaris";
import { useStoreConfig, useUpdateConfigSection, useProducts, useStoreLocale } from "../api/hooks";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";
import { FormBuilder, DEFAULT_FIELDS } from "../components/FormBuilder";
import { FormPreview } from "../components/FormPreview";
import { OffersPreview } from "../components/OffersPreview";
import { ProductPicker } from "../components/ProductPicker";
import type { StoreConfig, FormField, OffersStyle } from "../api/types";

export function Config() {
  const { storeId } = useStore(); // scoped to session store
  const [tabIndex, setTabIndex] = useState(0);
  const { data: config, isLoading } = useStoreConfig(storeId);
  const { data: localeData } = useStoreLocale(storeId);
  const updateSection = useUpdateConfigSection(storeId);
  const [draft, setDraftRaw] = useState<StoreConfig | null>(null);

  useEffect(() => {
    if (config) setDraftRaw(config);
  }, [config]);

  const setDraft = useCallback(
    (fn: (d: StoreConfig) => StoreConfig) => {
      setDraftRaw((prev) => (prev ? fn(prev) : prev));
    },
    []
  );

  const save = useCallback(
    (section: string, data: Record<string, unknown>) => {
      updateSection.mutate({ section, data });
    },
    [updateSection]
  );

  const tabs = [
    { id: "form", content: "Form" },
    { id: "button_style", content: "Button Design" },
    { id: "shipping", content: "Shipping" },
    { id: "fraud", content: "Fraud" },
    { id: "pixels", content: "Pixels" },
    { id: "offers", content: "Offers" },
    { id: "upsells", content: "Upsells" },
    { id: "bumps", content: "Order Bumps" },
    { id: "downsell", content: "Downsell" },
    { id: "prepaid", content: "Prepaid" },
    { id: "settings", content: "Settings" },
  ];

  if (isLoading || !draft) {
    return (
      <Page title="Store Config">
        <Text as="p">Loading...</Text>
      </Page>
    );
  }

  return (
    <Page title="Store Config">
      <Layout>
        <Layout.Section>
          <OwnerStoreSelector />
        </Layout.Section>

        {updateSection.isSuccess && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => updateSection.reset()}>
              Config saved.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>
                  <div style={{ padding: "16px" }}>
                    {tabIndex === 0 && (
                      <FormTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 1 && (
                      <ButtonStyleTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 2 && (
                      <ShippingTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 3 && (
                      <FraudTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 4 && (
                      <PixelsTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 5 && (
                      <OffersTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 6 && (
                      <UpsellsTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 7 && (
                      <BumpsTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 8 && (
                      <DownsellTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 9 && (
                      <PrepaidTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                    {tabIndex === 10 && (
                      <SettingsTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} />
                    )}
                  </div>
                </Tabs>
              </Card>
            </div>
            {tabIndex <= 1 && (
              <div style={{ flexShrink: 0 }}>
                <FormPreview config={draft} locale={localeData?.locale} />
              </div>
            )}
            {tabIndex === 5 && (
              <div style={{ flexShrink: 0 }}>
                <OffersPreview config={draft} />
              </div>
            )}
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reusable inline product selector: button + picker modal + selected tags */
function ProductSelector({
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

// ─── Tab components ──────────────────────────────────────────────────────────

interface TabProps {
  draft: StoreConfig;
  setDraft: (fn: (d: StoreConfig) => StoreConfig) => void;
  save: (section: string, data: Record<string, unknown>) => void;
  storeId: string;
}

function FormTab({ draft, setDraft, save }: TabProps) {
  const layoutFields = draft.form.layout?.fields ?? [];
  const fs = draft.form_style ?? DEFAULTS_FORM_STYLE;
  const setFs = (key: string, v: string) =>
    setDraft((d) => ({ ...d, form_style: { ...fs, [key]: v } }));

  return (
    <FormLayout>
      <Checkbox
        label="Form enabled"
        checked={draft.form.enabled}
        onChange={(v) =>
          setDraft((d) => ({ ...d, form: { ...d.form, enabled: v } }))
        }
      />
      <TextField
        label="Button text"
        value={draft.form.button_text}
        onChange={(v) =>
          setDraft((d) => ({ ...d, form: { ...d.form, button_text: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Order note prefix"
        value={draft.form.custom_note_prefix}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            form: { ...d.form, custom_note_prefix: v },
          }))
        }
        autoComplete="off"
      />
      <BlockStack gap="200">
        <Text as="p" variant="bodySm">
          Tags
        </Text>
        <InlineStack gap="200">
          {draft.form.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </InlineStack>
      </BlockStack>
      <Button
        variant="primary"
        onClick={() => save("form", draft.form as unknown as Record<string, unknown>)}
      >
        Save Form Settings
      </Button>

      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">Form Design</Text>
        <InlineStack gap="400">
          <TextField label="Background color" value={fs.bg_color} onChange={(v) => setFs("bg_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: fs.bg_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
          <TextField label="Text color" value={fs.text_color} onChange={(v) => setFs("text_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: fs.text_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
        </InlineStack>
        <InlineStack gap="400">
          <TextField label="Header text color" value={fs.header_text_color} onChange={(v) => setFs("header_text_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: fs.header_text_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
          <TextField label="Label color" value={fs.label_color} onChange={(v) => setFs("label_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: fs.label_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
        </InlineStack>
        <TextField label="Accent color (primary)" value={fs.accent_color} onChange={(v) => setFs("accent_color", v)} autoComplete="off" helpText="Used for buttons, links, checkboxes" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: fs.accent_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
        <InlineStack gap="400">
          <TextField label="Border radius" value={fs.border_radius} onChange={(v) => setFs("border_radius", v)} autoComplete="off" helpText="e.g. 12px" />
          <TextField label="Max width" value={fs.max_width} onChange={(v) => setFs("max_width", v)} autoComplete="off" helpText="e.g. 480px" />
        </InlineStack>
        <InlineStack gap="400">
          <TextField label="Overlay opacity" value={fs.overlay_opacity} onChange={(v) => setFs("overlay_opacity", v)} autoComplete="off" helpText="0-1 (e.g. 0.5)" />
          <TextField label="Product image size" value={fs.product_image_size} onChange={(v) => setFs("product_image_size", v)} autoComplete="off" helpText="e.g. 80px" />
        </InlineStack>
        <Button variant="primary" onClick={() => save("form_style", fs as unknown as Record<string, unknown>)}>
          Save Form Design
        </Button>
      </BlockStack>

      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">Form Field Builder</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Customize which fields appear, their order, and add custom fields.
          Empty layout uses default field order.
        </Text>
        <FormBuilder
          fields={layoutFields}
          onChange={(fields: FormField[]) =>
            setDraft((d) => ({
              ...d,
              form: { ...d.form, layout: { fields } },
            }))
          }
          onSave={() =>
            save("form", {
              ...draft.form,
              layout: { fields: layoutFields.length > 0 ? layoutFields : DEFAULT_FIELDS },
            } as unknown as Record<string, unknown>)
          }
        />
      </BlockStack>
    </FormLayout>
  );
}

const DEFAULTS_BUTTON = {
  text: "Comandă cu plata la livrare",
  subtitle: "",
  text_color: "#ffffff",
  text_size: "16px",
  bg_color: "#C62828",
  bg_color_hover: "#B71C1C",
  border_color: "",
  border_width: "0px",
  border_radius: "8px",
  animation: "none",
  icon: "cash",
};

const DEFAULTS_FORM_STYLE = {
  bg_color: "#ffffff",
  text_color: "#333333",
  header_text_color: "#111111",
  label_color: "#555555",
  border_radius: "12px",
  max_width: "480px",
  overlay_opacity: "0.5",
  product_image_size: "80px",
  accent_color: "#C62828",
};

function ButtonStyleTab({ draft, setDraft, save }: TabProps) {
  const bs = draft.button_style ?? DEFAULTS_BUTTON;
  const set = (key: string, v: string) =>
    setDraft((d) => ({ ...d, button_style: { ...bs, [key]: v } }));

  return (
    <FormLayout>
      <TextField label="Button text" value={bs.text} onChange={(v) => set("text", v)} autoComplete="off" />
      <TextField label="Subtitle (small text below)" value={bs.subtitle} onChange={(v) => set("subtitle", v)} autoComplete="off" helpText="Optional second line, e.g. 'Livrare gratuită'" />
      <InlineStack gap="400">
        <TextField label="Text color" value={bs.text_color} onChange={(v) => set("text_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: bs.text_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
        <TextField label="Text size" value={bs.text_size} onChange={(v) => set("text_size", v)} autoComplete="off" helpText="e.g. 16px, 1rem" />
      </InlineStack>
      <InlineStack gap="400">
        <TextField label="Background color" value={bs.bg_color} onChange={(v) => set("bg_color", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: bs.bg_color, borderRadius: 3, border: "1px solid #ccc" }} />} />
        <TextField label="Hover color" value={bs.bg_color_hover} onChange={(v) => set("bg_color_hover", v)} autoComplete="off" prefix={<span style={{ display: "inline-block", width: 16, height: 16, background: bs.bg_color_hover, borderRadius: 3, border: "1px solid #ccc" }} />} />
      </InlineStack>
      <InlineStack gap="400">
        <TextField label="Border color (empty=none)" value={bs.border_color} onChange={(v) => set("border_color", v)} autoComplete="off" />
        <TextField label="Border width" value={bs.border_width} onChange={(v) => set("border_width", v)} autoComplete="off" helpText="e.g. 2px" />
      </InlineStack>
      <TextField label="Border radius" value={bs.border_radius} onChange={(v) => set("border_radius", v)} autoComplete="off" helpText="e.g. 8px, 999px (pill)" />
      <Select
        label="Animation"
        options={[
          { label: "None", value: "none" },
          { label: "Bounce", value: "bounce" },
          { label: "Shake", value: "shake" },
          { label: "Pulse", value: "pulse" },
        ]}
        value={bs.animation}
        onChange={(v) => set("animation", v)}
      />
      <Select
        label="Icon"
        options={[
          { label: "Cash", value: "cash" },
          { label: "Cart", value: "cart" },
          { label: "Truck", value: "truck" },
          { label: "None", value: "none" },
        ]}
        value={bs.icon}
        onChange={(v) => set("icon", v)}
      />
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">Preview</Text>
        <div style={{ padding: "16px", background: "#f5f5f5", borderRadius: 8 }}>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "14px 24px",
              fontSize: bs.text_size,
              fontWeight: 700,
              color: bs.text_color,
              background: bs.bg_color,
              border: bs.border_color ? `${bs.border_width} solid ${bs.border_color}` : "none",
              borderRadius: bs.border_radius,
              cursor: "default",
            }}
          >
            {bs.text || "Comandă cu plata la livrare"}
            {bs.subtitle && (
              <span style={{ display: "block", fontSize: "0.75em", fontWeight: 400, opacity: 0.85 }}>
                {bs.subtitle}
              </span>
            )}
          </button>
        </div>
      </BlockStack>
      <Button variant="primary" onClick={() => save("button_style", bs as unknown as Record<string, unknown>)}>
        Save Button Design
      </Button>
    </FormLayout>
  );
}

function ShippingTab({ draft, setDraft, save }: TabProps) {
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

function FraudTab({ draft, setDraft, save }: TabProps) {
  const fraud: TabProps["draft"]["fraud"] = {
    ...draft.fraud,
    blocked_postal_codes: draft.fraud.blocked_postal_codes ?? [],
    blocked_phones: draft.fraud.blocked_phones ?? [],
    blocked_ips: draft.fraud.blocked_ips ?? [],
  };

  return (
    <FormLayout>
      <TextField
        label="Duplicate window (hours)"
        value={String(fraud.duplicate_window_hours)}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            fraud: {
              ...fraud,
              duplicate_window_hours: Number(v) || 4,
            },
          }))
        }
        type="number"
        autoComplete="off"
      />
      <Checkbox
        label="OTP enabled"
        checked={fraud.otp_enabled}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            fraud: { ...fraud, otp_enabled: v },
          }))
        }
      />
      <BlockStack gap="200">
        <Text as="p" variant="bodySm">
          Blocked postal codes: {fraud.blocked_postal_codes.length}
        </Text>
        <Text as="p" variant="bodySm">
          Per-store blocked phones: {fraud.blocked_phones.length}
        </Text>
        <Text as="p" variant="bodySm">
          Per-store blocked IPs: {fraud.blocked_ips.length}
        </Text>
      </BlockStack>
      <Button
        variant="primary"
        onClick={() => save("fraud", fraud as unknown as Record<string, unknown>)}
      >
        Save Fraud Settings
      </Button>
    </FormLayout>
  );
}

const PIXEL_PROVIDERS = ["facebook", "google", "tiktok", "pinterest", "snapchat"] as const;
const PIXEL_EVENTS = ["purchase", "form_open", "upsell_accept", "bump_accept"] as const;

function PixelsTab({ draft, setDraft, save }: TabProps) {
  const matrix = draft.pixels.event_matrix ?? {};

  return (
    <FormLayout>
      <Text as="h2" variant="headingMd">Facebook</Text>
      <TextField
        label="Facebook Pixel ID"
        value={draft.pixels.fb_pixel_id ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Facebook Access Token (CAPI)"
        value={draft.pixels.fb_access_token ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_access_token: v } }))
        }
        autoComplete="off"
        helpText="Server-side Conversions API token"
      />
      <TextField
        label="Facebook Test Event Code"
        value={draft.pixels.fb_test_event_code ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_test_event_code: v } }))
        }
        autoComplete="off"
        helpText="For testing in Events Manager (leave empty in production)"
      />
      <Divider />
      <Text as="h2" variant="headingMd">Google</Text>
      <TextField
        label="Google Ads Conversion ID"
        value={draft.pixels.gads_conversion_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, gads_conversion_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Google Ads Conversion Label"
        value={draft.pixels.gads_conversion_label ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, gads_conversion_label: v } }))
        }
        autoComplete="off"
        helpText="From Google Ads conversion action setup"
      />
      <TextField
        label="GA4 Measurement ID"
        value={draft.pixels.ga4_measurement_id ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, ga4_measurement_id: v } }))
        }
        autoComplete="off"
        helpText="G-XXXXXXXXXX format"
      />
      <Divider />
      <Text as="h2" variant="headingMd">TikTok</Text>
      <TextField
        label="TikTok Pixel ID"
        value={draft.pixels.tiktok_pixel_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, tiktok_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="TikTok Access Token (Events API)"
        value={draft.pixels.tiktok_access_token ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, tiktok_access_token: v } }))
        }
        autoComplete="off"
        helpText="For server-side event tracking"
      />
      <Divider />
      <Text as="h2" variant="headingMd">Other Pixels</Text>
      <TextField
        label="Pinterest Tag ID"
        value={draft.pixels.pinterest_tag_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, pinterest_tag_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Snapchat Pixel ID"
        value={draft.pixels.snapchat_pixel_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, snapchat_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">Event Matrix</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Control which events fire for each pixel. Unchecked = all events (default).
        </Text>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 4px" }}>Provider</th>
                {PIXEL_EVENTS.map((ev) => (
                  <th key={ev} style={{ padding: "8px 4px", textAlign: "center" }}>{ev}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PIXEL_PROVIDERS.map((prov) => {
                const events = matrix[prov] ?? [];
                return (
                  <tr key={prov}>
                    <td style={{ padding: "4px" }}>{prov}</td>
                    {PIXEL_EVENTS.map((ev) => (
                      <td key={ev} style={{ textAlign: "center", padding: "4px" }}>
                        <input
                          type="checkbox"
                          checked={events.length === 0 || events.includes(ev)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            let newEvents: string[];
                            if (events.length === 0) {
                              newEvents = checked
                                ? [...PIXEL_EVENTS]
                                : PIXEL_EVENTS.filter((x) => x !== ev);
                            } else {
                              newEvents = checked
                                ? [...events, ev]
                                : events.filter((x) => x !== ev);
                            }
                            setDraft((d) => ({
                              ...d,
                              pixels: {
                                ...d.pixels,
                                event_matrix: { ...matrix, [prov]: newEvents },
                              },
                            }));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BlockStack>
      <Button
        variant="primary"
        onClick={() =>
          save("pixels", draft.pixels as unknown as Record<string, unknown>)
        }
      >
        Save Pixel Settings
      </Button>
    </FormLayout>
  );
}

function UpsellsTab({ draft, setDraft, save, storeId }: TabProps) {
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

function BumpsTab({ draft, setDraft, save, storeId }: TabProps) {
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

function DownsellTab({ draft, setDraft, save, storeId }: TabProps) {
  const downsell = draft.downsell || {
    enabled: false,
    message: "",
    discount_code: "",
    button_text: "",
    target_product_ids: [],
  };

  return (
    <FormLayout>
      <Checkbox
        label="Downsell enabled"
        checked={downsell.enabled}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, enabled: v },
          }))
        }
      />
      <TextField
        label="Message"
        value={downsell.message}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, message: v },
          }))
        }
        autoComplete="off"
        helpText="Shown when customer closes form without ordering"
      />
      <TextField
        label="Discount code"
        value={downsell.discount_code}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, discount_code: v },
          }))
        }
        autoComplete="off"
        helpText="Must be a valid Shopify discount code"
      />
      <TextField
        label="Button text"
        value={downsell.button_text}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, button_text: v },
          }))
        }
        autoComplete="off"
      />
      <TextField
        label="Show after N closes"
        value={String(downsell.show_after_closes ?? 1)}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, show_after_closes: Math.max(1, Number(v) || 1) },
          }))
        }
        type="number"
        autoComplete="off"
        helpText="How many times the customer must close the form before the downsell appears"
      />
      <Divider />
      <Text as="p" fontWeight="semibold">Downsell Styling</Text>
      <InlineStack gap="300">
        <TextField
          label="Message color"
          value={downsell.message_color ?? "#333333"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, message_color: v } }))}
          autoComplete="off"
        />
        <TextField
          label="Background color"
          value={downsell.bg_color ?? "#ffffff"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, bg_color: v } }))}
          autoComplete="off"
        />
      </InlineStack>
      <InlineStack gap="300">
        <TextField
          label="Badge background"
          value={downsell.badge_bg_color ?? "#C62828"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, badge_bg_color: v } }))}
          autoComplete="off"
        />
        <TextField
          label="Badge text color"
          value={downsell.badge_text_color ?? "#ffffff"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, badge_text_color: v } }))}
          autoComplete="off"
        />
      </InlineStack>
      <InlineStack gap="300">
        <TextField
          label="Button background"
          value={downsell.button_bg_color ?? "#C62828"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, button_bg_color: v } }))}
          autoComplete="off"
        />
        <TextField
          label="Button text color"
          value={downsell.button_text_color ?? "#ffffff"}
          onChange={(v) => setDraft((d) => ({ ...d, downsell: { ...downsell, button_text_color: v } }))}
          autoComplete="off"
        />
      </InlineStack>
      <Divider />
      <ProductSelector
        storeId={storeId}
        selectedIds={downsell.target_product_ids ?? []}
        onChange={(ids) =>
          setDraft((d) => ({
            ...d,
            downsell: { ...downsell, target_product_ids: ids },
          }))
        }
        label="Show downsell for"
        helpText="Select which products this downsell appears on. Empty = all products."
      />
      <Button
        variant="primary"
        onClick={() =>
          save(
            "downsell",
            downsell as unknown as Record<string, unknown>
          )
        }
      >
        Save Downsell
      </Button>
    </FormLayout>
  );
}

const DEFAULTS_PREPAID = {
  enabled: false,
  button_text: "Plătește online",
  discount_type: "percentage",
  discount_value: 0,
  discount_code: "",
  discount_label: "",
};

function PrepaidTab({ draft, setDraft, save }: TabProps) {
  const pp = draft.prepaid ?? DEFAULTS_PREPAID;
  const set = (key: string, v: unknown) =>
    setDraft((d) => ({ ...d, prepaid: { ...pp, [key]: v } }));

  return (
    <FormLayout>
      <Checkbox
        label="Enable prepaid button"
        checked={pp.enabled}
        onChange={(v) => set("enabled", v)}
      />
      <TextField
        label="Button text"
        value={pp.button_text}
        onChange={(v) => set("button_text", v)}
        autoComplete="off"
      />
      <Select
        label="Discount type"
        options={[
          { label: "Percentage", value: "percentage" },
          { label: "Fixed amount (RON)", value: "fixed" },
        ]}
        value={pp.discount_type}
        onChange={(v) => set("discount_type", v)}
      />
      <TextField
        label="Discount value"
        value={String(pp.discount_value)}
        onChange={(v) => set("discount_value", Number(v) || 0)}
        type="number"
        autoComplete="off"
        helpText={pp.discount_type === "percentage" ? "e.g. 5 for 5%" : "e.g. 10 for 10 RON off"}
      />
      <TextField
        label="Shopify discount code"
        value={pp.discount_code}
        onChange={(v) => set("discount_code", v)}
        autoComplete="off"
        helpText="Must exist as a valid Shopify discount"
      />
      <TextField
        label="Discount label (shown to customer)"
        value={pp.discount_label}
        onChange={(v) => set("discount_label", v)}
        autoComplete="off"
        helpText='e.g. "5% reducere la plata online"'
      />
      <Button
        variant="primary"
        onClick={() =>
          save("prepaid", pp as unknown as Record<string, unknown>)
        }
      >
        Save Prepaid Settings
      </Button>
    </FormLayout>
  );
}

function SettingsTab({ draft, setDraft, save }: TabProps) {
  const settings = draft.settings;
  const [newAllowedId, setNewAllowedId] = useState("");
  const [newExcludedId, setNewExcludedId] = useState("");

  const set = (key: string, v: unknown) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: v } }));

  return (
    <FormLayout>
      <Text as="h2" variant="headingMd">General</Text>
      <Checkbox label="Hide Shopify checkout button" checked={settings.hide_checkout_button} onChange={(v) => set("hide_checkout_button", v)} />
      <Checkbox label="Hide buy now button" checked={settings.hide_buy_now_button} onChange={(v) => set("hide_buy_now_button", v)} />
      <Checkbox label="Show on cart page" checked={settings.show_on_cart_page} onChange={(v) => set("show_on_cart_page", v)} />
      <Checkbox label="Enable discount codes" checked={settings.enable_discount_codes} onChange={(v) => set("enable_discount_codes", v)} />
      <Checkbox label="Disable for out-of-stock products" checked={settings.disable_for_oos} onChange={(v) => set("disable_for_oos", v)} />
      <Checkbox label="Mobile sticky buy button" checked={settings.sticky_buy_button} onChange={(v) => set("sticky_buy_button", v)} />
      <Select label="Post-order redirect" options={[
        { label: "Thank you page (in-form)", value: "thank_you" },
        { label: "Custom URL", value: "custom_url" },
      ]} value={settings.post_order_redirect} onChange={(v) => set("post_order_redirect", v)} />
      {settings.post_order_redirect === "custom_url" && (
        <TextField label="Custom redirect URL" value={settings.custom_redirect_url} onChange={(v) => set("custom_redirect_url", v)} autoComplete="off" />
      )}
      <TextField label="Custom CSS" value={settings.custom_css} onChange={(v) => set("custom_css", v)} autoComplete="off" multiline={4} helpText="Injected into the form overlay" />

      <Divider />
      <Text as="h2" variant="headingMd">COD Fee / Surcharge</Text>
      <InlineStack gap="400">
        <TextField label="COD fee (RON)" value={String(settings.cod_fee ?? 0)} onChange={(v) => set("cod_fee", Number(v) || 0)} type="number" autoComplete="off" helpText="Extra fee for cash-on-delivery (0 = disabled)" />
        <TextField label="Fee label" value={settings.cod_fee_label ?? "Taxă ramburs"} onChange={(v) => set("cod_fee_label", v)} autoComplete="off" helpText="Shown on the order summary" />
      </InlineStack>

      <Divider />
      <Text as="h2" variant="headingMd">Abandoned Form Recovery</Text>
      <Checkbox label="Enable abandoned form recovery" checked={settings.abandoned_recovery_enabled} onChange={(v) => set("abandoned_recovery_enabled", v)} />
      <InlineStack gap="400">
        <TextField label="Delay (minutes)" value={String(settings.abandoned_recovery_delay_minutes)} onChange={(v) => set("abandoned_recovery_delay_minutes", Number(v) || 30)} type="number" autoComplete="off" />
        <TextField label="Max reminders/day" value={String(settings.abandoned_recovery_max_per_day)} onChange={(v) => set("abandoned_recovery_max_per_day", Number(v) || 50)} type="number" autoComplete="off" />
      </InlineStack>

      <Text as="h2" variant="headingMd">Google Address Autocomplete</Text>
      <Checkbox label="Enable address autocomplete" checked={settings.address_autocomplete_enabled} onChange={(v) => set("address_autocomplete_enabled", v)} />
      <TextField label="Google Places API key" value={settings.google_places_api_key} onChange={(v) => set("google_places_api_key", v)} autoComplete="off" helpText="Get from Google Cloud Console → APIs & Services → Credentials" />

      <Text as="h2" variant="headingMd">Product Restrictions</Text>
      <Select label="Restrict mode" options={[
        { label: "All products (no restriction)", value: "all" },
        { label: "Include only (whitelist)", value: "include" },
        { label: "Exclude (blacklist)", value: "exclude" },
      ]} value={settings.restrict_mode} onChange={(v) => set("restrict_mode", v)} />
      {settings.restrict_mode === "include" && (
        <BlockStack gap="200">
          <Text as="p" variant="bodySm">Allowed product IDs (COD form only shows on these):</Text>
          <InlineStack gap="200">
            {(settings.allowed_product_ids || []).map((id) => (
              <Tag key={id} onRemove={() => set("allowed_product_ids", (settings.allowed_product_ids || []).filter((x) => x !== id))}>
                {String(id)}
              </Tag>
            ))}
          </InlineStack>
          <InlineStack gap="200">
            <TextField label="" value={newAllowedId} onChange={setNewAllowedId} placeholder="Product ID" autoComplete="off" />
            <Button onClick={() => {
              const id = Number(newAllowedId);
              if (id && !(settings.allowed_product_ids || []).includes(id)) {
                set("allowed_product_ids", [...(settings.allowed_product_ids || []), id]);
                setNewAllowedId("");
              }
            }}>Add</Button>
          </InlineStack>
        </BlockStack>
      )}
      {settings.restrict_mode === "exclude" && (
        <BlockStack gap="200">
          <Text as="p" variant="bodySm">Excluded product IDs (COD form hidden on these):</Text>
          <InlineStack gap="200">
            {(settings.excluded_product_ids || []).map((id) => (
              <Tag key={id} onRemove={() => set("excluded_product_ids", (settings.excluded_product_ids || []).filter((x) => x !== id))}>
                {String(id)}
              </Tag>
            ))}
          </InlineStack>
          <InlineStack gap="200">
            <TextField label="" value={newExcludedId} onChange={setNewExcludedId} placeholder="Product ID" autoComplete="off" />
            <Button onClick={() => {
              const id = Number(newExcludedId);
              if (id && !(settings.excluded_product_ids || []).includes(id)) {
                set("excluded_product_ids", [...(settings.excluded_product_ids || []), id]);
                setNewExcludedId("");
              }
            }}>Add</Button>
          </InlineStack>
        </BlockStack>
      )}

      <Button variant="primary" onClick={() => save("settings", settings as unknown as Record<string, unknown>)}>
        Save Settings
      </Button>
    </FormLayout>
  );
}

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

function OffersTab({ draft, setDraft, save, storeId }: TabProps) {
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
        {/* ── Offer Groups ── */}
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

        {/* ── Design Template ── */}
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

        {/* ── Color Presets ── */}
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
