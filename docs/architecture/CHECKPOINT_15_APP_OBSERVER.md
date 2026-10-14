# Checkpoint 15 — Android observe-only integration

The app receives an isolated feature-flagged observer in `services/license-observer.ts`.

- Disabled by default: `EXPO_PUBLIC_ELVANOQ_LICENSE_OBSERVER` must be `true`.
- URL comes from `EXPO_PUBLIC_ELVANOQ_LICENSE_API_URL`; production traffic must use HTTPS.
- Device registration credentials may be stored with `expo-secure-store` only after verified enrollment.
- No native Ed25519 signer currently exists in the app: without it, observer returns `NOT_CONFIGURED` and never falls back to unsafe bearer-only entitlement requests.
- No token trust decision, no playback blocking, no user lockout, and no automatic device registration.
- Existing Android APK 2.17.11 has not been rebuilt. This is branch-only preparation.
- Next: Android Keystore compatibility investigation across API 24, Google TV and Fire TV, pin trusted verification keys, implement signed JWT verification, and test on hardware before enabling observation.
