# Backend Product DELETE protection

Permanent deletion is temporarily disabled for both `/api/products/[id]` and `/api/admin/products/[id]`. The ADMIN route re-exports the same DELETE handler, so both apply the same policy.

- `getAdminSession()` runs first. No valid ADMIN session returns the existing 401 Unauthorized envelope.
- Valid ADMIN returns 409 Conflict with `success: false` and an explanation that permanent deletion is unsupported. Archiving is an explicit, separate PATCH operation.
- DELETE does not read the request body or route ID, inspect a Product, invoke a business service/repository, mutate status, or delete database data. Existing and missing IDs receive the same policy response.
- Session verification failure returns a generic 500 and never proceeds to business operations or exposes error details.

## Relation and endpoint audit

Product deletion cascades to category/collection links, images, variants, wishlist items, carts, reviews and coupon-product links. Variant deletion cascades to Inventory and CartItem. OrderItem references Product and Variant with Restrict. Payment belongs to Order; PaymentEvent belongs to Payment. These existing schema relations were inspected without modification.

All API route exports, repository/service delete calls and raw deletion statements under `src` were searched. The only Product deletion entry points found are the legacy route and its ADMIN alias. No additional endpoint was found that deletes Product indirectly: deleting its attributes, variants, images or inventory does not cascade upward into Product. These APIs are unchanged. Variant deletion still has its existing downward cascades; this phase does not redesign it.

The unused `productService.deleteProduct` and repository method remain unchanged for compatibility, but no current HTTP Product DELETE handler invokes them. Future endpoints must preserve this policy until safe permanent deletion is explicitly implemented.

GET/PATCH handlers, Create Product, Variant/Image/Inventory, public catalog and Order/Payment/SePay implementation files were not changed. DELETE never silently archives. Existing UI Delete remains disabled.

## Files changed

- `src/app/api/products/[id]/route.ts`: replace DELETE business operation with ADMIN-first policy response; GET/PATCH unchanged.
- `src/features/products/admin/product-delete.test.ts`: new tests for both routes, 401/409, fail-closed session errors, zero business/database calls, no body/params reads, unchanged GET/PATCH and status preservation.
- `src/lib/auth/api-authorization.test.ts`: expect blocked Product DELETE for ADMIN while continuing to verify all other handlers and unauthorized roles/sessions.
- `docs/product-delete-protection.md`: this report.
- `docs/admin-delete.md`: link to the superseding backend protection report.

## Validation

- TypeScript passed (`tsc --noEmit --incremental false`).
- ESLint on changed TypeScript files passed. Project-wide lint still has the pre-existing `OrdersList.tsx:184` effect error and three unused-import warnings (login, layout, dashboard); those files were left unchanged.
- 79 related mock tests passed, including the eight new route regression tests and existing create/edit/activation/attribute/catalog/inventory/authorization coverage. The authorization suite verifies other existing route handlers, including variant/image/inventory/order/payment handlers, still reach their services.
- `git diff --check` passed. Tests use in-memory session/service/database mocks; no real database writes or deletions were performed. No schema, migrations, environment, SePay/Payment/Order edits, commits or pushes.
