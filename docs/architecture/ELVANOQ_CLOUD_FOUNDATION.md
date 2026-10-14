# ELVANOQ Play — Commercial architecture decision

Date: 2026-10-14
Status: foundation implementation, not production-ready.

## Decisions

- Product: **ELVANOQ Play**.
- Business model: independent player, no supplied content.
- Reference annual license per device: **R$ 24,90**, payable through policy-compliant channels.
- Planned infrastructure: **Hostinger VPS** (not provisioned).
- Legacy application: keep `com.fastshot.slitherproduction.flixplay` package until signing/update compatibility has been audited.
- Preserve Xtream and M3U profiles independently of app entitlement status.
- Do not proxy content or store content-provider credentials on the licensing API.
- First release is backend-only, isolated from the existing player and screens.

## Verified pre-implementation issues

- `app.json` defines version 2.17.11 / versionCode 20261026 while committed `android/app/build.gradle` has versionName 2.13.0 / versionCode 20261004.
- The committed Gradle release signing points at a debug signing config. Audit generated build and existing released APK signing before any change; do not regenerate or commit private keystore material.
- Current login Xtream/M3U and `services/security/secureStorage.ts` must be preserved and regression-tested.

## Phased delivery

1. API scaffold, typed domain schema, isolated repository changes (this change).
2. Database migrations, accounts/RBAC, device identity, pairing, idempotency and audit tests.
3. Signed entitlement issuance, revocation, time-window/offline policy and anti-abuse.
4. Admin/customer portal, compliance/privacy controls.
5. Channel-appropriate checkout and verified provider webhooks.
6. App integration, tests on Android/TV/Fire TV and safe rollout.
7. Tizen/webOS adaptations, store certification.

## Release gates

No license-enforcement flag enabled in Android until an end-to-end staging environment and rollback have passed. No payment activation based on client confirmation alone. No secrets committed to Git.
