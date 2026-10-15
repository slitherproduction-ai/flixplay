# Checkpoint 26 — Customer devices and licenses

## API
- `GET /v1/devices/mine` requires an authenticated customer Bearer session (existing AuthService).
- Returns up to 100 devices filtered by `userId`, with displayName, platform, publicCode, createdAt, lastSeenAt and associated licenses with plan name/code/duration, status, startsAt, expiresAt and revokedAt.
- Device secret, hash, proof public key and challenge records are deliberately excluded using Prisma `select`. Another customer cannot list devices outside their session's user ID.
- Integration tests in `customer-devices.integration.spec.ts` verify tenant isolation and omission of sensitive fields.

## Web portal
- After login, `GET /v1/devices/mine` renders responsive device cards and license statuses, plans and expiry dates.
- The list is refreshed on successful device claim and from an explicit refresh button.
- Only authoritative API data is shown; missing licenses appear as 'no license', not 'active'.
- Session remains in memory; it is cleared with logout. The portal is still an isolated prototype; no Hostinger deployment, checkout, renewal flow, admin console or production authorization gate.

## Release gates
- Validate backend and portal GitHub Actions.
- Test authenticated browser end to end against staging HTTPS API and real PostgreSQL.
- Review throttling, pagination, security headers and account recovery before deployment.
- No changes to Android 2.17.11 release or to IPTV playback requirements.
