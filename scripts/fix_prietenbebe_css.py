"""Push comprehensive CSS overrides to PrietenBebe's cod-form.css to match BebeMate."""

import asyncio
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME_ID = 182042198345

# Comprehensive CSS overrides to make the form theme-independent
CSS_OVERRIDES = """

/* ══════════════════════════════════════════════════════════════════════════
   Theme-independent overrides — forces correct sizing on all Shopify themes
   ══════════════════════════════════════════════════════════════════════════ */

/* Trigger button — full width, proper sizing */
#cod-form-open {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-height: 56px !important;
  padding: 14px 24px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  line-height: 1.4 !important;
  border: none !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  box-sizing: border-box !important;
  text-align: center !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  box-shadow: none !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}
#cod-form-open .cod-form-trigger__subtitle {
  font-size: 0.7rem !important;
  opacity: 0.85 !important;
  margin-top: 2px !important;
  font-weight: 400 !important;
  text-transform: none !important;
}

/* Form overlay — full screen, centered */
#cod-form-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 999999 !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  padding: 2vh 16px !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
}

/* Form container — proper max-width and sizing */
#cod-form-overlay .cod-form {
  width: 100% !important;
  max-width: 480px !important;
  margin: 0 auto !important;
  padding: 24px !important;
  border-radius: 12px !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  font-size: 15px !important;
  line-height: 1.5 !important;
  position: relative !important;
}

/* Form close button */
#cod-form-overlay .cod-form__close {
  position: absolute !important;
  top: 12px !important;
  right: 12px !important;
  font-size: 24px !important;
  cursor: pointer !important;
  background: none !important;
  border: none !important;
  padding: 4px 8px !important;
  z-index: 10 !important;
}

/* Announcement banner */
#cod-form-overlay .cod-form__announce {
  text-align: center !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  padding: 10px !important;
  margin: -24px -24px 16px -24px !important;
  border-radius: 12px 12px 0 0 !important;
}

/* Form labels */
#cod-form-overlay label {
  display: block !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  margin-bottom: 4px !important;
  line-height: 1.4 !important;
}

/* Form inputs */
#cod-form-overlay input[type="text"],
#cod-form-overlay input[type="tel"],
#cod-form-overlay input[type="email"],
#cod-form-overlay select,
#cod-form-overlay textarea {
  width: 100% !important;
  padding: 12px 14px !important;
  font-size: 15px !important;
  line-height: 1.4 !important;
  border: 1px solid #ddd !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  background: #fff !important;
  -webkit-appearance: none !important;
  appearance: none !important;
  outline: none !important;
  font-family: inherit !important;
  margin-bottom: 12px !important;
}
#cod-form-overlay input:focus,
#cod-form-overlay select:focus,
#cod-form-overlay textarea:focus {
  border-color: var(--color-primary, #b5a1e0) !important;
  box-shadow: 0 0 0 2px rgba(181, 161, 224, 0.2) !important;
}
#cod-form-overlay select {
  padding-right: 32px !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%23666'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 12px center !important;
}

/* Product card in form */
#cod-form-overlay .cod-form__product {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 14px !important;
  border: 1px solid #eee !important;
  border-radius: 10px !important;
  margin-bottom: 16px !important;
}
#cod-form-overlay .cod-form__product-img {
  width: 80px !important;
  height: 80px !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  flex-shrink: 0 !important;
}

/* Discount code section */
#cod-form-overlay .cod-form__discount {
  margin-bottom: 12px !important;
}
#cod-form-overlay .cod-form__discount-toggle {
  font-size: 14px !important;
  cursor: pointer !important;
  text-decoration: underline !important;
  margin-bottom: 8px !important;
  display: inline-block !important;
}
#cod-form-overlay .cod-form__discount-row {
  display: flex !important;
  gap: 8px !important;
  align-items: center !important;
}
#cod-form-overlay .cod-form__discount-row input {
  flex: 1 !important;
  margin-bottom: 0 !important;
}
#cod-form-overlay .cod-form__discount-row button {
  padding: 12px 16px !important;
  font-size: 14px !important;
  background: transparent !important;
  border: 1px solid #ddd !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  white-space: nowrap !important;
}

/* Order summary */
#cod-form-overlay .cod-form__summary {
  font-size: 14px !important;
  line-height: 1.8 !important;
}
#cod-form-overlay .cod-form__total-row {
  font-size: 16px !important;
  font-weight: 700 !important;
  border-top: 2px solid #eee !important;
  padding-top: 8px !important;
  margin-top: 4px !important;
}

/* Submit button — CRITICAL: override all theme button styles */
.cod-form__submit,
#cod-submit-btn,
#cod-form-overlay button[type="submit"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-height: 52px !important;
  padding: 14px 24px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  line-height: 1.3 !important;
  color: #fff !important;
  background: var(--color-primary, #b5a1e0) !important;
  border: none !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  margin-top: 16px !important;
  box-sizing: border-box !important;
  -webkit-appearance: none !important;
  appearance: none !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  box-shadow: none !important;
  transition: background 0.2s !important;
}
.cod-form__submit:hover,
#cod-submit-btn:hover,
#cod-form-overlay button[type="submit"]:hover {
  background: var(--color-primary-dark, #6a6095) !important;
}

/* Bump items */
#cod-form-overlay .cod-form__bump-item {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 12px 14px !important;
  border-width: 2px !important;
  border-radius: 10px !important;
  margin-bottom: 8px !important;
  font-size: 14px !important;
  line-height: 1.4 !important;
}
#cod-form-overlay .cod-form__bump-item img {
  width: 60px !important;
  height: 60px !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  flex-shrink: 0 !important;
}
#cod-form-overlay .cod-form__bump-item input[type="checkbox"] {
  width: 22px !important;
  height: 22px !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  accent-color: var(--color-primary, #b5a1e0) !important;
}

/* Prepaid / card payment button */
#cod-form-overlay .cod-form__prepaid-btn,
#cod-prepaid-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  width: 100% !important;
  padding: 14px 24px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  color: #fff !important;
  background: #1a1a1a !important;
  border: none !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  margin-top: 8px !important;
  box-sizing: border-box !important;
}

/* Bumps heading */
#cod-form-overlay .cod-form__bump-heading {
  text-align: center !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  margin: 16px 0 10px !important;
}
"""


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        # Get current CSS
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME_ID}/assets.json",
            params={"asset[key]": "assets/cod-form.css"},
            headers=h,
        )
        css = r.json().get("asset", {}).get("value", "")
        print(f"Current CSS: {len(css)} chars")

        # Remove old partial fix if present, add comprehensive overrides
        if "Theme-independent overrides" in css:
            # Remove old overrides
            idx = css.index("/* ══")
            css = css[:idx].rstrip()

        css += CSS_OVERRIDES

        r = await c.put(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME_ID}/assets.json",
            headers=h,
            json={"asset": {"key": "assets/cod-form.css", "value": css}},
        )
        print(f"Push: {r.status_code}")
        if r.status_code == 200:
            print(f"Done! New CSS: {len(css)} chars")
        else:
            print(r.text[:300])


asyncio.run(main())
