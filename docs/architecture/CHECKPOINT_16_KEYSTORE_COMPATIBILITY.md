# Checkpoint 16: Android native capability gate

The API currently verifies Ed25519 device signatures. Android Keystore support for non-exportable Ed25519 must not be assumed on API 24 or Fire TV.

Added ELVANOQLicenseKeyCapability native module reporting Android API level and a disabled signing capability. The module does not generate or export keys. Added a TypeScript probe. No licensing enforcement is enabled.

Next milestone: implement an audited ECDSA P-256 signing protocol on backend and Android Keystore, or demonstrate supported hardware-backed Ed25519. Do not fall back to storing private keys in JavaScript. Hardware tests and Android build are still required.

The app's licensing observer remains disabled by default. No customer activation or paid billing is enabled.
