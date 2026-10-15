# Checkpoint 58 — Hostinger staging HTTPS reverse proxy

Created example Nginx configurations for dedicated staging API and portal hostnames. They are templates only; the placeholder .invalid hostnames cannot be used publicly and certificate files are not present until provisioning.

- API: reverse proxy to 127.0.0.1:3001, TLS 1.2/1.3, body-size limit and timeout controls.
- Proxy overwrites X-Forwarded-For with $remote_addr to prevent clients from directly supplying arbitrary chains, but the NestJS trust-proxy and IP-based rate-limit configuration must be explicitly tested before external exposure.
- Portal: serves an independently reviewed static Vite build; no payment interface is activated.
- Validate Nginx syntax with nginx -t and verify certificates and DNS before enabling these examples.
- DNS setup, TLS certificate issuance, VPS access, secrets, backups, system hardening, restart tests and actual deployment remain pending. Do not enable these files on production without separate review.

Nothing was deployed to Hostinger; ELVANOQ Android v2.17.11 was not modified.
