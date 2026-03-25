"""Push submit button CSS fix to BebeMate's live Shopify theme."""

import asyncio
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

CSS_FIX = """
/* Fix: override theme button styles */
.cod-form__submit, #cod-submit-btn {
  background: var(--color-primary, #b5a1e0) !important;
  color: #fff !important;
  border: none !important;
  padding: 0.9rem !important;
  border-radius: 8px !important;
  font-size: 1rem !important;
  font-weight: 600 !important;
  width: 100% !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.5rem !important;
  margin-top: 1rem !important;
}
.cod-form__submit:hover, #cod-submit-btn:hover {
  background: var(--color-primary-dark, #6a6095) !important;
}
"""


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1",
        "jgj1ff-ak.myshopify.com",
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()

    shop = "jgj1ff-ak.myshopify.com"
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        # Get live theme
        r = await c.get(
            f"https://{shop}/admin/api/2025-01/themes.json", headers=headers
        )
        themes = r.json().get("themes", [])
        live = next((t for t in themes if t["role"] == "main"), None)
        if not live:
            print("No live theme")
            return
        tid = live["id"]
        print(f"Theme: {live.get('name', '?')} (ID: {tid})")

        # Get current CSS
        r = await c.get(
            f"https://{shop}/admin/api/2025-01/themes/{tid}/assets.json",
            params={"asset[key]": "assets/cod-form.css"},
            headers=headers,
        )
        css = r.json().get("asset", {}).get("value", "")
        print(f"Current CSS: {len(css)} chars")

        if "override theme button" in css:
            print("Fix already applied")
            return

        css += CSS_FIX

        r = await c.put(
            f"https://{shop}/admin/api/2025-01/themes/{tid}/assets.json",
            headers=headers,
            json={"asset": {"key": "assets/cod-form.css", "value": css}},
        )
        print(f"Push: {r.status_code}")
        if r.status_code == 200:
            print("Done!")
        else:
            print(r.text[:300])


asyncio.run(main())
