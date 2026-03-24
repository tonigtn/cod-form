import type { StoreConfig, FormField } from "../api/types";

const DEFAULT_PREVIEW_FIELDS: FormField[] = [
  { id: "first_name", label: "Prenume", placeholder: "", field_type: "text", visible: true, required: true, order: 0, half_width: true, options: [] },
  { id: "last_name", label: "Nume", placeholder: "", field_type: "text", visible: true, required: true, order: 1, half_width: true, options: [] },
  { id: "phone", label: "Telefon", placeholder: "07XX XXX XXX", field_type: "tel", visible: true, required: true, order: 2, half_width: false, options: [] },
  { id: "province", label: "Jude\u021b", placeholder: "", field_type: "select", visible: true, required: true, order: 3, half_width: false, options: [] },
  { id: "city", label: "Localitate", placeholder: "", field_type: "text", visible: true, required: true, order: 4, half_width: false, options: [] },
  { id: "address1", label: "Adres\u0103", placeholder: "Strada, nr, bloc, scara, ap", field_type: "text", visible: true, required: true, order: 5, half_width: false, options: [] },
  { id: "zip", label: "Cod po\u0219tal", placeholder: "", field_type: "text", visible: true, required: false, order: 6, half_width: true, options: [] },
  { id: "email", label: "Email", placeholder: "", field_type: "email", visible: true, required: false, order: 7, half_width: true, options: [] },
];

const ICON_SVG: Record<string, string> = {
  cash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M2 10h2M20 10h2M2 14h2M20 14h2"/></svg>',
  cart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  truck: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
};

const ANIM_KEYFRAMES: Record<string, string> = {
  bounce: "cod-preview-bounce 2s ease infinite",
  shake: "cod-preview-shake 3s ease infinite",
  pulse: "cod-preview-pulse 2s ease infinite",
};

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

  // Group consecutive half-width fields into rows
  const rows: FormField[][] = [];
  let i = 0;
  while (i < fields.length) {
    if (fields[i]!.half_width && i + 1 < fields.length && fields[i + 1]!.half_width) {
      rows.push([fields[i]!, fields[i + 1]!]);
      i += 2;
    } else {
      rows.push([fields[i]!]);
      i++;
    }
  }

  const accentColor = fs?.accent_color || "#C62828";

  return (
    <div style={{ position: "sticky", top: 16 }}>
      <div style={{
        fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const,
        letterSpacing: "0.05em", color: "#6d7175", marginBottom: 8,
      }}>
        Live Preview
      </div>

      {/* Phone frame */}
      <div style={{
        width: 320, background: "#f6f6f7", borderRadius: 20,
        border: "2px solid #e1e3e5", padding: "12px 8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        {/* Notch */}
        <div style={{ width: 80, height: 6, background: "#d2d5d8", borderRadius: 3, margin: "0 auto 10px" }} />

        {/* Animation keyframes */}
        <style>{`
          @keyframes cod-preview-bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-4px); }
            60% { transform: translateY(-2px); }
          }
          @keyframes cod-preview-shake {
            0%, 90%, 100% { transform: translateX(0); }
            92% { transform: translateX(-2px); }
            94% { transform: translateX(2px); }
            96% { transform: translateX(-2px); }
            98% { transform: translateX(2px); }
          }
          @keyframes cod-preview-pulse {
            0% { box-shadow: 0 0 0 0 ${accentColor}66; }
            70% { box-shadow: 0 0 0 8px ${accentColor}00; }
            100% { box-shadow: 0 0 0 0 ${accentColor}00; }
          }
        `}</style>

        {/* Trigger button preview */}
        <div style={{ padding: "0 8px", marginBottom: 10 }}>
          <button
            type="button"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, width: "100%", padding: "10px 16px",
              fontSize: bs?.text_size || "16px", fontWeight: 700,
              color: bs?.text_color || "#fff", background: bs?.bg_color || "#C62828",
              border: bs?.border_color ? `${bs.border_width || "1px"} solid ${bs.border_color}` : "none",
              borderRadius: bs?.border_radius || "8px", cursor: "default",
              fontFamily: "inherit", lineHeight: 1.3,
              animation: bs?.animation && bs.animation !== "none" ? ANIM_KEYFRAMES[bs.animation] || "none" : "none",
            }}
          >
            {bs?.icon && bs.icon !== "none" && ICON_SVG[bs.icon] && (
              <span dangerouslySetInnerHTML={{ __html: ICON_SVG[bs.icon]! }} style={{ flexShrink: 0, display: "flex" }} />
            )}
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span>{bs?.text || config.form.button_text || "Comand\u0103 cu plata la livrare"}</span>
              {bs?.subtitle && (
                <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.85 }}>{bs.subtitle}</span>
              )}
            </span>
          </button>
          {bs?.animation && bs.animation !== "none" && (
            <div style={{ textAlign: "center", fontSize: 9, color: "#999", marginTop: 3 }}>
              Animation: {bs.animation}
            </div>
          )}
        </div>

        {/* Form popup preview */}
        <div style={{
          background: fs?.bg_color || "#fff", borderRadius: fs?.border_radius || "12px",
          padding: 14, margin: "0 4px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)", color: fs?.text_color || "#333",
          position: "relative",
        }}>
          {/* Close X */}
          <div style={{ position: "absolute", top: 8, right: 10, color: "#999", fontSize: 14, cursor: "default" }}>
            &#x2715;
          </div>

          {/* Product header */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #e0e0e0",
          }}>
            <div style={{
              width: parseInt(fs?.product_image_size || "40") * 0.6,
              height: parseInt(fs?.product_image_size || "40") * 0.6,
              minWidth: 32, minHeight: 32, background: "#e8e8e8", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#999",
            }}>IMG</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: fs?.header_text_color || "#111", lineHeight: 1.3 }}>
                Nume Produs
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>99.99 RON</div>
            </div>
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map((row, ri) => (
              <div
                key={ri}
                style={{
                  display: "grid",
                  gridTemplateColumns: row.length === 2 ? "1fr 1fr" : "1fr",
                  gap: 6,
                }}
              >
                {row.map((f) => (
                  <PreviewField
                    key={f.id}
                    field={f}
                    labelColor={fs?.label_color || "#555"}
                    accentColor={accentColor}
                    borderRadius={fs?.border_radius || "8px"}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e0e0e0", fontSize: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span>Subtotal</span><span>99.99 RON</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span>Livrare</span><span>{config.shipping?.default_rate || "19.99"} RON</span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 11,
              paddingTop: 4, borderTop: "1px solid #e0e0e0", marginTop: 4,
            }}>
              <span>Total</span>
              <span>{(99.99 + parseFloat(config.shipping?.default_rate || "19.99")).toFixed(2)} RON</span>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="button"
            style={{
              display: "block", width: "100%", padding: "8px 12px", marginTop: 10,
              fontSize: 12, fontWeight: 600, color: bs?.text_color || "#fff",
              background: bs?.bg_color || accentColor, border: "none",
              borderRadius: Math.max(parseInt(bs?.border_radius || "8") - 2, 4) + "px",
              cursor: "default", fontFamily: "inherit",
            }}
          >
            {bs?.text || config.form.button_text || "Comand\u0103 cu plata la livrare"}
          </button>

          {/* Prepaid button */}
          {pp?.enabled && (
            <button
              type="button"
              style={{
                display: "block", width: "100%", padding: "7px 12px", marginTop: 6,
                fontSize: 11, fontWeight: 600, color: accentColor,
                background: "transparent", border: `1px solid ${accentColor}`,
                borderRadius: Math.max(parseInt(bs?.border_radius || "8") - 2, 4) + "px",
                cursor: "default", fontFamily: "inherit",
              }}
            >
              {pp.button_text || "Pl\u0103te\u0219te online"}
              {pp.discount_label && (
                <span style={{
                  display: "inline-block", marginLeft: 4, padding: "1px 4px",
                  fontSize: 9, fontWeight: 700, color: "#fff", background: "#2E7D32", borderRadius: 3,
                }}>{pp.discount_label}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewField({
  field,
  labelColor,
  accentColor,
  borderRadius,
}: {
  field: FormField;
  labelColor: string;
  accentColor: string;
  borderRadius: string;
}) {
  const radius = Math.max(parseInt(borderRadius) - 4, 4);

  // Single checkbox (e.g. accepts_marketing)
  if (field.field_type === "checkbox") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
        <div style={{
          width: 12, height: 12, border: `1.5px solid ${accentColor}`,
          borderRadius: 2, flexShrink: 0,
        }} />
        <span style={{ fontSize: 9, color: labelColor }}>{field.label || field.id}</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 500, color: labelColor, marginBottom: 2 }}>
        {field.label || field.id}
        {field.required && <span style={{ color: accentColor, marginLeft: 1 }}>*</span>}
      </div>
      {field.field_type === "select" ? (
        <div style={{
          padding: "4px 6px", fontSize: 9, border: "1px solid #e0e0e0",
          borderRadius: radius, background: "#fff", color: "#999",
        }}>
          {field.placeholder || "Selecteaz\u0103..."}
          <span style={{ float: "right" }}>{"\u25BE"}</span>
        </div>
      ) : field.field_type === "textarea" ? (
        <div style={{
          padding: "4px 6px", fontSize: 9, border: "1px solid #e0e0e0",
          borderRadius: radius, background: "#fff", color: "#ccc", minHeight: 28,
        }}>
          {field.placeholder || ""}
        </div>
      ) : field.field_type === "date" ? (
        <div style={{
          padding: "4px 6px", fontSize: 9, border: "1px solid #e0e0e0",
          borderRadius: radius, background: "#fff", color: "#999",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>zz/ll/aaaa</span>
          <span style={{ fontSize: 10 }}>{"\uD83D\uDCC5"}</span>
        </div>
      ) : field.field_type === "radio" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
          {(field.options?.length ? field.options : ["Op\u021biunea 1", "Op\u021biunea 2"]).map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                border: `1.5px solid ${i === 0 ? accentColor : "#ccc"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {i === 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: accentColor }} />}
              </div>
              <span style={{ fontSize: 9, color: "#333" }}>{opt}</span>
            </div>
          ))}
        </div>
      ) : field.field_type === "checkbox_group" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
          {(field.options?.length ? field.options : ["Op\u021biunea 1", "Op\u021biunea 2"]).map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 10, height: 10, border: `1.5px solid ${i === 0 ? accentColor : "#ccc"}`,
                borderRadius: 2,
              }} />
              <span style={{ fontSize: 9, color: "#333" }}>{opt}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "4px 6px", fontSize: 9, border: "1px solid #e0e0e0",
          borderRadius: radius, background: "#fff", color: "#ccc",
          height: 22, lineHeight: "14px",
        }}>
          {field.placeholder || ""}
        </div>
      )}
    </div>
  );
}
