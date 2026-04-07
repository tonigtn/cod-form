import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  InlineStack,
  Text,
  Divider,
} from "@shopify/polaris";
import { ProductSelector } from "./ProductSelector";
import type { TabProps } from "./types";

export function DownsellTab({ draft, setDraft, save, storeId }: TabProps) {
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
