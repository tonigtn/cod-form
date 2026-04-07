import {
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Select,
} from "@shopify/polaris";
import type { TabProps } from "./types";

export const DEFAULTS_BUTTON = {
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

export const DEFAULTS_FORM_STYLE = {
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

export function ButtonStyleTab({ draft, setDraft, save }: TabProps) {
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
