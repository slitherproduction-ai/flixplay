# ELVANOQ Cloud — License API (foundation)

Isolated NestJS API foundation for the ELVANOQ Play commercial licensing platform. This branch does **not** enable payments or block application playback. Do not deploy as a production licensing server until authentication, signed entitlements, rate limiting, migrations, webhooks, backups and audit validation are implemented.

## Local setup

1. Start PostgreSQL 16 locally.
2. Copy `.env.example` to `.env` and set strong private values.
3. `npm install`
4. `npm run db:generate`
5. `npm run db:migrate` (development only)
6. `npm run dev`
7. GET `http://localhost:3001/v1/health` should return `status: ok`.

## Commercial decisions

- ELVANOQ Play is independent player software and supplies no content.
- Reference annual license: BRL 24.90 per device, represented in minor units as `2490`.
- Subscription authorization and content-provider credentials are distinct.
- Device registration uses an installation-generated key / public code, not privileged access to the hardware MAC.
- No sensitive credentials or provider streams are sent to the licensing service.
- Checkout is deliberately **not** present: payment policies depend on distribution channel.
- Status and validity must ultimately be enforced server-side using signed, expiring entitlements.

## Current scope

Schema for users, devices, plans, licenses, pairing sessions, payments and audit logs; environment validation; a read-only health endpoint. Next increment: authentication, database access layer, migration SQL, secure registration and pairing with rate limits and tests.

## Checkpoint 02 — Device bootstrapping (not a full activation flow)

- `POST /v1/devices/register` with JSON `{"platform":"ANDROID_TV","displayName":"Sala"}` returns an opaque device ID, public code and **one-time visible** device secret.
- `POST /v1/devices/:id/pairing` requires `Authorization: Bearer <deviceSecret>` and returns an 8-digit code valid for five minutes.
- All API routes have a basic per-IP rate limit. In multi-instance deployments, replace in-memory throttling with shared storage and configure trusted reverse-proxy IP forwarding safely.
- Pairing claims by authenticated customers, license grants, user accounts and paid checkouts are **not implemented**.
- The device secret must be stored using Android secure storage; it is not a physical MAC and is not a playlist credential.
- Add security regression tests and a staging migration before exposing any of these endpoints publicly.
