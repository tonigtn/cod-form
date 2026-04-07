import {
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Divider,
} from "@shopify/polaris";
import type { TabProps } from "./types";

const PIXEL_PROVIDERS = ["facebook", "google", "tiktok", "pinterest", "snapchat"] as const;
const PIXEL_EVENTS = ["purchase", "form_open", "upsell_accept", "bump_accept"] as const;

export function PixelsTab({ draft, setDraft, save }: TabProps) {
  const matrix = draft.pixels.event_matrix ?? {};

  return (
    <FormLayout>
      <Text as="h2" variant="headingMd">Facebook</Text>
      <TextField
        label="Facebook Pixel ID"
        value={draft.pixels.fb_pixel_id ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Facebook Access Token (CAPI)"
        value={draft.pixels.fb_access_token ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_access_token: v } }))
        }
        autoComplete="off"
        helpText="Server-side Conversions API token"
      />
      <TextField
        label="Facebook Test Event Code"
        value={draft.pixels.fb_test_event_code ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, fb_test_event_code: v } }))
        }
        autoComplete="off"
        helpText="For testing in Events Manager (leave empty in production)"
      />
      <Divider />
      <Text as="h2" variant="headingMd">Google</Text>
      <TextField
        label="Google Ads Conversion ID"
        value={draft.pixels.gads_conversion_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, gads_conversion_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Google Ads Conversion Label"
        value={draft.pixels.gads_conversion_label ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, gads_conversion_label: v } }))
        }
        autoComplete="off"
        helpText="From Google Ads conversion action setup"
      />
      <TextField
        label="GA4 Measurement ID"
        value={draft.pixels.ga4_measurement_id ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, ga4_measurement_id: v } }))
        }
        autoComplete="off"
        helpText="G-XXXXXXXXXX format"
      />
      <Divider />
      <Text as="h2" variant="headingMd">TikTok</Text>
      <TextField
        label="TikTok Pixel ID"
        value={draft.pixels.tiktok_pixel_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, tiktok_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="TikTok Access Token (Events API)"
        value={draft.pixels.tiktok_access_token ?? ""}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, tiktok_access_token: v } }))
        }
        autoComplete="off"
        helpText="For server-side event tracking"
      />
      <Divider />
      <Text as="h2" variant="headingMd">Other Pixels</Text>
      <TextField
        label="Pinterest Tag ID"
        value={draft.pixels.pinterest_tag_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, pinterest_tag_id: v } }))
        }
        autoComplete="off"
      />
      <TextField
        label="Snapchat Pixel ID"
        value={draft.pixels.snapchat_pixel_id}
        onChange={(v) =>
          setDraft((d) => ({ ...d, pixels: { ...d.pixels, snapchat_pixel_id: v } }))
        }
        autoComplete="off"
      />
      <BlockStack gap="300">
        <Text as="p" fontWeight="semibold">Event Matrix</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Control which events fire for each pixel. Unchecked = all events (default).
        </Text>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 4px" }}>Provider</th>
                {PIXEL_EVENTS.map((ev) => (
                  <th key={ev} style={{ padding: "8px 4px", textAlign: "center" }}>{ev}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PIXEL_PROVIDERS.map((prov) => {
                const events = matrix[prov] ?? [];
                return (
                  <tr key={prov}>
                    <td style={{ padding: "4px" }}>{prov}</td>
                    {PIXEL_EVENTS.map((ev) => (
                      <td key={ev} style={{ textAlign: "center", padding: "4px" }}>
                        <input
                          type="checkbox"
                          checked={events.length === 0 || events.includes(ev)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            let newEvents: string[];
                            if (events.length === 0) {
                              newEvents = checked
                                ? [...PIXEL_EVENTS]
                                : PIXEL_EVENTS.filter((x) => x !== ev);
                            } else {
                              newEvents = checked
                                ? [...events, ev]
                                : events.filter((x) => x !== ev);
                            }
                            setDraft((d) => ({
                              ...d,
                              pixels: {
                                ...d.pixels,
                                event_matrix: { ...matrix, [prov]: newEvents },
                              },
                            }));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BlockStack>
      <Button
        variant="primary"
        onClick={() =>
          save("pixels", draft.pixels as unknown as Record<string, unknown>)
        }
      >
        Save Pixel Settings
      </Button>
    </FormLayout>
  );
}
