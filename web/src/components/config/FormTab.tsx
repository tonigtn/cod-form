import {
  FormLayout,
  Checkbox,
  TextField,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Tag,
} from "@shopify/polaris";
import { FormBuilder, DEFAULT_FIELDS } from "../FormBuilder";
import type { FormField } from "../../api/types";
import type { TabProps } from "./types";
import { DEFAULTS_FORM_STYLE } from "./ButtonStyleTab";

export function FormTab({ draft, setDraft, save, locale }: TabProps) {
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
        label="Free shipping announcement"
        value={draft.settings?.announcement_text || locale?.labels?.announcement || ""}
        onChange={(v) =>
          setDraft((d) => ({
            ...d,
            settings: { ...d.settings, announcement_text: v },
          }))
        }
        autoComplete="off"
        helpText="Shown at the top of the form. Leave empty to hide."
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
          locale={locale}
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
