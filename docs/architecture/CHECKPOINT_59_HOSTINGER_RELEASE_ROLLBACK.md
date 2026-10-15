# Checkpoint 59 — Hostinger staging release and rollback runbook

Status: preparation only; NO deployment executed. App reference release: ELVANOQ Play **2.17.13** (reported released; APK signing, package and upgrade compatibility still require independent verification).

## Preflight gates (all mandatory before applying on an authorized staging VPS)

- Confirm VPS ownership/access, non-root SSH, firewall, DNS, valid TLS certificates, and Nginx configuration test.
- Keep staging environment/secrets outside Git; NEVER print resolved Docker Compose config containing secrets.
- Use an immutable Git commit SHA for each staging release; archive previous commit and current deployment metadata.
- Verify isolated PostgreSQL backups AND a restore test before migrations; migrations may not be rolled back safely just by reverting app code.
- Ensure authentication secrets, CORS origin, API health endpoint and proxy client-IP behavior are validated.
- Keep billing, production license mutations, real MFA reset and client entitlement enforcement disabled.

## Proposed manual staging rollout

1. Record currently deployed git SHA, image digest and PostgreSQL schema version.
2. On an approved isolated staging VPS, back up DB and verify restore.
3. Pull a reviewed, pinned commit; validate Compose configuration privately.
4. Build new image, apply reviewed staging migrations and check expected schema.
5. Start staging containers and confirm PostgreSQL health.
6. Probe http://127.0.0.1:3001/v1/health on VPS (not publicly), then test HTTPS /v1/health through Nginx.
7. Verify 401/403 authentication gates, 429 throttling, 503 fail-closed behavior, 200 recovery and portal auth/CORS.
8. Review logs for leaks, run rollback drill, and record sign-off.

## Rollback policy

- Stop new traffic or revert proxy upstream to a previously healthy candidate.
- Re-deploy the previous pinned API image (and previously reviewed portal static build); verify both health endpoints and authorization.
- NEVER automatically reverse database migrations or restore a database snapshot without a documented decision about data loss and compatibility.
- For incompatible schema changes, use expand/contract migrations and prepared forward fix, or an explicitly approved restore plan.
- Keep snapshots encrypted and access controlled.

## Remaining before production

Test this runbook on a real isolated VPS; add health checks with timing/error budgets and diagnostics; validate the ELVANOQ Play 2.17.13 APK signature/update compatibility and app-to-Cloud staging handshake; payments in sandbox only; review LGPD and store rules.

Related: CHECKPOINT_57_HOSTINGER_STAGING_FOUNDATION.md, CHECKPOINT_58_HOSTINGER_HTTPS_PROXY.md.
