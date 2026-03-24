import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Tag,
  Tabs,
} from "@shopify/polaris";
import {
  useBlacklist,
  useAddToBlacklist,
  useRemoveFromBlacklist,
} from "../api/hooks";

export function Blacklists() {
  const [tabIndex, setTabIndex] = useState(0);
  const blType = tabIndex === 0 ? ("phones" as const) : ("ips" as const);

  const tabs = [
    { id: "phones", content: "Phone Blacklist" },
    { id: "ips", content: "IP Blacklist" },
  ];

  return (
    <Page title="Blacklists">
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>
              <div style={{ padding: "16px" }}>
                <BlacklistPanel type={blType} />
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function BlacklistPanel({ type }: { type: "phones" | "ips" }) {
  const [newValue, setNewValue] = useState("");
  const { data, isLoading } = useBlacklist(type);
  const addMutation = useAddToBlacklist(type);
  const removeMutation = useRemoveFromBlacklist(type);

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    addMutation.mutate(v);
    setNewValue("");
  };

  if (isLoading) return <Text as="p">Loading...</Text>;

  return (
    <BlockStack gap="400">
      <InlineStack gap="200" blockAlign="end">
        <div style={{ flex: 1 }}>
          <TextField
            label={type === "phones" ? "Phone number" : "IP address"}
            value={newValue}
            onChange={setNewValue}
            placeholder={type === "phones" ? "0712345678" : "1.2.3.4"}
            autoComplete="off"
          />
        </div>
        <Button variant="primary" onClick={handleAdd}>
          Add
        </Button>
      </InlineStack>

      <Text as="p" variant="bodySm" tone="subdued">
        {data?.items.length ?? 0} entries (shared across all stores)
      </Text>

      <InlineStack gap="200" wrap>
        {data?.items.map((item) => (
          <Tag key={item} onRemove={() => removeMutation.mutate(item)}>
            {item}
          </Tag>
        ))}
      </InlineStack>
    </BlockStack>
  );
}
