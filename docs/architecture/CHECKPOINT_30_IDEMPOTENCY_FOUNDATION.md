# Checkpoint 30 — Transactional idempotency receipts

The PostgreSQL `AdminMutationReceipt` table has a unique `requestKey` and stores actor, operation, target and JSON result. Internal **test-only** issue, renew and revoke paths now read and write these receipts inside the same serializable database transaction as the license mutation and audit log, after acquiring the existing per-device advisory lock. A repeated key for the same actor/action/target returns the previously stored outcome; reusing a key for another operation returns a conflict. Renewed license dates are hydrated from persisted JSON.

The internal HTTP endpoints require a client-generated UUIDv4 `requestKey` in the body alongside explicit confirmation, and renew additionally requires `expectedExpiresAt`. Service-level callers omitting a key generate a fresh UUID for compatibility with existing test clients, so callers must explicitly reuse the key to obtain idempotent replay.

Tests include a repeated renewal with the same request key and old expiration precondition. **Production administrative writes remain disabled.** Open gates: concurrent replay tests, broader HTTP e2e tests, MFA, denials auditing, and production approval flow. No payment integration or Hostinger deployment.
