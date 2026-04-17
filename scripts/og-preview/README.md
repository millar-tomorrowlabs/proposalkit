# OG preview + favicon regeneration

Social-share image (`public/og-image.png`) and iOS home-screen icon
(`public/apple-touch-icon.png`) are rendered from the HTML templates
in this directory. If the tagline, branding, or colors change, regen
both by:

1. Serve this directory locally:
   ```bash
   cd scripts/og-preview
   python3 -m http.server 8765
   ```

2. Open the two URLs in a browser sized to match:
   - http://localhost:8765/og.html at 1200x630 → save as `public/og-image.png`
   - http://localhost:8765/apple-touch.html at 180x180 → save as `public/apple-touch-icon.png`

Browser DevTools: ⌘⇧P → "Capture full-size screenshot" while viewport
is set to the right dimensions.

## Favicon

`public/favicon.svg` is SVG-only — edit the source paths directly.
Modern browsers support SVG favicons; we skip the PNG favicon fallback
since our audience is on current browsers.

## Meta tags

The `<link>` and `<meta>` wiring lives in `/index.html`. If you rename
or move any of these files, update that too.
