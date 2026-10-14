# Checkpoint 29 — internal license mutation confirmations

The existing *internal test-only* license issue, renew and revoke endpoints now require an explicit confirmation phrase (`CONFIRMAR_OPERACAO_TESTE`) in the request body. The renewal request additionally requires the currently observed `expectedExpiresAt` ISO timestamp; within a serializable transaction and a PostgreSQL per-device advisory lock, the service compares the present expiration and state against that precondition. A repeat renewal with an old precondition is rejected instead of extending the subscription twice.

**Important boundaries:** these are staging controls, not a production-grade idempotency-key store or second-factor authentication. Concurrent test mutations rely on existing transaction retry/overlap rules; production writes remain disabled by `NODE_ENV=production` and the `LICENSE_ADMIN_WRITES_ENABLED` gate. The web portal still only supports read-only preflight, not license modifications. Test service already writes audit records transactionally for successful issue/renew/revoke. Before any production activation: persistent unique idempotency keys, audit of denied attempts, MFA, approval policy and end-to-end security tests.

Checkpoint 28 backend CI passed. No billing, Hostinger deployment or Android app release changes.
