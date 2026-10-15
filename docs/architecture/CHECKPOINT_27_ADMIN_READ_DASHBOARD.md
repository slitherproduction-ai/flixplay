# Checkpoint 27 — ELVANOQ Cloud admin dashboard (read-only)

The backend exposes three ADMIN-only authenticated GET endpoints: `/v1/admin/overview`, `/v1/admin/customers?page=N`, and `/v1/admin/licenses?page=N`. Every request validates the bearer session then looks up the current user's `ADMIN` role; customers and support roles cannot access these administrative lists. Responses explicitly select safe fields, exclude secrets and password hashes, and paginate 25 rows per page (bounded page number).

Web dashboard: `/admin.html` in `apps/cloud-portal`, separate from the customer portal. It authenticates against `/v1/auth/login`, checks actual admin authorization with `/v1/admin/overview`, displays metrics and customer/license lists, and allows page navigation and logout. Bearer session is held in memory only.

PostgreSQL integration tests assert admin role isolation, secret exclusion, and page limits.

**Not production ready:** MFA, detailed audit logging for admin reads, stricter rate limits, session revocation management, browser staging E2E, security headers and infrastructure. This dashboard has no license modification, renewal or payment controls. Hostinger is not deployed. APK 2.17.11 is not changed.
