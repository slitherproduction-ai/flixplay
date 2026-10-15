# Checkpoint 24 — TV device activation staging interface

Added a premium-focusable React Native route at `app/settings/cloud-activation.tsx`, registered in RootLayout. The route is not linked from production menus and requires `EXPO_PUBLIC_ELVANOQ_LICENSE_OBSERVER=true` to permit activation actions. The screen works with D-Pad, renders an 8-digit short-lived pairing code and safe status messages.

Explicit user action: registration, securely storing the device bearer via Expo SecureStore, and POST `/v1/devices/:id/pairing` with the bearer. The account owner must later claim that code using the authenticated backend `/v1/devices/claim` endpoint. No simulated 'activated' status is shown; UI only displays code and its expiration. Full portal claiming interface is not yet implemented.

No new APK release, no mandatory license gate, no automatic registration, no real billing, and no Hostinger deployment. A build passing is not proof of Fire TV/API 24 cryptography support. Device verification and lifecycle remain staged.
