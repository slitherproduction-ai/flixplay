# License lifecycle

Validate at launch and after returning from the background. An authorized foreground session does not poll its license or query the Portal for every playback. Pending activation may keep polling to receive the Portal link. Explicit user actions (activation check, server-code login, payment confirmation) may also validate.

Temporary network failures, HTTP 429 and HTTP 5xx do not imply an expired license. Reuse only a previously confirmed grant for the same device/session, for at most 24 hours at a validation boundary. Known expiry and explicit denial take precedence; a first-time offline device is never automatically authorized. Android-family grants use SecureStore and are bound to device identity and profile; TV web/Roku grants remain session-scoped. IPTV username/password authentication remains mandatory and separate from licensing.

Native/store applications require rebuilding and distributing a new package. Web worker publication updates browser/MSX apps when reloaded. No Portal backend, license records, device keys, IPTV hosts or disabled platforms were modified.
