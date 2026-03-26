"""Remove the error/retry section from PrietenBebe theme liquid."""
import asyncio, os, re
import asyncpg, httpx
from cryptography.fernet import Fernet

async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow("SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", "rmeai1-da.myshopify.com")
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()
    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get("https://rmeai1-da.myshopify.com/admin/api/2025-01/themes/182042198345/assets.json",
                       params={"asset[key]": "sections/cod-form.liquid"}, headers=h)
        liquid = r.json()["asset"]["value"]
        # Remove error div block
        liquid = re.sub(r'<div class="cod-form__error" id="cod-error".*?</div>\s*</div>', '', liquid, flags=re.DOTALL)
        r = await c.put("https://rmeai1-da.myshopify.com/admin/api/2025-01/themes/182042198345/assets.json",
                       headers=h, json={"asset": {"key": "sections/cod-form.liquid", "value": liquid}})
        print(f"Push: {r.status_code}")
        print(f"Has cod-error: {'cod-error' in liquid}")

asyncio.run(main())
