# PDP Gallery overlay controls — 2026-10-17

## Changed files

- src/components/storefront/ProductGallery.tsx
- src/components/storefront/product-detail.module.css
- scripts/test-pdp-browser.mjs
- docs/pdp-gallery-controls-check.md (this report)

Inspected ImagePreview.tsx and storefront.module.css. PDP uses its existing local Lightbox, not the Media Manager ImagePreview. Neither inspected file needed modification. The storefront's inherited button font required a more specific gallery selector to keep EXPAND compact.

## Cause and fix

EXPAND was a non-interactive span with pointer-events:none, anchored to galleryHero rather than individual grid tiles and hidden on desktop grids. Previous/Next lived below the gallery.

EXPAND is now a real button anchored 18px from the right and bottom of the carousel frame or each desktop grid tile. It opens the existing lightbox at the selected image. Previous/Next use circular 44px hit targets, thin black chevrons, 75% white backgrounds, 6px backdrop blur and 180ms hover transitions. Reduced motion disables transitions. Carousel arrows sit at the vertical center, inset 18px on desktop and 12px on mobile. Single-photo galleries have no Previous/Next arrows. No navigation row remains below the images.

The existing desktop grid and purchase-panel proportions remain unchanged. Grid overlay arrows navigate to adjacent tiles using the existing wraparound logic; each tile has its own Expand. Carousel navigation wraps, supports ArrowLeft/ArrowRight from the image region or its controls, and handles horizontal touch gestures even when they start over an overlay button. Vertical page scrolling and browser pinch zoom remain available.

Loaded images provide their natural aspect ratio for the frame; the carousel frame follows the selected image, avoiding whitespace created by a taller neighboring slide. MULTI_VIEW stays one complete contain-rendered image. Failed/unloaded images retain the fallback frame. No image transformation, crop or asset change is introduced.

## Validation

- TypeScript --noEmit: PASS.
- ESLint on changed TSX/browser script: PASS.
- Related PDP/security/cart/store automated tests: 13 PASS.
- Mock-only browser tests: PASS at 375/390/768/1024/1440/1920px.
- Checks include overlay hit targets, Expand 18px insets, no Expand/Next overlap, no horizontal overflow, resize and scroll anchoring, single-image navigation suppression, independent-photo grid, complete MULTI_VIEW, wraparound Previous/Next, keyboard, swipe, lightbox zoom/X/Escape/focus restoration, and existing cart regression flows.
- Desktop and mobile screenshots visually inspected.

## Screenshot comparison

- [Desktop before](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-yGwOse/pdp-1440.png)
- [Desktop after](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-3QavUd/pdp-1440.png)
- [Mobile before](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-yGwOse/pdp-390.png)
- [Mobile after](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-3QavUd/pdp-390.png)
- [Single MULTI_VIEW after](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-3QavUd/single-multi-1440.png)

All screenshot widths are available in those temporary directories. Tests used an in-memory mocked API; no real database/cart writes were performed. Cart API, Purchase Panel, product data, environment, migrations and production were untouched. No commit/push.
