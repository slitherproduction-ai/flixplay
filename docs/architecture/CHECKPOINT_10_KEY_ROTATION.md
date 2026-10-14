# Checkpoint 10 — Signed entitlement key rotation

Date: 2026-10-14. Draft PR #10.

- Signer supports `ENTITLEMENT_KEY_ID` (`v1` by default) as JWT `kid` and `ENTITLEMENT_PRIVATE_KEY_PEM` from server-side configuration only.
- Verifier selects a public key from a trusted list by `kid`; unknown keys, forged signatures, wrong device ID, expired or overlong lifetime tokens are rejected.
- Rotation: publish new public verification key alongside the old key, change server signer `kid` and private key, wait beyond the maximum token lifetime, then retire the old public key. Distribute keys through a trusted signed app update, not a mutable unauthenticated endpoint.
- Maximum token lifetime currently 5 minutes on issued entitlements; no offline grace. Revoked licenses stop receiving new entitlements, but previously issued tokens remain cryptographically valid until expiry. Immediate revocation would require an online authoritative check or revocation list.
- Endpoints are backend-only; Android player still unchanged. No live payments, Hostinger deployment or production keys.
- Device possession, replay resistance, attack rate-limits, key compromise recovery and signed key distribution need additional design and testing before production use.
