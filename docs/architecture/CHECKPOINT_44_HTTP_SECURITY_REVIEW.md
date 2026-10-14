# Checkpoint 44 — HTTP authentication security review

Authentication responses at `POST /v1/auth/login`, `/register` and `/logout` are marked `Cache-Control: no-store` at the controller level, preventing compliant HTTP clients and intermediaries from caching bearer tokens. This is a defense-in-depth measure, not a replacement for HTTPS or secure token handling.

The staging authentication and recovery APIs remain restricted: MFA recovery test grants never reset credentials, and production license writes remain disabled. Further homologation work: extend no-store to administrator MFA endpoints, apply UUID validation at HTTP boundaries, run HTTP integration tests including proxy and throttling behavior, and use distributed throttling before a multi-replica deployment.
