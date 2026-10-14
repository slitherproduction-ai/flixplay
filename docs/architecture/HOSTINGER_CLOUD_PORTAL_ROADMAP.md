# ELVANOQ Cloud — Hostinger site and launch roadmap

Approved business configuration:
- Product: ELVANOQ Play independent player, without included IPTV or film/series rights.
- Reference annual software license: R$ 24,90 per device.
- Hosting target: Hostinger VPS. No provisioning or credentials have been supplied.

## Delivery sequence

1. **Backend quality gate:** run PostgreSQL lifecycle/concurrency tests and make schema migration reproducible in GitHub Actions.
2. **Licensing security:** signed entitlements, license status by authenticated device, expiry/revocation, replay protection, offline policy and end-to-end tests.
3. **Payment integration:** provider-agnostic checkout with validated webhooks and idempotency; Play Store-specific billing rules treated separately.
4. **Web portal implementation:** Next.js + TypeScript UI using ELVANOQ design tokens, responsive accessible layouts, customers and admin roles.
5. **Portal features:** marketing homepage, plan page, account creation/sign-in, device pairing/management, annual renewals, invoices/receipts, privacy requests, customer support. Admin: metrics, customer/device search, plan management, license auditing, payment reconciliation, support tools and role-based access.
6. **Hostinger deployment:** VPS inventory, Ubuntu hardening, domains, DNS, TLS, Nginx/Caddy, containerized API/web and PostgreSQL/Redis private network, external encrypted backups, monitoring, secrets rotation, staging/prod separation and rollback.
7. **Beta:** paid sandbox -> small pilot -> commercial release after store policy and LGPD review.

## Acceptance criteria for site

- Works responsively on smartphone, desktop, and modern browsers.
- Authorization applied server-side on every sensitive admin/customer operation.
- No Xtream/M3U credentials stored in licensing platform by default.
- Payment status is determined by verified server-side events, never a client callback.
- All mutations are auditable; backups are restorable and disaster recovery tested.
- Development/staging migrations, security scans, accessibility and end-to-end checkout all green.

Hostinger service subscription, domain setup and public publication require authorized access at deployment stage.
