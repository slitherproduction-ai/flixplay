# Checkpoint 32 — MFA foundation (not yet enforced)

Completed building blocks:
- Six-digit RFC6238 SHA1 TOTP verification with ±1 time-step skew.
- PostgreSQL `AdminMfaCredential` tied to a user with encrypted secret and `lastUsedStep` to support replay prevention.
- AES-256-GCM per-user authenticated encryption. `ADMIN_MFA_ENCRYPTION_KEY` must be a 32-byte random secret encoded in 64 hex digits, supplied only from a secrets manager.
- Unit tests for RFC vectors, tampering and cross-account secret isolation.

**Security status:** MFA is NOT yet part of login and no credential enrollment or single-use code consumption endpoint has been wired. A schema field alone does not prevent code reuse. Administrators can still log in with password only; DO NOT claim MFA enforcement or deploy the admin console. Before any live rollout, add enrollment, step-up challenges, atomic lastUsedStep check and update, recovery and rotation, and an admin session authentication-strength guard. Consider WebAuthn for phishing resistance.

Administrative writes remain disabled in production and no Hostinger deployment, billing or APK changes were made.
