# ELVANOQ Play Android licensing SDK contract — preparation only

This is a design contract, **not yet an Android implementation**. Existing Expo/React Native 2.17.11 remains unaffected.

1. Device initializes once and stores returned `deviceSecret` in platform secure storage. Avoid storing sensitive secrets in plain AsyncStorage.
2. Device generates a non-exportable Ed25519 signing key in an Android Keystore-compatible provider. Verify actual Fire TV/Android API 24 support; fallback must not silently reduce assurance.
3. POST `/v1/devices/:id/proof-key` with `{publicKeyPem}` and existing device Authorization Bearer, exactly once. Enrollment recovery requires authenticated server action.
4. POST `/v1/devices/:id/challenge` with device bearer; obtain a 60-second nonce.
5. Sign UTF-8 `ELVANOQ-ENTITLEMENT-PROOF-V1\n<deviceId>\n<nonce>` with the private key and send Base64URL signature via POST `/v1/devices/:id/entitlement/proof`, containing `{nonce,signature}`.
6. Verify the server Ed25519 entitlement using trusted pinned public key, expected device ID, issuer/audience, issued/expiration times and known key ID. Store only a bounded, short-lived cache and schedule renewal before expiration.
7. Do not allow a request failure to erase Xtream/M3U credentials or content-profiles. Initial integration runs telemetry-only behind feature flag, with no playback blocking.

Security gate: protect bootstrap enrollment against stolen Bearer secrets, add secure recovery/rotation, per-device quotas, and device proof integration tests before public release.
