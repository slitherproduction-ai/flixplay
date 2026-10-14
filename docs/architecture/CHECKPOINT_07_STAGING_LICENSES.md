# ELVANOQ Cloud — Checkpoint 07: staging-only license mutation

Date: 2026-10-14
Pull Request: #10 (draft)
Branch: feature/elvanoq-cloud-foundation

## Scope

- Administrator-only test issuance, renewal and revocation of an annual 365-day license.
- Feature gate LICENSE_ADMIN_WRITES_ENABLED=true is required, and all mutations are blocked when NODE_ENV=production.
- A linked device and a pre-provisioned active plan with code ELVANOQ_ANNUAL_2490, priceCents=2490, currency=BRL, durationDays=365 are mandatory.
- Transactional per-device PostgreSQL advisory lock and Serializable isolation protect against duplicate issuance within this API.
- Renewal extends from the future expiry or from now for expired subscriptions.
- Revoked/suspended licenses cannot be renewed. All successful mutations create audit entries.

## Staging endpoints

- POST /v1/internal/test-licenses/issue — authenticated ADMIN Bearer token; JSON body containing deviceId (UUID).
- POST /v1/internal/test-licenses/:id/renew — authenticated ADMIN Bearer token.
- POST /v1/internal/test-licenses/:id/revoke — authenticated ADMIN Bearer token.

## Explicit exclusions / security notes

- There is **no** public paid purchase path, payment verification, customer self-activation, entitlement token signing, or playback blocking.
- The admin role is never granted via signup; provisioning ADMIN must use a controlled out-of-band operation in a private test DB.
- The annual plan must be inserted via controlled seed procedure in staging; not via untrusted client requests.
- Production endpoints remain registered but deny all mutations; remove these routes from production builds before launch.
- Future payment-based issuance must share the same lock and validation routines to avoid bypasses.
- Validate tests, Prisma migrations, overlapping-license race tests and SQL locking behavior before trusting the implementation.
- Do not publish API to Internet or connect the current Android 2.17.11 app.
