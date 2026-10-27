# Changelog — Stack Web

All notable changes to the Stack web application are documented in this file.

## 2026-10-26 — Accounts, shared themes, inventories and watchlist

### Added
- **End-to-end encrypted accounts** (`js/cuenta.js`), backed by the new `stack-cuentas` Cloudflare Worker. All encryption
  happens in the browser; the server receives only a hash of the username, a derived sign-in key and encrypted blobs.
  The full specification is in `stack-cuentas/PROTOCOL.md`.
  - Create account with username and password (no email). A recovery code is shown once, with copy and download
    options, and must be confirmed as saved before continuing. The user must acknowledge that data cannot be recovered
    without the password or the recovery code.
  - Sign in, optionally remembered on the device; sign out.
  - Recover the account with the recovery code (sets a new password, keeps all data, closes other sessions).
  - Change the password with an open session, generate a new recovery code, delete the account.
- **Stack themes on the web** (`css/temas.css`, `js/temas.js`): the 16 themes of the desktop application (GRN, VLT, GRY,
  RED, RNB, NVD, HLW, SNV, ALG, SOL, DREAM, PLASMA, GRID, CONTOUR, GALAXY and PER), copied from S-0.6.7-BETA, including
  animated colors (RNB, SOL, DREAM, GALAXY), full-screen animated backgrounds (GALAXY, PLASMA, CONTOUR, GRID) and the
  custom theme colors. The theme is read from the account profile written by the application. **Themes cannot be
  selected on the web**; signed-out visitors see the default green theme. The application's animation setting and the
  system's reduced-motion preference are respected.
- **Inventories** (`#/inv`, `#/inv/<id>`): every inventory in the account, with total value today (TCG reference in MXN),
  acquisition cost and card count; each inventory lists its cards sorted by value, with a text filter and links to the
  card page. Cards without a price today (below USD 2) are counted separately.
- **Watchlist** (`#/watch`): tracked printings with today's price and the state of each price alert.
- Account button in the header; shortcuts to Inventories and Watchlist on the landing page when signed in.

### Changed
- Web colors are now mapped from the Stack theme variables (`--bg`, `--txt`, `--acc`…) instead of fixed values.
- Service worker `stack-pagina-v8` caches the new scripts and styles.

### Configuration
- `js/config.js` → `CUENTAS_PUBLICO` points to the deployed Worker (`stack-cuentas.lopezmendeze77.workers.dev`). If it
  is left empty, the account button is hidden.

## 2026-10-26 — Text-verified scanner and card details

### Added
- **Card details on the printing page**, placed after the pricing section: mana cost (official symbols), type line,
  rules text, flavor text, power/toughness or loyalty, artist, release date, set, language; legality in Standard,
  Pioneer, Modern, Legacy, Vintage, Pauper, Commander and Premodern; and official rulings (first three shown, the
  rest expandable). Double-faced cards show both faces. Data is requested on demand from the public Scryfall API
  (`js/scryfall.js`) and kept in memory for the session.
- **Text recognition in the scanner** using PP-OCRv5 Latin (PaddleOCR, `modelo/ocr-latin-1.onnx`, 7.9 MB), executed
  with the same ONNX Runtime Web engine as the visual model. Reads English and Spanish names, light or dark lettering,
  in approximately 25 ms per line on desktop hardware.

### Changed
- **The scanner no longer reports a result from the visual match alone.** The decision now follows this order:
  1. **Name:** the name bar is read and matched against every card name (English, Spanish aliases and front faces of
     double-faced cards) with an error-tolerant comparison. A card is fixed on one read with similarity of at least
     0.86 and a clear lead, or on two agreeing reads of at least 0.72. When two names tie (for example
     *Lightning Bolt* and *Emeritus of Conflict // Lightning Bolt*), the visual match decides.
  2. **Printing:** the visual match selects the printing among those sharing the recognized name. For cards from
     2020 onward, the collector line (set code and collector number) is read and used to confirm the exact printing;
     an unreadable or ambiguous collector line never changes the selection.
  3. **Rules text fallback:** when the name cannot be read after three attempts, the rules text box is segmented into
     lines, read, and compared with the official rules text of the visual candidates. Two different cards with similar
     text are treated as a non-result.
  4. **Visual-only last resort:** only after 2.5 s without readable text and with a very high visual margin.
- **No answer cycling:** once a card is fixed it does not change on its own. It is released when the card leaves the
  guide or when the image no longer matches the fixed card for two consecutive frames (same card: similarity
  0.89–1.00; different card: 0.26–0.51 in testing). The previous result remains visible, dimmed, until the next one.
- Edge detection: when the detected proportions do not match a card (63 × 88 mm), the bottom edge is rebuilt from
  the top edge and side directions, which prevents black-bordered cards on dark surfaces from being cropped.
- After 3 s without a readable name, the scanner suggests moving closer, avoiding glare, or searching manually.
- Service worker `stack-pagina-v7`: the text recognition model is cached permanently; only superseded visual models
  are removed.

### Measured performance (emulated phone camera, nine varied cards)
- Names identified correctly: 8 of 8 readable cards (modern, 1994 frame, showcase, Spanish, double-faced and others);
  0 incorrect results. The Japanese printing was not fixed, as intended, because it could not be verified.
- Time from card entering the guide to result: 0.2–0.9 s.
- Exact printing: 5 of 8; the remaining 3 were reprints with identical artwork, offered under "Other printing?".
- First-time download for the scanner: approximately 20 MB (engine, visual model, text model and daily index).

### Known limitations
- Japanese and other non-Latin printings cannot be confirmed by text and are resolved only by the strict visual
  last resort.
- The camera cannot distinguish foil from nonfoil; the finish is selected in the result panel.

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
