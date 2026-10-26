# Changelog — Stack Web

All notable changes to the Stack web application are documented in this file.

## 2026-10-26 — Card scanner, settings and new landing page

### Added
- **Card scanner** (`js/escaner.js`, route `#/escaner`). A camera button in the search bar opens a full-screen
  scanner. Recognition runs continuously on the device and requires no shutter button:
  1. The card edges are located inside the on-screen guide with a lightweight edge detector (no OpenCV dependency).
  2. The card is rectified with a perspective transform.
  3. A 128-value visual fingerprint is computed with `stack-vision-1.onnx` (MobileNetV3-Large backbone with 8-bit
     weights and a fixed PCA projection, 5.1 MB), executed with ONNX Runtime Web 1.20.1 (WebAssembly).
  4. The fingerprint is compared against the daily index of every printing priced at USD 2 or more.
  5. A result is shown only when three consecutive frames agree with a sufficient margin; otherwise the scanner keeps
     reading. The phone vibrates on recognition and the next card replaces the previous one automatically.
  - The result panel shows the TCG reference price in MXN, Hareruya, SCG, Card Kingdom and the Card Kingdom buylist
    price, finish selector, and an "Other printing?" selector for printings that share the same artwork.
- **Settings sheet** (gear icon next to the language selector). The USD→MXN rate can follow the daily package or be
  set to a custom value. JPY→USD always follows the daily rate. While a custom rate is active, an amber indicator is
  shown next to the source status chips.
- **Landing page** with a large logo, product name and centered search bar. Daily movers are available behind a
  "Today's movers" toggle.
- Application icons generated from the official Stack logo, web app manifest and install support (PWA).

### Changed
- The service worker (`stack-pagina-v5`) now caches the scanner engine and model permanently, and removes model
  versions no longer referenced by the manifest.

### Measured performance (simulated phone captures)
- Index of 38,114 printings: 90–91% correct identification from three frames; 96–98% correct when the scanner
  reports a result.
- In-browser test with an emulated camera: four of four test cards identified, 0.1–0.4 s after the card entered the
  guide. Scanner ready in about 2 s on first open.
- First-time download for the scanner: approximately 11 MB (engine, model and index); later opens use the cache.

### Known limitations
- Recognition is based on artwork and frame. Reprints with identical artwork are offered through the
  "Other printing?" selector rather than resolved automatically.
- The camera cannot distinguish foil from nonfoil; the finish is selected in the result panel.
- Accuracy has been measured on simulated captures; validation with real phone captures is pending.

## 2026-10-26 — Phase 1 release

### Added
- Static web application hosted on GitHub Pages: card search (English and Spanish names, accent- and
  word-order-insensitive), printing detail with prices in MXN from TCG, Hareruya, Hareruya Japanese, Star City Games
  and Card Kingdom, data freshness indicator per source, daily movers, Spanish and English interface.
