import type { StoreConfig, OffersStyle } from "../api/types";

const DEFAULTS: OffersStyle = {
  template: "classic",
  show_in: "page",
  border_radius: "8px",
  active_bg: "#FFF8F8",
  active_border: "#C62828",
  inactive_bg: "#ffffff",
  inactive_border: "#e0e0e0",
  tag_bg: "#C62828",
  tag_text_color: "#ffffff",
  tag_text_size: "12px",
  tag_bold: true,
  tag_italic: false,
  label_bg: "#2E7D32",
  label_text_color: "#ffffff",
  label_text_size: "11px",
  label_bold: true,
  label_italic: false,
  title_color: "#333333",
  title_size: "14px",
  title_bold: true,
  title_italic: false,
  price_color: "#C62828",
  price_size: "14px",
  price_bold: true,
  price_italic: false,
  inactive_tag_bg: "#292524",
  hide_product_image: false,
  hide_comparison_price: false,
  hide_offers_higher_qty: false,
  add_title_to_order: false,
  use_comparison_price: false,
  disable_variant_selection: false,
};

interface Props {
  config: StoreConfig;
}

export function OffersPreview({ config }: Props) {
  const os = config.offers_style ?? DEFAULTS;
  const radius = parseInt(os.border_radius) || 8;

  const unitPrice = 99.99;
  const enabledGroup = (config.offer_groups ?? []).find((g) => g.enabled);
  const tiers = enabledGroup?.tiers ?? [];
  const singleOffer = { min_qty: 1, title: "", discount_type: "none" as const, discount_percent: 0, discount_fixed: 0, tag: "", tag_bg: "", label: "", image_url: "", preselect: false };
  const allOffers = [singleOffer, ...tiers];

  return (
    <div style={{ position: "sticky", top: 16 }}>
      <div style={{
        fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const,
        letterSpacing: "0.05em", color: "#6d7175", marginBottom: 8,
      }}>
        Live Preview
      </div>
      <div style={{
        width: 340, background: "#f6f6f7", borderRadius: 20,
        border: "2px solid #e1e3e5", padding: "12px 8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        <div style={{ width: 80, height: 6, background: "#d2d5d8", borderRadius: 3, margin: "0 auto 10px" }} />
        <div style={{ padding: "0 8px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            {!os.hide_product_image && (
              <div style={{
                width: 40, height: 40, minWidth: 40, background: "#e8e8e8", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#999",
              }}>IMG</div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Nume Produs</div>
              <div style={{ fontSize: 11, color: "#666" }}>
                <span style={{ fontWeight: 600, color: os.price_color }}>99.99 RON</span>
                {!os.hide_comparison_price && (
                  <span style={{ marginLeft: 4, textDecoration: "line-through", color: "#999", fontSize: 10 }}>129.99 RON</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "0 8px" }}>
          {os.template === "classic" && <ClassicTemplate offers={allOffers} os={os} radius={radius} unitPrice={unitPrice} />}
          {os.template === "modern" && <ModernTemplate offers={allOffers} os={os} radius={radius} unitPrice={unitPrice} />}
          {os.template === "vertical" && <VerticalTemplate offers={allOffers} os={os} radius={radius} unitPrice={unitPrice} />}
        </div>
        <div style={{ textAlign: "center", fontSize: 9, color: "#999", marginTop: 6, marginBottom: 4 }}>
          Template: {os.template} | Show: {os.show_in === "page" ? "Above button" : "Inside form"}
        </div>
      </div>
    </div>
  );
}

interface OfferItem {
  min_qty: number;
  title?: string;
  discount_type?: string;
  discount_percent: number;
  discount_fixed?: number;
  tag?: string;
  tag_bg?: string;
  label?: string;
  image_url?: string;
}

function calcDiscounted(o: OfferItem, unitPrice: number): number {
  const dt = o.discount_type ?? "percentage";
  if (dt === "fixed") return Math.max(0, unitPrice - (o.discount_fixed ?? 0));
  if (dt === "percentage" && o.discount_percent > 0) return unitPrice * (1 - o.discount_percent / 100);
  return unitPrice;
}

function offerTag(o: OfferItem): string {
  if (o.tag) return o.tag;
  const dt = o.discount_type ?? "percentage";
  if (dt === "fixed" && (o.discount_fixed ?? 0) > 0) return `-${o.discount_fixed} RON`;
  if (dt === "percentage" && o.discount_percent > 0) return `-${o.discount_percent}%`;
  return "";
}

function hasDiscount(o: OfferItem): boolean {
  const dt = o.discount_type ?? "percentage";
  if (dt === "none") return false;
  if (dt === "fixed") return (o.discount_fixed ?? 0) > 0;
  return o.discount_percent > 0;
}

function titleText(o: OfferItem): string {
  return o.title || `${o.min_qty} buc`;
}

interface TemplateProps {
  offers: OfferItem[];
  os: OffersStyle;
  radius: number;
  unitPrice: number;
}

function tagStyle(os: OffersStyle, isActive: boolean, perTierBg?: string) {
  return {
    background: perTierBg || (isActive ? os.tag_bg : (os.inactive_tag_bg || os.tag_bg)),
    color: os.tag_text_color,
    fontSize: parseInt(os.tag_text_size) * 0.7 || 8,
    fontWeight: os.tag_bold ? 700 : 400,
    fontStyle: os.tag_italic ? "italic" as const : "normal" as const,
  };
}

function labelStyle(os: OffersStyle) {
  return {
    background: os.label_bg,
    color: os.label_text_color,
    fontSize: parseInt(os.label_text_size) * 0.7 || 7,
    fontWeight: os.label_bold ? 700 : 400,
    fontStyle: os.label_italic ? "italic" as const : "normal" as const,
  };
}

function titleStyle(os: OffersStyle) {
  return {
    color: os.title_color,
    fontSize: parseInt(os.title_size) * 0.7 || 10,
    fontWeight: os.title_bold ? 700 : 400,
    fontStyle: os.title_italic ? "italic" as const : "normal" as const,
  };
}

function priceStyle(os: OffersStyle) {
  return {
    color: os.price_color,
    fontSize: parseInt(os.price_size) * 0.7 || 10,
    fontWeight: os.price_bold ? 700 : 400,
    fontStyle: os.price_italic ? "italic" as const : "normal" as const,
  };
}

function ClassicTemplate({ offers, os, radius, unitPrice }: TemplateProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(offers.length, 3)}, 1fr)`, gap: 6 }}>
      {offers.map((o, i) => {
        const isActive = i === 0;
        const discounted = calcDiscounted(o, unitPrice);
        const tag = offerTag(o);
        return (
          <div key={i} style={{
            position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
            padding: "10px 6px 8px",
            border: `2px solid ${isActive ? os.active_border : os.inactive_border}`,
            borderRadius: radius, background: isActive ? os.active_bg : os.inactive_bg,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {tag && (
              <div style={{
                position: "absolute", top: -6, right: -4, padding: "1px 5px",
                borderRadius: 99, lineHeight: 1.4,
                ...tagStyle(os, isActive, o.tag_bg),
              }}>{tag}</div>
            )}
            {o.label && (
              <div style={{
                position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)",
                padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap", lineHeight: 1.4,
                ...labelStyle(os),
              }}>{o.label}</div>
            )}
            {o.image_url && (
              <img src={o.image_url} alt="" style={{ width: 30, height: 30, borderRadius: 4, objectFit: "cover", marginBottom: 2 }} />
            )}
            <div style={{ marginBottom: 2, ...titleStyle(os) }}>{titleText(o)}</div>
            <div style={priceStyle(os)}>{discounted.toFixed(2)} RON</div>
            {o.min_qty === 1 && !hasDiscount(o) && (
              <div style={{ fontSize: 7, color: "#999", marginTop: 1 }}>Preț întreg</div>
            )}
            {hasDiscount(o) && (
              <div style={{ fontSize: 7, color: "#999", marginTop: 1 }}>
                {(discounted * o.min_qty).toFixed(2)} total
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModernTemplate({ offers, os, radius, unitPrice }: TemplateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {offers.map((o, i) => {
        const isActive = i === 0;
        const discounted = calcDiscounted(o, unitPrice);
        const tag = offerTag(o);
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            border: `2px solid ${isActive ? os.active_border : os.inactive_border}`,
            borderRadius: radius, background: isActive ? os.active_bg : os.inactive_bg, cursor: "pointer",
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              border: `2px solid ${isActive ? os.active_border : os.inactive_border}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {isActive && <div style={{ width: 7, height: 7, borderRadius: "50%", background: os.active_border }} />}
            </div>
            {o.image_url && (
              <img src={o.image_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <span style={titleStyle(os)}>{titleText(o)}</span>
              {o.label && (
                <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 3, ...labelStyle(os) }}>{o.label}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={priceStyle(os)}>{discounted.toFixed(2)}</span>
              {tag && (
                <span style={{ padding: "1px 4px", borderRadius: 3, ...tagStyle(os, isActive, o.tag_bg) }}>{tag}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerticalTemplate({ offers, os, radius, unitPrice }: TemplateProps) {
  return (
    <div style={{ border: `1px solid ${os.inactive_border}`, borderRadius: radius, overflow: "hidden" }}>
      {offers.map((o, i) => {
        const isActive = i === 0;
        const discounted = calcDiscounted(o, unitPrice);
        const tag = offerTag(o);
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 10px", background: isActive ? os.active_bg : os.inactive_bg,
            borderBottom: i < offers.length - 1 ? `1px solid ${os.inactive_border}` : "none",
            borderLeft: isActive ? `3px solid ${os.active_border}` : "3px solid transparent",
            cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {o.image_url && (
                <img src={o.image_url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
              )}
              <span style={titleStyle(os)}>{titleText(o)}</span>
              {o.label && (
                <span style={{ padding: "1px 5px", borderRadius: 3, ...labelStyle(os) }}>{o.label}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={priceStyle(os)}>{discounted.toFixed(2)} RON</span>
              {tag && (
                <span style={{ padding: "1px 4px", borderRadius: 99, ...tagStyle(os, isActive, o.tag_bg) }}>{tag}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
