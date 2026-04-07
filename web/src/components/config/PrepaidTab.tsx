import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Select,
} from "@shopify/polaris";
import type { TabProps } from "./types";

const DEFAULTS_PREPAID = {
  enabled: false,
  button_text: "Plătește online",
  discount_type: "percentage",
  discount_value: 0,
  discount_code: "",
  discount_label: "",
};

export function PrepaidTab({ draft, setDraft, save }: TabProps) {
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
