# Checkpoint 28 — Administrative license preflight

The pre-existing test-only mutation endpoints `/v1/internal/test-licenses` remain disabled in production and are not exposed in the admin dashboard. This checkpoint adds `GET /v1/admin/licenses/:id/preflight`, which requires a valid ADMIN account session and returns a non-binding eligibility preview (renew/revoke) using current status, revocation, plan and overlapping licenses. **This is a read-only point-in-time estimate and is not sufficient authorization to mutate.** No payment, license state or audit record is written by this endpoint.

The separate admin portal now offers a "Verificar elegibilidade" button with the read-only result, without execution controls. Integration tests cover rejection of ordinary customer access.

Before adding real administrative mutations: independently authorize each operation, implement dual confirmation and idempotency keys, ensure audit records are transactional, check races under locks, require MFA and rate limits, and decide business policy for unpaid licenses. Production writes must remain disabled until approved.
