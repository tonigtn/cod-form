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
  Select,
  Divider,
} from "@shopify/polaris";
import type { TabProps } from "./types";

export function SettingsTab({ draft, setDraft, save }: TabProps) {
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
