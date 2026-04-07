import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  Text,
} from "@shopify/polaris";
import type { TabProps } from "./types";

export function FraudTab({ draft, setDraft, save }: TabProps) {
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
