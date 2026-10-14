# Checkpoint 38 — MFA recovery concurrency safeguards

Recovery request creation now uses a PostgreSQL transaction-scoped advisory lock keyed by the target administrator, and checks for an unexpired pending request under that lock. Simultaneous attempts cannot establish two pending recoveries for the same administrator. Approval now applies the expiry predicate in the conditional update as well as in the initial read, preventing approval after expiration even if the deadline passes between checks.

Integration regressions cover simultaneous requests to one account and rejection of an expired approval. Recovery remains **approval-only** (`resetEnabled: false`). No MFA credential reset, password-only recovery, billing, production license mutation, live deployment, or APK changes.

Production blockers: verified independent identity evidence, a controlled one-time recovery grant, replay and audit checks, authorization reviews, robust abuse throttling, and browser E2E validation.
