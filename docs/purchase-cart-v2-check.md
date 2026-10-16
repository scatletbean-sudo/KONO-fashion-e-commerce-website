# Purchase Panel & Cart Drawer V2

Implemented in the existing storefront. No environment, database, schema, migration, checkout, order or payment changes. No real cart mutations were used during testing.

## Files changed in this task

- src/components/storefront/PurchasePanel.tsx
- src/components/storefront/CartBag.tsx
- src/components/storefront/product-detail.module.css
- src/features/cart/cart-contract.ts
- src/features/cart/cart.service.ts
- src/features/cart/cart-store.ts
- src/features/cart/cart.test.ts
- scripts/test-pdp-browser.mjs
- docs/purchase-cart-v2-check.md

Other pre-existing working-tree changes were preserved.

## Behavior

Purchase quantity controls stay beside their label, retain a minimum of one, and respect the remaining purchase limit. Stock copy never renders exact quantities. The full-width black purchase button retains loading and mutation locking. Compact feedback reserves space and offers View Bag. Existing accordion content and policies are preserved; no product or policy text was invented.

The drawer uses a native modal dialog with keyboard containment, Escape, focus return and scroll locking. Its content scrolls independently of the subtotal/footer. Lines show primary thumbnails (with a safe URL check and broken-image fallback), color, size, unit price and line total. Quantity controls and a single trash-icon Remove button use the existing absolute-quantity PUT API. Zustand accepts server snapshots; failed mutations retain the previous cart. Opening the drawer and mounting the bag trigger synchronization. Refreshing an existing snapshot announces product/price changes; unavailable lines remain protected by server filtering and out-of-stock quantities prompt correction/removal.

## Additive API changes

- Cart line: optional nullable imageUrl, selected from the primary ProductImage only.
- Availability: optional lowStock boolean computed on the server from real net inventory and a positive Inventory.lowStockAt threshold. Zero disables the low-stock label. No threshold or extra warehouse quantity is exposed.
- No new endpoint, input, cookie, owner, pricing, reservation or inventory-write behavior.
- Existing maxQuantity/currentQuantity fields remain for compatibility and quantity controls. Thus exact purchase limits remain observable in network responses. Removing them would require a coordinated contract change; the UI does not render them as stock counts.

## Validation

- tsc --noEmit: PASS.
- ESLint for all changed TS/TSX and browser script files: PASS.
- Cart, store, PDP security/product detail and public catalog tests: 20 PASS.
- Real-component headless Chrome tests with an in-memory mocked API: PASS. Covers purchase failure/retry, duplicate clicks, drawer quantity changes, failed mutation preservation, remove/empty state, reload persistence, thumbnail fallback, keyboard modal behavior, stock-copy suppression and no horizontal overflow at 375, 390, 768, 1024 and 1440 pixels.
- Screenshots generated for PDP and drawer; mobile examples visually inspected.

## Manual Development checks

Open http://127.0.0.1:3001/products/test-kono-cart-integration-dev2 while the guarded Development server is running. Manually add Black/M, edit quantity, remove, close/reopen the drawer and reload to check the real HttpOnly-cookie session. Black/L must remain unavailable; inactive XL must remain hidden. Test network loss and recovery and check the primary Cloudinary thumbnail. These real-cart writes were deliberately left for the user.

Low Stock needs a product whose positive configured threshold is reached; the TEST fixture threshold of zero does not qualify. Payment/checkout remains unavailable as before. No production access, Neon data writes, commit or push was performed for this task.
