import { useCallback, useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Select,
  Button,
  ProgressBar,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useUpdateConfigSection } from "../api/hooks";
import { useStore } from "../context/StoreContext";
import { FormPreview } from "../components/FormPreview";
import type { StoreConfig } from "../api/types";

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Romanian", value: "ro" },
  { label: "Greek", value: "el" },
  { label: "Polish", value: "pl" },
  { label: "Turkish", value: "tr" },
  { label: "Arabic", value: "ar" },
  { label: "Portuguese (BR)", value: "pt-BR" },
  { label: "Spanish", value: "es" },
  { label: "Italian", value: "it" },
  { label: "Bulgarian", value: "bg" },
  { label: "Hungarian", value: "hu" },
  { label: "Czech", value: "cs" },
  { label: "Croatian", value: "hr" },
  { label: "Slovak", value: "sk" },
];

const CURRENCIES = [
  { label: "USD ($)", value: "USD" },
  { label: "EUR (€)", value: "EUR" },
  { label: "RON (lei)", value: "RON" },
  { label: "PLN (zł)", value: "PLN" },
  { label: "TRY (₺)", value: "TRY" },
  { label: "BRL (R$)", value: "BRL" },
  { label: "GBP (£)", value: "GBP" },
  { label: "SAR (﷼)", value: "SAR" },
  { label: "AED (د.إ)", value: "AED" },
  { label: "EGP (E£)", value: "EGP" },
  { label: "MXN ($)", value: "MXN" },
  { label: "COP ($)", value: "COP" },
  { label: "ARS ($)", value: "ARS" },
  { label: "BGN (лв)", value: "BGN" },
  { label: "HUF (Ft)", value: "HUF" },
  { label: "CZK (Kč)", value: "CZK" },
  { label: "HRK (€)", value: "HRK" },
];

const STEPS = [
  "Language & Currency",
  "Shipping",
  "Button Style",
  "Preview",
  "Go Live",
];

// Minimal defaults — full types filled at save time
const DEFAULT_BUTTON = {
  text: "Order Now — Cash on Delivery",
  subtitle: "Pay on delivery",
  text_color: "#ffffff",
  text_size: "16px",
  bg_color: "#b5a1e0",
  bg_color_hover: "#6a6095",
  border_color: "",
  border_width: "0px",
  border_radius: "8px",
  icon: "arrow",
  animation: "none",
};

const DEFAULT_FORM_STYLE = {
  bg_color: "#ffffff",
  text_color: "#333333",
  header_text_color: "#111111",
  label_color: "#555555",
  border_radius: "12px",
  max_width: "480px",
  overlay_opacity: "0.5",
  product_image_size: "80px",
  accent_color: "#b5a1e0",
};

export function Onboarding() {
  const { storeId } = useStore();
  const updateSection = useUpdateConfigSection(storeId);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
  const [shippingRate, setShippingRate] = useState("5.00");
  const [freeThreshold, setFreeThreshold] = useState("0");
  const [buttonText, setButtonText] = useState("Order Now — Cash on Delivery");
  const [buttonSubtitle, setButtonSubtitle] = useState("Pay on delivery");
  const [buttonColor, setButtonColor] = useState("#b5a1e0");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const progress = ((step + 1) / STEPS.length) * 100;

  const previewConfig = {
    shipping: { default_rate: shippingRate, free_threshold: Number(freeThreshold) || 0, province_rates: {}, rates: [] },
    button_style: {
      ...DEFAULT_BUTTON,
      text: buttonText,
      subtitle: buttonSubtitle,
      bg_color: buttonColor,
    },
    form_style: DEFAULT_FORM_STYLE,
    form: { enabled: true, button_text: buttonText },
    settings: { cod_fee: 0, cod_fee_label: "" },
  } as unknown as StoreConfig;

  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      // Save all config sections
      const sections: [string, Record<string, unknown>][] = [
        ["form", { enabled: true, button_text: buttonText, custom_note_prefix: "COD Order", tags: ["cod-form"], layout: [] }],
        ["shipping", { default_rate: shippingRate, free_threshold: Number(freeThreshold) || 0, province_rates: {}, rates: [] }],
        ["button_style", { ...DEFAULT_BUTTON, text: buttonText, subtitle: buttonSubtitle, bg_color: buttonColor }],
        ["form_style", DEFAULT_FORM_STYLE],
        ["settings", { hide_checkout_button: true, hide_buy_now_button: true, enable_discount_codes: true, disable_for_oos: true, sticky_buy_button: true, cod_fee: 0 }],
        ["fraud", { duplicate_window_hours: 4, duplicate_window_minutes: 0, blocked_postal_codes: [], blocked_phones: [], blocked_ips: [], otp_enabled: false }],
      ];
      for (const [section, data] of sections) {
        updateSection.mutate({ section, data });
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }, [buttonText, buttonSubtitle, buttonColor, shippingRate, freeThreshold, updateSection]);

  if (done) {
    return (
      <Page title="Setup Complete!">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Banner tone="success">
                  Your COD form is ready! Go to your Shopify theme editor to add the COD Form APP block to your product pages.
                </Banner>
                <Text as="p">
                  Next steps:
                </Text>
                <BlockStack gap="200">
                  <Text as="p">1. Go to your Shopify admin &rarr; Online Store &rarr; Themes &rarr; Customize</Text>
                  <Text as="p">2. Navigate to a product page template</Text>
                  <Text as="p">3. Add the "COD Form APP" block</Text>
                  <Text as="p">4. Save and publish</Text>
                </BlockStack>
                <Button variant="primary" url="/admin/config">
                  Go to Advanced Config
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Welcome to COD Form APP">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </Text>
              <ProgressBar progress={progress} size="small" tone="primary" />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <div style={{ padding: 16 }}>
                  {step === 0 && (
                    <BlockStack gap="400">
                      <Text as="p">Choose the language and currency for your COD order form.</Text>
                      <Select
                        label="Form Language"
                        options={LANGUAGES}
                        value={language}
                        onChange={setLanguage}
                      />
                      <Select
                        label="Currency"
                        options={CURRENCIES}
                        value={currency}
                        onChange={setCurrency}
                      />
                    </BlockStack>
                  )}

                  {step === 1 && (
                    <BlockStack gap="400">
                      <Text as="p">Set your shipping rates. You can add more complex rules later.</Text>
                      <TextField
                        label="Default shipping rate"
                        value={shippingRate}
                        onChange={setShippingRate}
                        autoComplete="off"
                        suffix={currency}
                      />
                      <TextField
                        label="Free shipping threshold (0 = disabled)"
                        value={freeThreshold}
                        onChange={setFreeThreshold}
                        autoComplete="off"
                        type="number"
                        suffix={currency}
                        helpText="Orders above this amount get free shipping"
                      />
                    </BlockStack>
                  )}

                  {step === 2 && (
                    <BlockStack gap="400">
                      <Text as="p">Customize your order button appearance.</Text>
                      <TextField
                        label="Button text"
                        value={buttonText}
                        onChange={setButtonText}
                        autoComplete="off"
                      />
                      <TextField
                        label="Button subtitle"
                        value={buttonSubtitle}
                        onChange={setButtonSubtitle}
                        autoComplete="off"
                      />
                      <TextField
                        label="Button color"
                        value={buttonColor}
                        onChange={setButtonColor}
                        autoComplete="off"
                        type="text"
                        prefix="Color"
                      />
                    </BlockStack>
                  )}

                  {step === 3 && (
                    <BlockStack gap="400">
                      <Text as="p">Here is a preview of your COD order form. You can fine-tune everything in the advanced config later.</Text>
                      <Banner tone="info">
                        This is a visual preview. The actual form will match your theme and product data.
                      </Banner>
                    </BlockStack>
                  )}

                  {step === 4 && (
                    <BlockStack gap="400">
                      <Text as="p" variant="headingMd">Ready to go live!</Text>
                      <Text as="p">
                        Click "Save & Finish" to save your configuration. Then add the COD Form APP block to your product page templates in the Shopify theme editor.
                      </Text>
                      <Divider />
                      <BlockStack gap="200">
                        <Text as="p"><strong>Language:</strong> {LANGUAGES.find(l => l.value === language)?.label}</Text>
                        <Text as="p"><strong>Currency:</strong> {currency}</Text>
                        <Text as="p"><strong>Shipping:</strong> {shippingRate} {currency}</Text>
                        <Text as="p"><strong>Free shipping above:</strong> {Number(freeThreshold) > 0 ? `${freeThreshold} ${currency}` : "Disabled"}</Text>
                        <Text as="p"><strong>Button:</strong> {buttonText}</Text>
                      </BlockStack>
                    </BlockStack>
                  )}

                  <div style={{ marginTop: 24 }}>
                    <InlineStack gap="300" align="end">
                      {step > 0 && (
                        <Button onClick={() => setStep(step - 1)}>Back</Button>
                      )}
                      {step < STEPS.length - 1 && (
                        <Button variant="primary" onClick={() => setStep(step + 1)}>
                          Continue
                        </Button>
                      )}
                      {step === STEPS.length - 1 && (
                        <Button variant="primary" onClick={saveAll} loading={saving}>
                          Save & Finish
                        </Button>
                      )}
                    </InlineStack>
                  </div>
                </div>
              </Card>
            </div>

            {(step === 2 || step === 3) && (
              <div style={{ flexShrink: 0 }}>
                <FormPreview config={previewConfig} />
              </div>
            )}
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
