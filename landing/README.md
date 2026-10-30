# Dodoi landing page

A static, dependency-free landing page for Dodoi **v0.2.1**. It shares the app's visual language: a near-black canvas, lime accent, glass panels, Space Grotesk display type, Inter body type, and the floating translator overlay as the hero.

## Preview locally

The page has no build step. Any static file server works:

```bash
python3 -m http.server 4173 --directory landing
```

Then open <http://127.0.0.1:4173/>.

Opening `landing/index.html` directly in a browser also works, because every asset uses a relative path.

## What is included

- `index.html` — semantic single-page layout: hero, language marquee, features, offline engine, product screenshots, how it works, download, and footer
- `styles.css` — design tokens, glassmorphism, responsive layout, motion, and reduced-motion support
- `script.js` — progressive enhancement for:
  - live translation preview with an accessible language picker
  - Arabic/English language switching with RTL layout and localized copy
  - Dark/Light theme switching with persisted preferences and no FOUC
  - translate/copy-style interaction and automatic language cycling
  - `Shift` + `~` summon preview with focus trapping and `Esc` to close
  - cloud/local switch preview and offline “airplane mode” engine state
  - screenshot tabs with keyboard navigation
  - OS-aware direct download button (Windows, macOS, or Linux)
  - pointer-aware card lighting, tilt, scroll reveals, and scroll spy
- `assets/` — self-hosted fonts, app icon, product screenshots, and the three OS logos:
  - `assets/windows-logo.png`
  - `assets/macos-logo.png`
  - `assets/linux-logo.png`
- `assets/fonts/OFL.txt` — licensing for the bundled font families

## Download cards

Every v0.2.1 variant is listed on its platform card with an OS logo and a direct release link:

| Platform | Variants |
| --- | --- |
| Windows | `Dodoi-Setup-0.2.1-x64.exe` (installer) |
| macOS | `Dodoi-0.2.1-arm64.zip` (Apple Silicon) and `Dodoi-0.2.1-x64.zip` (Intel) |
| Linux | `Dodoi-0.2.1-x86_64.AppImage` and `Dodoi-0.2.1-amd64.deb` |

The primary button detects the visitor's OS and points at the best default; the version links always expose every asset.

## Publishing

Deploy the contents of this directory as the site root. For GitHub Pages, point the Pages source at this folder (or copy it to a `gh-pages` branch / Pages artifact in a workflow). No server-side code or environment variables are required.

## Notes

- All animation respects `prefers-reduced-motion`.
- Language and theme choices persist in `localStorage` (`dodoi-lang`, `dodoi-theme`); shareable overrides use `?lang=en|ar` and `?theme=light|dark`.
- The page is intentionally self-contained and makes no third-party requests for its own assets.
- The language preview uses a small set of representative languages from the 33 supported by the app.
- Download buttons link directly to the assets on the [`v0.2.1` GitHub Release](https://github.com/azzamalessa188-star/dodoi/releases/tag/v0.2.1). GitHub serves them as attachments, so the browser downloads the file without navigating away from the page. Builds are unsigned; the page notes that the OS may ask for approval.
- **Auto-update is enabled for v0.2.1.** The release publishes installer builds with `latest*.yml` manifests, so installed copies can update automatically.
