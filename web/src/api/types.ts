/** Current authenticated store identity from /api/admin/me */
export interface CurrentStore {
  shop: string;
  store_name: string;
  locale: string;
  currency: string;
  all_stores?: { shop_domain: string; store_name: string }[];
}

/** Store config shape matching backend data/cod/config_store_X.json */

export interface QuantityTier {
  min_qty: number;
  title: string;
  discount_type: string;
  discount_percent: number;
  discount_fixed: number;
  tag: string;
  tag_bg: string;
  label: string;
  image_url: string;
  preselect: boolean;
}

export interface OfferGroup {
  name: string;
  product_ids: number[];
  enabled: boolean;
  tiers: QuantityTier[];
}

export interface FraudConfig {
  duplicate_window_hours: number;
  blocked_postal_codes: string[];
  blocked_phones: string[];
  blocked_ips: string[];
  otp_enabled: boolean;
}

export interface ShippingRate {
  name: string;
  price: string;
  min_order: number;
  max_order: number | null;
  min_qty: number;
  max_qty: number | null;
  product_ids: number[];
  exclude_product_ids: number[];
}

export interface ShippingConfig {
  default_rate: string;
  free_threshold: number;
  province_rates: Record<string, string>;
  rates: ShippingRate[];
}

export interface PixelConfig {
  gads_conversion_id: string;
  gads_conversion_label: string;
  tiktok_pixel_id: string;
  tiktok_access_token: string;
  pinterest_tag_id: string;
  snapchat_pixel_id: string;
  fb_pixel_id: string;
  fb_access_token: string;
  fb_test_event_code: string;
  ga4_measurement_id: string;
  event_matrix: Record<string, string[]>;
}

export interface FormField {
  id: string;
  label: string;
  placeholder: string;
  field_type: string;
  visible: boolean;
  required: boolean;
  order: number;
  half_width: boolean;
  options: string[];
}

export interface FormConfig {
  enabled: boolean;
  button_text: string;
  custom_note_prefix: string;
  tags: string[];
  layout: { fields: FormField[] };
}

export interface UpsellOffer {
  product_id: number;
  header_text: string;
  subheader_text: string;
  discount_badge_text: string;
  timer_duration: number;
  accept_text: string;
  accept_color: string;
  reject_text: string;
}

export interface UpsellConfig {
  enabled: boolean;
  default_product_ids: number[];
  product_mappings: Record<string, number[]>;
  downsell_product_id: number | null;
  default_timer_duration: number;
  default_accept_text: string;
  default_reject_text: string;
  offers: UpsellOffer[];
}

export interface OrderBumpItem {
  variant_id: number;
  title: string;
  price: string;
  image_url: string;
  text: string;
}

export interface BumpsConfig {
  enabled: boolean;
  items: {
    variant_id: number;
    title: string;
    price: string;
    image_url: string;
    text: string;
    target_product_ids: number[];
    enabled: boolean;
  }[];
}

export interface DownsellConfig {
  enabled: boolean;
  message: string;
  discount_code: string;
  button_text: string;
  target_product_ids?: number[];
  message_color?: string;
  badge_bg_color?: string;
  badge_text_color?: string;
  button_bg_color?: string;
  button_text_color?: string;
  bg_color?: string;
  show_after_closes?: number;
}

export interface SettingsConfig {
  post_order_redirect: string;
  custom_redirect_url: string;
  hide_checkout_button: boolean;
  hide_buy_now_button: boolean;
  show_on_cart_page: boolean;
  custom_css: string;
  enable_discount_codes: boolean;
  disable_for_oos: boolean;
  sticky_buy_button: boolean;
  abandoned_recovery_enabled: boolean;
  abandoned_recovery_delay_minutes: number;
  abandoned_recovery_max_per_day: number;
  cod_fee: number;
  cod_fee_label: string;
  google_places_api_key: string;
  address_autocomplete_enabled: boolean;
  restrict_mode: string;
  allowed_product_ids: number[];
  excluded_product_ids: number[];
  announcement_text?: string;
}

export interface PrepaidConfig {
  enabled: boolean;
  button_text: string;
  discount_type: string;
  discount_value: number;
  discount_code: string;
  discount_label: string;
}

export interface ButtonStyle {
  text: string;
  subtitle: string;
  text_color: string;
  text_size: string;
  bg_color: string;
  bg_color_hover: string;
  border_color: string;
  border_width: string;
  border_radius: string;
  animation: string;
  icon: string;
}

export interface FormStyle {
  bg_color: string;
  text_color: string;
  header_text_color: string;
  label_color: string;
  border_radius: string;
  max_width: string;
  overlay_opacity: string;
  product_image_size: string;
  accent_color: string;
}

export interface OffersStyle {
  template: string;
  show_in: string;
  border_radius: string;
  active_bg: string;
  active_border: string;
  inactive_bg: string;
  inactive_border: string;
  tag_bg: string;
  tag_text_color: string;
  tag_text_size: string;
  tag_bold: boolean;
  tag_italic: boolean;
  label_bg: string;
  label_text_color: string;
  label_text_size: string;
  label_bold: boolean;
  label_italic: boolean;
  title_color: string;
  title_size: string;
  title_bold: boolean;
  title_italic: boolean;
  price_color: string;
  price_size: string;
  price_bold: boolean;
  price_italic: boolean;
  inactive_tag_bg: string;
  hide_product_image: boolean;
  hide_comparison_price: boolean;
  hide_offers_higher_qty: boolean;
  add_title_to_order: boolean;
  use_comparison_price: boolean;
  disable_variant_selection: boolean;
}

export interface StoreConfig {
  offer_groups: OfferGroup[];
  fraud: FraudConfig;
  shipping: ShippingConfig;
  pixels: PixelConfig;
  form: FormConfig;
  upsells: UpsellConfig;
  bumps: BumpsConfig;
  downsell: DownsellConfig;
  settings: SettingsConfig;
  button_style: ButtonStyle;
  form_style: FormStyle;
  prepaid: PrepaidConfig;
  offers_style: OffersStyle;
}

export interface OrderRecord {
  created_at: string;
  store_id: string;
  order_id: number;
  order_name: string;
  phone_hash: string;
  phone_last4: string;
  ip: string;
  city: string;
  province: string;
  zip: string;
  variant_id: number;
  quantity: number;
}

export interface OrdersResponse {
  orders: OrderRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OrderStats {
  total_orders: number;
  total_all_time: number;
  daily_counts: Record<string, number>;
  top_cities: { city: string; count: number }[];
  period_days: number;
}

export interface BlacklistResponse {
  items: string[];
  type: string;
}

export interface DailyAnalytics {
  date: string;
  form_opens: number;
  orders: number;
  revenue: number;
}

export interface UtmRow {
  campaign: string;
  source: string;
  medium: string;
  form_opens: number;
  orders: number;
  conversion_rate: number;
}

export interface AnalyticsData {
  form_opens: number;
  orders: number;
  revenue: number;
  conversion_rate: number;
  avg_order_value: number;
  daily: DailyAnalytics[];
  utm_data: UtmRow[];
  top_products: { variant_id: number; orders: number }[];
  period_days: number;
}
