import type { StoreConfig, FormField } from "../api/types";

const DEFAULT_PREVIEW_FIELDS: FormField[] = [
  { id: "first_name", label: "First Name", placeholder: "", field_type: "text", visible: true, required: true, order: 0, half_width: false, options: [] },
  { id: "last_name", label: "Last Name", placeholder: "", field_type: "text", visible: true, required: true, order: 1, half_width: false, options: [] },
  { id: "phone", label: "Phone", placeholder: "", field_type: "tel", visible: true, required: true, order: 2, half_width: false, options: [] },
  { id: "province", label: "Province", placeholder: "", field_type: "select", visible: true, required: true, order: 3, half_width: false, options: [] },
  { id: "city", label: "City", placeholder: "", field_type: "text", visible: true, required: true, order: 4, half_width: false, options: [] },
  { id: "address1", label: "Address", placeholder: "", field_type: "text", visible: true, required: true, order: 5, half_width: false, options: [] },
  { id: "zip", label: "Postal Code", placeholder: "", field_type: "text", visible: false, required: false, order: 6, half_width: false, options: [] },
  { id: "email", label: "Email", placeholder: "", field_type: "email", visible: true, required: false, order: 7, half_width: false, options: [] },
];

interface Props {
  config: StoreConfig;
}

export function FormPreview({ config }: Props) {
  const bs = config.button_style;
  const fs = config.form_style;
  const pp = config.prepaid;

  const rawFields = config.form.layout?.fields?.length
    ? config.form.layout.fields
    : DEFAULT_PREVIEW_FIELDS;
  const fields = [...rawFields]
    .filter((f) => f.visible)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const accent = fs?.accent_color || bs?.bg_color || "#b5a1e0";
  const shippingRate = config.shipping?.default_rate || "19.99";

  return (
    <div style={{ position: "sticky", top: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const,
        letterSpacing: "0.05em", color: "#6d7175", marginBottom: 8,
      }}>
        Live Preview
      </div>

      {/* Phone frame */}
      <div style={{
        width: 340, background: "#f6f6f7", borderRadius: 24,
        border: "2px solid #e1e3e5", padding: "16px 10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        {/* Notch */}
        <div style={{ width: 80, height: 6, background: "#d2d5d8", borderRadius: 3, margin: "0 auto 12px" }} />

        {/* Trigger button */}
        <div style={{ padding: "0 6px", marginBottom: 12 }}>
          <button type="button" style={{
            display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
            gap: 10, width: "100%", minHeight: 54, padding: "14px 20px",
            fontSize: bs?.text_size || "16px", fontWeight: 700, lineHeight: 1.3,
            color: bs?.text_color || "#fff", background: bs?.bg_color || accent,
            border: bs?.border_color ? `${bs.border_width || "1px"} solid ${bs.border_color}` : "none",
            borderRadius: bs?.border_radius || "12px", cursor: "default", fontFamily: "inherit",
          }}>
            {bs?.icon === "arrow" && <span style={{ fontSize: 18 }}>→</span>}
            {bs?.icon && bs.icon !== "none" && bs.icon !== "arrow" && (
              <span style={{ fontSize: 16 }}>
                {bs.icon === "cash" ? "💵" : bs.icon === "cart" ? "🛒" : bs.icon === "truck" ? "🚚" : ""}
              </span>
            )}
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span>{bs?.text || config.form.button_text || "Comand\u0103 acum"}</span>
              {bs?.subtitle && (
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.9, marginTop: 2 }}>{bs.subtitle}</span>
              )}
            </span>
          </button>
        </div>

        {/* Form popup */}
        <div style={{
          background: fs?.bg_color || "#fff",
          borderRadius: fs?.border_radius || "12px",
          padding: 18, margin: "0 4px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
          color: fs?.text_color || "#333",
          position: "relative",
          maxHeight: 500, overflowY: "auto",
        }}>
          {/* Close button */}
          <div style={{ position: "absolute", top: 10, right: 12, fontSize: 20, color: "#999", cursor: "default", lineHeight: 1 }}>×</div>

          {/* Announcement */}
          <div style={{
            textAlign: "center", fontSize: 14, fontWeight: 600,
            padding: "10px 30px 10px 10px", margin: "-18px -18px 14px -18px",
            background: "#f9fafb", borderRadius: "12px 12px 0 0",
            borderBottom: "1px solid #e5e7eb",
          }}>
            Free shipping announcement
          </div>

          {/* Form fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {fields.map((f) => (
              <div key={f.id}>
                <div style={{ fontSize: 13, fontWeight: 600, color: fs?.label_color || "#333", marginBottom: 4 }}>
                  {f.label || f.id}
                  {f.required && <span style={{ color: "#e53935", marginLeft: 2 }}>*</span>}
                </div>
                {f.field_type === "select" ? (
                  <div style={{
                    padding: "10px 12px", fontSize: 14, border: "1px solid #ddd",
                    borderRadius: 8, background: "#fff", color: "#999",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{f.placeholder || "— Select —"}</span>
                    <span>▾</span>
                  </div>
                ) : (
                  <div style={{
                    padding: "10px 12px", fontSize: 14, border: "1px solid #ddd",
                    borderRadius: 8, background: "#fff", color: "#ccc", minHeight: 18,
                  }}>
                    {f.placeholder || ""}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Product card + Summary (inside one card) */}
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: 10,
            padding: 14, margin: "14px 0 0",
          }}>
            {/* Product header */}
            <div style={{
              display: "flex", gap: 12, alignItems: "center",
              paddingBottom: 12, borderBottom: "1px solid #eee",
            }}>
              <div style={{
                width: 64, height: 64, background: "#f0f0f0", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#aaa", flexShrink: 0,
              }}>IMG</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: fs?.header_text_color || "#111", lineHeight: 1.3 }}>
                  Numele Produsului
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>99.99</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e53935", textDecoration: "line-through" }}>149,99 RON</span>
                </div>
              </div>
            </div>

            {/* Discount code */}
            {config.settings?.enable_discount_codes && (
              <div style={{ padding: "10px 0 8px" }}>
                <div style={{ fontSize: 13, color: accent, textDecoration: "underline", marginBottom: 6, cursor: "default" }}>
                  Discount code?
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{
                    flex: 1, padding: "8px 10px", fontSize: 13,
                    border: "1px solid #ddd", borderRadius: 8, color: "#999",
                    textTransform: "uppercase",
                  }}>ENTER CODE</div>
                  <div style={{
                    padding: "8px 12px", fontSize: 13, border: "1px solid #ddd",
                    borderRadius: 8, cursor: "default",
                  }}>Apply</div>
                </div>
              </div>
            )}

            {/* Summary lines */}
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span><span>99.99</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: accent }}>
                <span>Discount</span><span></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Transport</span><span>{shippingRate}</span>
              </div>
              {config.settings?.cod_fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{config.settings.cod_fee_label || "COD Fee"}</span>
                  <span>{config.settings.cod_fee}</span>
                </div>
              )}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontWeight: 700, fontSize: 16, borderTop: "2px solid #eee",
                paddingTop: 6, marginTop: 4,
              }}>
                <span>Total</span>
                <span>{(99.99 + parseFloat(shippingRate)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Order bumps preview */}
          {config.bumps?.enabled && config.bumps.items?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                ⬇️ Add-ons ⬇️
              </div>
              {config.bumps.items.slice(0, 3).map((bump, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", marginBottom: 6,
                  border: "2px dashed #d4c5f0", borderRadius: 10,
                  background: "#f5f0ff", fontSize: 13,
                }}>
                  <div style={{
                    width: 18, height: 18, border: `2px solid ${accent}`,
                    borderRadius: 4, flexShrink: 0,
                  }} />
                  {bump.image_url && (
                    <img src={bump.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
                  )}
                  <span dangerouslySetInnerHTML={{ __html: bump.text || bump.title || "Produs bump" }} />
                </div>
              ))}
              {config.bumps.items.length > 3 && (
                <div style={{ textAlign: "center", fontSize: 11, color: "#999" }}>
                  +{config.bumps.items.length - 3} more bumps
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <button type="button" style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: "100%", minHeight: 48, padding: "12px 20px", marginTop: 14,
            fontSize: 15, fontWeight: 600, color: "#fff",
            background: accent, border: "none",
            borderRadius: 8, cursor: "default", fontFamily: "inherit",
          }}>
            <span>{config.form.button_text || "Place Order"}</span>
            <span style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.85, marginTop: 2 }}>CASH ON DELIVERY</span>
          </button>

          {/* Prepaid button */}
          {pp?.enabled && (
            <button type="button" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: "100%", padding: "12px 20px", marginTop: 8,
              fontSize: 14, fontWeight: 600, color: "#fff",
              background: "#1a1a1a", border: "none",
              borderRadius: 8, cursor: "default", fontFamily: "inherit",
            }}>
              {pp.button_text || "\uD83D\uDCB3 Plat\u0103 cu cardul"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
