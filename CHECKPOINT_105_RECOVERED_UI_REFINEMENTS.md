# Checkpoint 105 — Recovered UI refinements after workspace reset

Base recovered from Checkpoint 101: ELVANOQ 2.17.7 (`versionCode 20261022`).

## Restored changes

- Login footer displays the installed version and build on mobile and TV.
- Movie and series details use a full-bleed backdrop with a clean top and lower reading gradient.
- Glass surfaces use a blur intensity of 60; white focus surfaces remain solid.
- TV Home uses a compact Netflix-inspired layout with a 72 px collapsed rail, smaller controls and denser content rows.

## Integrity result

- Checkpoint 101 archive passed a full archive listing and extraction.
- Version/build metadata and native Android `MainActivity` source are present.
- The workspace reset removed dependencies, build caches and the local-only checkpoints 102–104. Full TypeScript and Jest validation must be re-run after the offline build kit is restored.
