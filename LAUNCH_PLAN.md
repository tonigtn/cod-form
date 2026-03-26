# COD Form App — Public Launch Plan

## Phase 1: Mandatory (Blocks App Store Submission)

### 1.1 Webhooks + GDPR
- [ ] Create `app/routers/webhooks.py` with HMAC body verification
- [ ] `POST /api/webhooks/app-uninstalled` — mark shop uninstalled, clear token, invalidate cache
- [ ] `POST /api/webhooks/customers-data-request` — query orders by phone_hash, log acknowledgment
- [ ] `POST /api/webhooks/customers-redact` — anonymize/delete customer data in orders, events, abandoned_forms
- [ ] `POST /api/webhooks/shop-redact` — delete ALL shop data (CASCADE from shops table)
- [ ] Register webhooks in `shopify.app.toml`
- [ ] Wire router in `app/main.py`

### 1.2 Fix CORS
- [ ] Remove `https://.*` from allow_origin_regex
- [ ] Only allow `*.myshopify.com` and `admin.shopify.com`

### 1.3 Storefront Authentication (App Proxy)
- [ ] Register App Proxy in `shopify.app.toml` (subpath `/apps/cod-form`)
- [ ] Create `app/routers/proxy.py` — mirrors storefront endpoints with HMAC verification
- [ ] All proxy requests verified via `verify_proxy_hmac()` from `auth.py`
- [ ] Keep direct `/api/cod/*` routes as fallback for existing private installs

### 1.4 Dynamic Extension URL
- [ ] Change `cod-form-embed.liquid` from hardcoded `https://api.magazinultarii.ro` to `/apps/cod-form` (app proxy)
- [ ] Extension JS `IS_PROXY` variable already handles proxy mode

### 1.5 Single Public App Credential
- [ ] Create Partner Dashboard app with single client_id/secret
- [ ] Update `shopify.app.toml` with public app credentials
- [ ] Keep multi-credential support for backwards compat with existing 4 stores

### 1.6 Privacy Policy + ToS
- [ ] Create privacy policy page (hosted or static)
- [ ] Create terms of service page
- [ ] Configure URLs in Partner Dashboard

---

## Phase 2: Production Quality (Before launch)

### 2.1 Per-Shop Rate Limiting
- [ ] Add `{shop_domain: [timestamps]}` tracking alongside IP-based
- [ ] 100 orders/hour per shop, 5 orders/minute per IP
- [ ] Periodic cleanup of stale entries
- [ ] Higher limits for read-only endpoints (form-config, offers, bumps)

### 2.2 Persistent OAuth Nonces
- [ ] Move from in-memory dict to DB table: `nonces(nonce, shop, client_id, created_at)`
- [ ] Auto-delete nonces older than 10 minutes

### 2.3 Persistent OTP Store
- [ ] Move from in-memory to DB table: `otp_codes(shop, phone_hash, code_hash, expires_at, attempts)`
- [ ] Hash OTP codes before storage

### 2.4 Post-Install Setup
- [ ] After OAuth callback, fetch shop info from Shopify `shop.json`
- [ ] Auto-populate locale, currency, country_code, store_name
- [ ] Create default config sections on first install
- [ ] Redirect to app admin page (not generic /admin/apps)

### 2.5 Structured Error Handling
- [ ] Global exception handler — logs with structlog, returns generic 500 JSON
- [ ] Scope validation error handler to storefront routes only

### 2.6 Data Retention
- [ ] Scheduled cleanup: events > 90 days, abandoned_forms > 30 days
- [ ] Document retention policy in privacy policy

### 2.7 Alembic Migrations
- [ ] Initialize Alembic with `alembic init`
- [ ] Create initial migration from current schema
- [ ] All future schema changes via Alembic

### 2.8 Cache Bounds
- [ ] LRU limit on config cache (max 500 shops)
- [ ] Token cache invalidation on uninstall webhook

---

## Phase 3: Scaling + Testing (Before significant traffic)

### 3.1 Test Suite
- [ ] `tests/conftest.py` — mock DB pool, FastAPI TestClient
- [ ] `tests/test_auth.py` — HMAC verification, nonce validation
- [ ] `tests/test_webhooks.py` — webhook HMAC, uninstall cleanup, GDPR
- [ ] `tests/test_storefront.py` — order creation, rate limiting, fraud
- [ ] `tests/test_session.py` — JWT verification, expiry
- [ ] `tests/test_store_config.py` — config loading, caching

### 3.2 Billing (if charging)
- [ ] `app/shopify/billing.py` — GraphQL mutations for subscriptions
- [ ] `app/routers/billing.py` — plan selection + confirmation
- [ ] `subscriptions` DB table
- [ ] Middleware to check subscription status
- [ ] Free trial (7-14 days)

### 3.3 Logging + Monitoring
- [ ] structlog JSON output in production
- [ ] Request ID middleware for log correlation
- [ ] Health endpoint with DB connectivity check

### 3.4 Deployment
- [ ] Dockerfile + docker-compose.yml
- [ ] Procfile for Railway/Render/Fly.io
- [ ] Environment-based config for staging vs production

### 3.5 Frontend Session Refresh
- [ ] Catch 401 in `client.ts`, clear cache, re-auth silently
- [ ] Show "Session expired" message if re-auth fails

### 3.6 Deprecate Legacy Store Map
- [ ] Log deprecation warning when `store_id` used instead of `shop`
- [ ] Make legacy map configurable via env var
- [ ] Plan removal timeline

---

## Phase 4: Nice-to-Have (Post-launch)

- [ ] DB connection pool scaling (20-50 connections, or PgBouncer)
- [ ] Shopify API version rotation plan (quarterly)
- [ ] Shared httpx.AsyncClient for connection pooling
- [ ] Admin UI localization
- [ ] CSP headers on all routes
- [ ] Analytics dashboard improvements
