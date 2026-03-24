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
  Select,
} from "@shopify/polaris";
import { useStoreConfig, useUpdateConfigSection } from "../api/hooks";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";
import type { StoreConfig } from "../api/types";

export function Settings() {
  const { storeId } = useStore();
  const [tabIndex, setTabIndex] = useState(0);
  const { data: config, isLoading } = useStoreConfig(storeId);
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
    { id: "general", content: "General" },
    { id: "visibility", content: "Visibility" },
    { id: "pixels", content: "Pixels" },
    { id: "fraud", content: "Fraud" },
  ];

  if (isLoading || !draft) {
    return (
      <Page title="Settings">
        <Text as="p">Loading...</Text>
      </Page>
    );
  }

  const settings = draft.settings || {
    post_order_redirect: "thank_you",
    custom_redirect_url: "",
    hide_checkout_button: true,
    hide_buy_now_button: true,
    show_on_cart_page: false,
    custom_css: "",
    enable_discount_codes: true,
    disable_for_oos: true,
  };

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <OwnerStoreSelector />
        </Layout.Section>

        {updateSection.isSuccess && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => updateSection.reset()}>
              Settings saved.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>
              <div style={{ padding: "16px" }}>
                {tabIndex === 0 && (
                  <FormLayout>
                    <Select
                      label="Post-order redirect"
                      options={[
                        { label: "Thank You page (default)", value: "thank_you" },
                        { label: "Custom URL", value: "custom_url" },
                      ]}
                      value={settings.post_order_redirect}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, post_order_redirect: v },
                        }))
                      }
                    />
                    {settings.post_order_redirect === "custom_url" && (
                      <TextField
                        label="Custom redirect URL"
                        value={settings.custom_redirect_url}
                        onChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            settings: { ...settings, custom_redirect_url: v },
                          }))
                        }
                        autoComplete="off"
                        placeholder="https://..."
                      />
                    )}
                    <Checkbox
                      label="Enable discount codes in form"
                      checked={settings.enable_discount_codes}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, enable_discount_codes: v },
                        }))
                      }
                    />
                    <Checkbox
                      label="Disable form for out-of-stock products"
                      checked={settings.disable_for_oos}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, disable_for_oos: v },
                        }))
                      }
                    />
                    <Button
                      variant="primary"
                      onClick={() =>
                        save("settings", settings as unknown as Record<string, unknown>)
                      }
                    >
                      Save General Settings
                    </Button>
                  </FormLayout>
                )}

                {tabIndex === 1 && (
                  <FormLayout>
                    <Checkbox
                      label="Hide Checkout button"
                      checked={settings.hide_checkout_button}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, hide_checkout_button: v },
                        }))
                      }
                    />
                    <Checkbox
                      label="Hide Buy Now button"
                      checked={settings.hide_buy_now_button}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, hide_buy_now_button: v },
                        }))
                      }
                    />
                    <Checkbox
                      label="Show form on cart page"
                      checked={settings.show_on_cart_page}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, show_on_cart_page: v },
                        }))
                      }
                    />
                    <Button
                      variant="primary"
                      onClick={() =>
                        save("settings", settings as unknown as Record<string, unknown>)
                      }
                    >
                      Save Visibility Settings
                    </Button>
                  </FormLayout>
                )}

                {tabIndex === 2 && (
                  <FormLayout>
                    <TextField
                      label="Google Ads Conversion ID"
                      value={draft.pixels.gads_conversion_id}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          pixels: { ...d.pixels, gads_conversion_id: v },
                        }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="TikTok Pixel ID"
                      value={draft.pixels.tiktok_pixel_id}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          pixels: { ...d.pixels, tiktok_pixel_id: v },
                        }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Pinterest Tag ID"
                      value={draft.pixels.pinterest_tag_id}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          pixels: { ...d.pixels, pinterest_tag_id: v },
                        }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Snapchat Pixel ID"
                      value={draft.pixels.snapchat_pixel_id}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          pixels: { ...d.pixels, snapchat_pixel_id: v },
                        }))
                      }
                      autoComplete="off"
                    />
                    <Button
                      variant="primary"
                      onClick={() =>
                        save("pixels", draft.pixels as unknown as Record<string, unknown>)
                      }
                    >
                      Save Pixel IDs
                    </Button>
                  </FormLayout>
                )}

                {tabIndex === 3 && (
                  <FormLayout>
                    <TextField
                      label="Duplicate window (hours)"
                      value={String(draft.fraud.duplicate_window_hours)}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          fraud: {
                            ...d.fraud,
                            duplicate_window_hours: Number(v) || 4,
                          },
                        }))
                      }
                      type="number"
                      autoComplete="off"
                    />
                    <Checkbox
                      label="OTP verification enabled"
                      checked={draft.fraud.otp_enabled}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          fraud: { ...d.fraud, otp_enabled: v },
                        }))
                      }
                    />
                    <BlockStack gap="200">
                      <Text as="p" variant="bodySm">
                        Blocked postal codes: {(draft.fraud.blocked_postal_codes ?? []).length}
                      </Text>
                      <Text as="p" variant="bodySm">
                        Per-store blocked phones: {(draft.fraud.blocked_phones ?? []).length}
                      </Text>
                      <Text as="p" variant="bodySm">
                        Per-store blocked IPs: {(draft.fraud.blocked_ips ?? []).length}
                      </Text>
                    </BlockStack>
                    <Button
                      variant="primary"
                      onClick={() =>
                        save("fraud", draft.fraud as unknown as Record<string, unknown>)
                      }
                    >
                      Save Fraud Settings
                    </Button>
                  </FormLayout>
                )}

                {/* Custom CSS — always visible at bottom */}
                {tabIndex === 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <TextField
                      label="Custom CSS"
                      value={settings.custom_css}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          settings: { ...settings, custom_css: v },
                        }))
                      }
                      multiline={4}
                      autoComplete="off"
                      helpText="Injected into the form popup for custom styling"
                    />
                  </div>
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
