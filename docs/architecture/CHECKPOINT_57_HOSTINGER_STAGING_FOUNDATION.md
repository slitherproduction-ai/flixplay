# ELVANOQ Cloud — Hostinger VPS staging preparation

Status: files prepared in Git only. No Hostinger credentials, subscription, SSH access, VPS provisioning, DNS change or deployment performed.

## Staging topology

- Dedicated PostgreSQL 16 volume, reachable only inside the Compose network.
- NestJS license API mapped to 127.0.0.1:3001 on the VPS; do not expose port 3001 publicly.
- Future HTTPS reverse proxy must be placed in front of this endpoint, with trusted forwarded headers, request limits and valid certificates.
- Deploy production separately only after independent security, payment, database backup/restore, privacy and rollback acceptance.

## Required staging prerequisites

1. An authorized Hostinger VPS with restricted SSH keys, non-root deployment user, firewall and unattended security updates.
2. Private environment file outside the repo: STAGING_POSTGRES_PASSWORD, STAGING_DATABASE_URL (host = postgres, database = elvanoq_staging), STAGING_CORS_ORIGINS (the staging HTTPS portal origin).
3. Separate application secrets, authentication configuration and any runtime environment required by the license-api. Never commit credentials or reuse production secrets.
4. Private backup target with verified restoration procedure.
5. Confirm the containerized API can boot with the staging environment and that migrations are applied explicitly and reviewed before any external access.
6. HTTPS reverse proxy and domain/subdomain with DNS authorization; validate the client IP policy to prevent spoofed forwarded headers.

## Manual commands for an approved isolated VPS

Run from the repository root only after completing prerequisites:

`docker compose -f infrastructure/hostinger/compose.staging.yml --env-file /secure/path/staging.env config`

Review the resolved configuration **privately**: it contains secrets and must not be pasted into logs or chat.

`docker compose -f infrastructure/hostinger/compose.staging.yml --env-file /secure/path/staging.env up -d --build`

Schema migrations and seeding must be separately reviewed; no automated production migrations or auto-seeding are enabled here.

## Blockers before deployment

This is scaffolding, not a certified deployment recipe. Validate runtime authentication env vars, container health, handling of restart/DB outages, Postgres and API network policy, external reverse proxy TLS, backups, logging redaction, backup restore, capacity and rollout. The public portal is not yet served by this Compose file. Payment processing must remain disabled.

No Android signing or APK changes in this checkpoint.
