# Checkpoint 59 — Hostinger staged rollout and rollback

This is a runbook only. Nothing has been deployed to Hostinger. ELVANOQ Play **2.17.13** is the user-reported APK version; its binary, signing and compatibility have not yet been independently verified.

## Release gates
- Authorized isolated VPS and domain, private staging secrets and trusted HTTPS proxy.
- Backups created and successfully restored before schema changes. Migration reversals require a separate data-safe plan; a container rollback does not roll back a database schema.
- Freeze and record the Git commit/image digest used in staging; do not use floating latest tags for release history.
- Build API and portal, review environment settings and explicitly run reviewed Prisma migrations.
- Inspect private Compose configuration without recording secrets: docker compose -f infrastructure/hostinger/compose.staging.yml --env-file /secure/path/staging.env config
- Bring up staging only after approval. Check postgres health, API health and real authenticated workflows. Exercise 429 throttling and 503 degraded state; check logs for leaked credentials. Test TLS/DNS and portal CORS separately.

## Release and rollback
1. Save current image digest/commit, configuration revision and database backup identifier securely outside git.
2. Build the candidate and run integration tests in staging.
3. Deploy one reviewed change and inspect docker compose ps; verify API /v1/health through localhost and, after certificates, the trusted HTTPS proxy.
4. If API/portal regression occurs, redeploy the previously recorded image/commit and recheck health and business flows. Do **not** delete PostgreSQL volumes or run docker compose down -v.
5. If schema change is incompatible, restore only under an explicitly approved database recovery procedure. Never treat migration rollback as automatic.
6. Leave production and license/payment mutation disabled until formal acceptance.

## Limitations and unresolved blockers
- No real VPS, network outage/recovery test, container launch or rollback was executed.
- This Compose is a candidate for staging, not a production deployment definition.
- Auth settings and security headers must be verified before exposing services.
- Health endpoint availability alone does not certify device licensing, payments, entitlement signing or database recovery.
- Next tasks: staging-only validation pipeline for Compose config, trusted-proxy review, immutable artifacts, backups and staging exercise.
