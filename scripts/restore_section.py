"""Restore PrietenBebe cod-form section with hardcoded Romanian text."""

import asyncio
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SECTION_LIQUID = r'''{{ 'cod-form.css' | asset_url | stylesheet_tag }}

{% if product.available %}
<div id="cod-form-wrapper">
  <button type="button" class="cod-form-trigger" id="cod-form-open"
    style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:64px;padding:16px 24px;font-size:18px;font-weight:700;color:#fff;background:#b5a1e0;border:none;border-radius:12px;cursor:pointer;">
    <span class="cod-form-trigger__icon" style="font-size:20px;">→</span>
    <span class="cod-form-trigger__text" style="display:flex;flex-direction:column;align-items:center;">
      <span id="cod-trigger-text">Comandă acum</span>
      <span class="cod-form-trigger__subtitle" style="font-size:14px;opacity:0.9;margin-top:3px;font-weight:400;">Plata la livrare</span>
    </span>
  </button>

  <div class="cod-form-overlay" id="cod-form-overlay" role="dialog" aria-modal="true" hidden>
    <div class="cod-form" id="cod-form-panel">
      <div class="cod-form__announcement" id="cod-announcement" hidden></div>
      <button type="button" class="cod-form__close" id="cod-form-close" aria-label="Închide">&times;</button>

      <form id="cod-order-form" novalidate>
        <div class="cod-form__field" data-field="first_name">
          <label for="cod-first-name">Prenume <span class="cod-required">*</span></label>
          <input type="text" id="cod-first-name" name="first_name" required autocomplete="given-name">
        </div>
        <div class="cod-form__field" data-field="last_name">
          <label for="cod-last-name">Nume <span class="cod-required">*</span></label>
          <input type="text" id="cod-last-name" name="last_name" required autocomplete="family-name">
        </div>
        <div class="cod-form__field" data-field="phone">
          <label for="cod-phone">Telefon <span class="cod-required">*</span></label>
          <input type="tel" id="cod-phone" name="phone" required autocomplete="tel" placeholder="07XX XXX XXX">
        </div>
        <div class="cod-form__field" data-field="province">
          <label for="cod-province">Județ <span class="cod-required">*</span></label>
          <select id="cod-province" name="province" required>
            <option value="">— Selectează județul —</option>
          </select>
        </div>
        <div class="cod-form__field" data-field="city">
          <label for="cod-city">Oraș <span class="cod-required">*</span></label>
          <input type="text" id="cod-city" name="city" required autocomplete="address-level2">
        </div>
        <div class="cod-form__field" data-field="address1">
          <label for="cod-address">Adresă <span class="cod-required">*</span></label>
          <input type="text" id="cod-address" name="address1" required autocomplete="street-address" placeholder="Strada, nr., bl., sc., ap.">
        </div>
        <div class="cod-form__field" data-field="zip">
          <label for="cod-zip">Cod poștal</label>
          <input type="text" id="cod-zip" name="zip" autocomplete="postal-code">
        </div>
        <div class="cod-form__field" data-field="email">
          <label for="cod-email">Email</label>
          <input type="email" id="cod-email" name="email" autocomplete="email">
        </div>

        <div class="cod-form__summary">
          <div class="cod-form__header" id="cod-product-card">
            <img class="cod-form__product-img" id="cod-product-img" src="{{ product.featured_image | image_url: width: 160 }}" alt="{{ product.title | escape }}" width="80" height="80">
            <div class="cod-form__product-info">
              <div class="cod-form__product-title">{{ product.title }}</div>
              <div class="cod-form__price-wrap">
                <span class="cod-form__product-price" id="cod-price">{{ product.selected_or_first_available_variant.price | money }}</span>
                {%- if product.selected_or_first_available_variant.compare_at_price > product.selected_or_first_available_variant.price -%}
                  <span class="cod-form__compare-price" id="cod-compare-price">{{ product.selected_or_first_available_variant.compare_at_price | money }}</span>
                {%- endif -%}
              </div>
            </div>
          </div>
          <div class="cod-form__discount" id="cod-discount-section" hidden>
            <a class="cod-form__discount-toggle" id="cod-discount-toggle" href="#">Ai un cod de reducere?</a>
            <div class="cod-form__discount-row" id="cod-discount-row" hidden>
              <input type="text" id="cod-discount-code" placeholder="INTRODU CODUL" style="text-transform:uppercase">
              <button type="button" id="cod-discount-apply">Aplică</button>
            </div>
            <div id="cod-discount-result"></div>
          </div>
          <div class="cod-form__line"><span>Subtotal</span><span id="cod-subtotal"></span></div>
          <div class="cod-form__line cod-form__line--discount"><span id="cod-discount-label" style="color:var(--color-primary,#b5a1e0)">Reducere</span><span id="cod-discount-amount"></span></div>
          <div class="cod-form__line"><span>Transport</span><span id="cod-shipping"></span></div>
          <div class="cod-form__line" id="cod-fee-line"><span id="cod-fee-label"></span><span id="cod-fee-amount"></span></div>
          <div class="cod-form__line" id="cod-added-products-line" style="color:var(--color-primary,#b5a1e0)"><span id="cod-added-label"></span><span id="cod-added-amount"></span></div>
          <div class="cod-form__line cod-form__line--total"><span><b>Total</b></span><span id="cod-total"><b></b></span></div>
        </div>

        <div class="cod-form__bumps" id="cod-bumps" hidden></div>

        <button type="button" class="cod-form__submit" id="cod-submit-btn"
          onclick="document.getElementById('cod-order-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:52px;padding:14px 24px;font-size:16px;font-weight:600;color:#fff;background:var(--color-primary,#b5a1e0);border:none;border-radius:8px;cursor:pointer;margin-top:16px;">
          <span class="cod-form__submit-text" style="display:flex;flex-direction:column;align-items:center;">
            <span>Plasează comanda</span>
            <span style="font-size:0.75rem;text-transform:uppercase;opacity:0.85;margin-top:2px;">PLATA LA LIVRARE</span>
          </span>
          <span class="cod-form__submit-loading" hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" class="cod-spinner"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
          </span>
        </button>
        <div id="cod-prepaid-wrapper" hidden></div>
      </form>

      <div class="cod-form__success" id="cod-success" hidden>
        <div class="cod-form__success-icon">✓</div>
        <h3 id="cod-success-title">Comanda a fost plasată cu succes!</h3>
        <p id="cod-success-text">Te vom contacta în curând.</p>
        <p id="cod-success-order"></p>
        <div id="cod-upsells"></div>
        <button type="button" class="cod-form__submit" id="cod-success-close"
          style="background:var(--color-primary,#b5a1e0);color:#fff;border:none;padding:14px;border-radius:8px;width:100%;font-size:16px;font-weight:600;cursor:pointer;">
          Închide
        </button>
      </div>

      <div class="cod-form__error" id="cod-error" hidden>
        <p id="cod-error-msg"></p>
        <button type="button" id="cod-error-retry" class="cod-form__submit"
          style="background:var(--color-primary,#b5a1e0);color:#fff;border:none;padding:14px;border-radius:8px;width:100%;font-size:16px;font-weight:600;cursor:pointer;">
          Încearcă din nou
        </button>
      </div>
    </div>
  </div>
  <div id="cod-sticky-bar" hidden></div>
</div>

<script
  src="{{ 'cod-form.js' | asset_url }}"
  defer
  data-cod-api-url="https://api.magazinultarii.ro"
  data-shop="{{ shop.permanent_domain }}"
  data-product-id="{{ product.id }}"
  data-variant-id="{{ product.selected_or_first_available_variant.id }}"
  data-unit-price="{{ product.selected_or_first_available_variant.price | divided_by: 100.0 }}"
  {% if product.selected_or_first_available_variant.compare_at_price > product.selected_or_first_available_variant.price %}
    data-compare-price="{{ product.selected_or_first_available_variant.compare_at_price | divided_by: 100.0 }}"
  {% endif %}
  data-currency="{{ cart.currency.iso_code }}"
  data-product-title="{{ product.title | escape }}"
  data-product-image="{{ product.featured_image | image_url: width: 160 }}"
></script>
{% endif %}

{% schema %}
{
  "name": "COD Order Form",
  "settings": []
}
{% endschema %}
'''


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1",
        "rmeai1-da.myshopify.com",
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(
            "https://rmeai1-da.myshopify.com/admin/api/2025-01/themes/182042198345/assets.json",
            headers=h,
            json={"asset": {"key": "sections/cod-form.liquid", "value": SECTION_LIQUID}},
        )
        print(f"Push: {r.status_code}")
        if r.status_code != 200:
            print(r.text[:300])
        else:
            print("Restored — hardcoded Romanian, zero translations")


asyncio.run(main())
