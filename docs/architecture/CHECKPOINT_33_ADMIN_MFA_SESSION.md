# Checkpoint 33 — Administrative MFA session gate

Implemented staging administrative MFA: password login issues a normal bearer session, but all administrative read endpoints and internal test license mutations now require a recent MFA-verified session (15-minute step-up window). Customer sessions and API endpoints remain unchanged.

- POST `/v1/auth/admin-mfa/enroll` authenticates an ADMIN and permits a first-time credential only; returns one-time authenticator setup URI and stores its secret encrypted with AES-256-GCM using `ADMIN_MFA_ENCRYPTION_KEY`. Re-enrollment is blocked pending a secure recovery process.
- POST `/v1/auth/admin-mfa/verify` checks six-digit TOTP, atomically consumes the specific 30-second counter using `lastUsedStep`, and marks the bearer session `mfaVerifiedAt`. Replaying the same code is rejected, even on a different admin session for the same account.
- The portal `/admin.html` presents a separate MFA challenge after password login; the admin dashboard is not loaded until verification succeeds.
- Migration adds `CustomerSession.mfaVerifiedAt` and automated database integration tests check password-only rejection, accepted MFA, code replay and customer enrollment rejection.

**Deployment blockers:** secure out-of-band bootstrap, key rotation, MFA recovery, lockout/rate limits, challenge/audit denial logging, session/device management, E2E browser tests and phishing-resistant WebAuthn should be assessed before production. The enrollment URI contains a sensitive secret; never log or share it. Production license mutations remain disabled, and no APK or Hostinger deployment is made.
