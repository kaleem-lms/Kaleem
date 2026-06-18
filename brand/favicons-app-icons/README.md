# `favicons-app-icons/` — Kaleem favicons & app icons

Each entry ships as `<stem>.svg` + `<stem>.png`. See [`../ASSET-INDEX.md`](../ASSET-INDEX.md) §2.

| Stem | Use |
| --- | --- |
| `favicon-light` / `favicon-dark` | Browser tab — export 16/32/48 px, assemble `favicon.ico`; keep `.svg` |
| `pwa-icon-512` / `pwa-icon-512-dark` | `manifest.webmanifest` `icon-512` |
| `android-adaptive-icon` | Android adaptive icon (full-bleed emerald, inner safe circle) |
| `ios-app-icon` | iOS home-screen icon (1024 master, no transparency) |
| `apple-touch-icon` | `apple-touch-icon.png` 180×180 |
| `maskable-icon` | PWA `purpose:"maskable"` (mark within 80% safe zone) |

**Rules:** app-icon tiles are solid emerald `#0E5C4F` with the mark in cream `#FAF7F0`
(+ optional gold dot). Must read at favicon scale and survive circular/squircle masking.
