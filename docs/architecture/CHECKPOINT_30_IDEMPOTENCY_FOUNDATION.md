# Checkpoint 30 — persistent idempotency foundation

Added database schema and migration for `AdminMutationReceipt`, with unique `requestKey`, actor ID, operation, target ID and JSON result. This is database groundwork only. **No administrative mutation currently reads or writes this model**, therefore idempotency is not yet enforced through receipts.

All production administrative writes remain blocked. Existing test-only renewal expiration precondition remains in force. To finish this checkpoint: integrate receipt validation and persistence in the same serializable transaction as mutations, reject reuse across actor/operation/target, implement concurrent replay tests, and verify the CI pipeline. Do not label the feature production ready until these checks pass.
