# KONO Product Detail V2 — local verification

## Scope

PDP remains `/products/[slug]`, backed by the existing public catalog. Primary image
comes first; the remaining photos preserve manual sortOrder, with preferred view
categories breaking ties. SIZE_CHART is excluded from the carousel and opened in
Size Guide. No images or products are created by this change.

Product information and selectors use public product/variant fields. Missing fit
and shipping/return policies are explicitly marked as pending rather than invented.

The repository previously had Cart/CartItem database models but no implemented
cart API or Zustand store. The user approved extending this task to implement them.
New endpoints are additive; the existing public catalog contract is unchanged:

- GET /api/cart: reads the current guest bag; no cookie means an empty bag without
  creating a database row. Hidden/inactive product variants are omitted.
- GET /api/cart/availability?variantId=...: ACTIVE product/active variant only;
  returns server price, capped purchasable quantity and quantity already in this bag.
- PUT /api/cart: accepts only variantId and absolute quantity (0 removes the line).
  Prices and ownership never come from request data. A repeated absolute quantity
  does not increment twice. Same-origin checks are required for mutations.

Guest ownership uses a random HttpOnly, SameSite=Lax cookie (Secure in production);
only its hash is stored in Cart.sessionId. Each line is limited to net available
stock and a maximum of 99, with a maximum of 50 distinct variants per bag. Cart row,
product, variant and inventory locks protect each write's revalidation. Cart does
not reserve stock or create orders. Checkout, payments and SePay are unchanged.
Zustand holds server snapshots; bag contents reload from the server when opened.
Account/cart merging and cross-device carts are not implemented.

## Verification completed

- Phase 1: TypeScript, scoped ESLint, 20 relevant tests passed.
- Phase 2: TypeScript, scoped ESLint, 22 relevant tests passed.
- Phase 3: TypeScript and scoped ESLint passed; all 145 src tests passed, covering
  inventory, admin authorization, public catalog, Media Manager, SePay and cart.
- Chrome integration harness uses the real PDP/header/footer components, CSS and
  Zustand with in-memory API fixtures. It exercises primary/ordering, MULTI_VIEW
  contain, chart separation/Size Guide, broken-image fallback, preview/zoom/Escape,
  keyboard arrows, color/size, sold-out variants, quantity limits, failed add/retry,
  double-submit prevention, bag contents and mobile touch swipes.
- Responsive checks: 375, 390, 768, 1024, 1440 pixels, no horizontal overflow.
- Public route/API tests reject DRAFT and ARCHIVED, including with admin cookies.
- No live database queries/writes, Cloudinary uploads, migrations, environment
  edits, status changes or commit/push were performed for this PDP task.

## View PDP without publishing a DRAFT

From Windows PowerShell in the repository:

```powershell
node scripts/test-pdp-browser.mjs --preview
```

Open the local URL printed by the script. It renders the actual PDP components
with synthetic images and in-memory cart responses; it neither loads .env nor
connects to a database. These fixtures never enter product data or production.
Stop with Ctrl+C. This is a test harness, not a new application route.

Run the automated browser checks (requires installed Google Chrome on Windows):

```powershell
node scripts/test-pdp-browser.mjs
```

The script prints its temporary screenshot directory after passing.

## Remaining manual verification

Use actual ACTIVE products on a verified Development process to validate real
Cloudinary delivery and guest-cart persistence across page reloads. Do not publish
KONO Black Cargo Pants V2 merely for testing. Verify touch/zoom and screen-reader
announcements on a physical mobile device. Database concurrency and cookie/cart
persistence have mock coverage but have not been exercised against live PostgreSQL.
Cart creation/removal during such a test writes only the explicitly verified
Development database; that live test has not been run by the assistant.

Production rollout, account-cart merging, abandoned-cart cleanup and checkout
integration are separate work. Fit and shipping/return content needs real policy
information before launch.

## Files changed for this PDP task

- src/components/storefront/ProductDetail.tsx
- src/components/storefront/ProductGallery.tsx
- src/components/storefront/PurchasePanel.tsx
- src/components/storefront/CartBag.tsx
- src/components/storefront/product-detail.module.css
- src/components/storefront/product-detail.ts
- src/components/storefront/StorefrontShell.tsx
- src/components/storefront/storefront.module.css (only header cart control styles)
- src/features/cart/cart-contract.ts
- src/features/cart/cart.service.ts
- src/features/cart/cart-http.ts
- src/features/cart/cart-store.ts
- src/app/api/cart/route.ts
- src/app/api/cart/availability/route.ts
- src/components/storefront/product-detail.test.ts
- src/components/storefront/product-detail-security.test.ts
- src/features/cart/cart.test.ts
- src/features/cart/cart-store.test.ts
- src/features/products/images/media-ui.test.tsx (updated assertions for the new PDP)
- src/lib/testing/load-source.ts (explicit globals and TSX support for isolated tests)
- scripts/test-pdp-browser.mjs
- docs/pdp-v2-development-check.md

Existing uncommitted Media Manager/development/reset changes from earlier tasks
were preserved; they are not new changes in this PDP task.
