# PDP layout refinement — 2026-10-17

## Scope

Changed only ProductDetail.tsx (fit-aware sticky panel), ProductGallery.tsx (desktop grid selection and navigation), product-detail.module.css (layout and compact styling), and scripts/test-pdp-browser.mjs (mock browser coverage). This report is the only additional file.

No Cart API, Zustand, price, inventory, Cloudinary asset, database, environment, migration or payment changes. No production access or real cart writes. No Adidas assets or CSS were used; proportions follow the requested brief.

## Measured layout

Measurements below are from headless Chrome with mock product data. Ratios exclude the gutter.

| Viewport | Gallery | Panel | Gutter | Arrangement |
| --- | ---: | ---: | ---: | --- |
| 375 | 337.5px | 337.5px | vertical | Single column |
| 390 | 351px | 351px | vertical | Single column |
| 768 | 676.2px | 676.2px | vertical | Single column |
| 1024 | 559.1px | 340px | 28px | 62.2% / 37.8% |
| 1440 | 948.4px | 360px | 30.2px | 72.5% / 27.5% |
| 1920 | 1220px | 420px | 40px | 74.4% / 25.6% |

Content caps at 1680px. Panel width is fixed at 340px for medium desktop and clamps between 360px and 420px at 1280px and above. At 900px and below, gallery and panel stack. The desktop gallery grid starts at 1280px and requires two independent non-MULTI_VIEW photos. Any MULTI_VIEW tile spans both columns without splitting the image; a sole MULTI_VIEW uses a large single contain frame. All photos retain contain rendering and existing zoom/size-chart behavior.

Sticky activates only above 900px when the panel fits within viewport height minus 48px. ResizeObserver recalculates after accordion/content changes; longer panels remain in normal document flow. No nested panel scrolling or fixed height is introduced.

## Screenshot comparison

Same mixed-image fixture, before and after, with Blue/M selected:

- [Desktop before, 1440px](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-NKGAfp/pdp-1440.png)
- [Desktop after, 1440px](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-M8DbGF/pdp-1440.png)
- [Mobile before, 390px](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-NKGAfp/pdp-390.png)
- [Mobile after, 390px](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-M8DbGF/pdp-390.png)
- [After, one MULTI_VIEW](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-M8DbGF/single-multi-1440.png)
- [After, independent photo grid](C:/Users/Admin/AppData/Local/Temp/kono-pdp-ui-M8DbGF/independent-1440.png)

Full screenshot sets for all six widths are in the corresponding temporary artifact folders. The old browser fixture constrained its root to 1600px; the new fixture removes that artificial limit to represent the real full-width storefront at 1920px. The linked 1440px comparison is unaffected by that fixture correction.

## Verification

- TypeScript --noEmit: PASS.
- ESLint for changed TSX/browser script files: PASS.
- Related PDP/security/cart/store tests: 13 PASS.
- Mock browser tests: PASS at 375/390/768/1024/1440/1920px with no horizontal overflow; panel widths/ratios, button containment, quantity row, single stock status, grid, single MULTI_VIEW, sticky position, short-viewport fallback, gallery zoom/size chart, keyboard/swipe, add-to-bag locking, cart updates/removal/retry and reload persistence verified.
- Desktop, mobile and single-MULTI_VIEW screenshots visually inspected.

Real product assets and exceptionally long descriptions can be reviewed manually on Development; fit-aware sticky automatically yields normal page scrolling when necessary. No commit or push performed.
