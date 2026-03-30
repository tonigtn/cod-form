# Multi-Product COD Cart — Implementation Plan

## Customer Flow

1. Customer on Product A page → clicks COD button → **Product A added to cart + form opens**
2. Form shows Product A with quantity, price, X remove button
3. Customer closes form without ordering → product stays in cart (sessionStorage)
4. Customer navigates to Product B → COD button shows **badge: "1 item"**
5. Customer clicks COD button → **Product B added + form opens with both products**
6. Customer can adjust quantities, remove products (X button)
7. Customer fills address once → **single order with all line items**
8. Max 10 products per order

## Storage

```
sessionStorage key: "cod_cart"
Value: JSON array of cart items:
[
  {
    "product_id": 12345,
    "variant_id": 67890,
    "title": "Product Name",
    "variant_title": "Blue / Large",
    "price": 80.00,
    "compare_at_price": 149.99,
    "image_url": "https://cdn.shopify.com/...",
    "quantity": 1,
    "has_quantity_offer": false
  }
]
```

## Frontend Changes (cod-form.js)

### Cart Manager (new module)
- `codCart.add(item)` — add product, merge if same variant_id (increment qty)
- `codCart.remove(variant_id)` — remove by variant_id
- `codCart.updateQty(variant_id, qty)` — update quantity
- `codCart.getAll()` — return all items
- `codCart.count()` — total item count
- `codCart.clear()` — clear after successful order
- `codCart.subtotal()` — sum of all (price × qty)
- Max 10 items enforced in `add()`

### Button Changes
- On page load: check cart count
- If cart has items: show badge on button (e.g., small circle with count)
- Click always: add current product to cart + open form
- If product already in cart: just open form (don't duplicate)

### Form Changes
- **Product list** replaces single product card:
  - Each item: image (48px) | title + variant | price | qty selector | X remove
  - Scrollable if many items
  - "Your order (N items)" heading
- **Subtotal** sums all products × quantities
- **Quantity offers**: only show for products that have them configured
  - When a product has quantity offers, show offer cards for THAT product
  - Other products in cart are unaffected
- **Shipping** calculated on total cart value (for free shipping threshold)
- **Bumps/upsells**: aggregated — show bumps for ALL products in cart

### Order Creation
- Build `variant_ids` array from all cart items:
  ```
  variant_ids: [vid1, vid1, vid2]  // 2x product A + 1x product B
  ```
- Or use existing multi-line-item support in shopify/orders.py
- After successful order: `codCart.clear()`

## Backend Changes (minimal)

### Order Creation (app/shopify/orders.py)
- Already supports `variant_ids` list — multiple line items work
- Each cart item becomes a separate line item in the draft order
- Quantity offers apply per-product (discount on matched variant only)

### Storefront Router (app/routers/storefront.py)
- No changes needed — `CodOrderRequest.variant_ids` already handles multi-variant
- Shipping rates: already use `order_total` param which sums all items

### Bumps Endpoint (app/services/bumps.py)
- Currently filters by single `product_id`
- Change: accept `product_ids` (comma-separated) or return all bumps if cart has multiple products
- Deduplicate: don't show a bump for a product already in cart

### Upsells Endpoint (app/services/upsells.py)
- Currently returns upsells for single `product_id`
- Change: return upsells for ALL cart products, deduplicated
- Don't upsell a product that's already in the cart

## Extension Liquid Changes (cod-form-embed.liquid)

- Script tag: still passes current product data (the JS handles cart merge)
- No structural HTML changes needed — JS dynamically builds the product list

## UI Mockup

```
┌─────────────────────────────────┐
│  Free shipping above 150 lei!  ×│
├─────────────────────────────────┤
│ Prenume *          [         ]  │
│ Nume *             [         ]  │
│ Telefon *          [07XX XXX ]  │
│ Județ *        [▾ Selectează ]  │
│ Oraș *             [         ]  │
│ Adresă *     [Strada, nr...  ]  │
│ Email              [         ]  │
├─────────────────────────────────┤
│ Your order (2 items)            │
│                                 │
│ [IMG] Genunchere Set 3    ×     │
│       40,00 lei  ̶1̶0̶0̶ ̶l̶e̶i̶       │
│       Qty: [1] [+] [-]         │
│                                 │
│ [IMG] Biberon Hands-Free  ×     │
│       80,00 lei  ̶1̶4̶9̶ ̶l̶e̶i̶       │
│       Qty: [2] (25% off!)       │
│       ┌─────┐ ┌──────────┐     │
│       │1 buc│ │2 Bib -25%│     │
│       └─────┘ └──────────┘     │
├─────────────────────────────────┤
│ Ai un cod de reducere?          │
│ Subtotal          120,00 RON    │
│ Popular           -40,00 RON    │
│ Transport          19,99 RON    │
│ ─────────────────────────────── │
│ Total              99,99 RON    │
├─────────────────────────────────┤
│ ⬇️ Oferte promoționale ⬇️      │
│ □ [IMG] Set Diversificare 84.99 │
│ □ [IMG] Protecții Colțuri  30   │
├─────────────────────────────────┤
│  [  Plasează comanda  ]         │
│  [  💳 Plată cu cardul ]        │
└─────────────────────────────────┘
```

## Implementation Order

1. **Cart manager** in JS (sessionStorage CRUD, max 10)
2. **Button badge** (cart count indicator)
3. **Product list UI** (replace single product card with list)
4. **Quantity integration** (read from page qty selector, respect offers)
5. **Order submission** (build variant_ids from cart)
6. **Bumps/upsells** multi-product support
7. **Testing** on both PrietenBebe and BebeMate
8. **Deploy** extension + theme assets

## Estimated Scope
- JS: ~300-400 new lines (cart manager + UI)
- CSS: ~50-100 new lines (cart list styling)
- Backend: ~20 lines (bumps/upsells multi-product)
- Liquid: minimal (no structural changes)
