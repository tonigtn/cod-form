import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Tabs,
  Banner,
  Text,
} from "@shopify/polaris";
import { useStoreConfig, useUpdateConfigSection, useStoreLocale } from "../api/hooks";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";
import { FormPreview } from "../components/FormPreview";
import { OffersPreview } from "../components/OffersPreview";
import type { StoreConfig } from "../api/types";
import {
  FormTab,
  ButtonStyleTab,
  ShippingTab,
  FraudTab,
  PixelsTab,
  OffersTab,
  UpsellsTab,
  BumpsTab,
  DownsellTab,
  PrepaidTab,
  SettingsTab,
} from "../components/config";

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
              Config saved successfully.
            </Banner>
          </Layout.Section>
        )}
        {updateSection.isError && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => updateSection.reset()}>
              Failed to save config. Please try again.
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
                      <FormTab draft={draft} setDraft={setDraft} save={save} storeId={storeId} locale={localeData?.locale} />
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
