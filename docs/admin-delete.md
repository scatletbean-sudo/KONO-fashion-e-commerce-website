# Admin Delete

Follow-up: the backend Product DELETE endpoints are now disabled after ADMIN authorization. See [Product DELETE protection](./product-delete-protection.md); the endpoint risk described below records the earlier inspection and has been addressed at the HTTP boundary.

## Completed

- Category, Collection, Color and Size Edit forms now expose Delete. Add New forms do not.
- A native modal names the saved object, requires an explicit checkbox confirmation, and supports Cancel/Escape. The first click never sends DELETE. Pending requests disable actions and prevent duplicate submission.
- Successful ADMIN DELETE removes the item from local catalog state, resets any filter referencing that ID, closes Edit and shows a success message. No application reload is required.
- Blocked deletion and API/network failures preserve the record and Edit form. Category/Collection usage errors recommend closing Edit and selecting Set Inactive. Color/Size have no status field, so no inactive action is invented.
- Existing backend ADMIN authorization, transactional row locks and usage checks are reused. Categories also reject deletion when child categories exist. No products or variants are detached.
- Known foreign key/relation violations map to 409; concurrent disappearance maps to 404; transaction conflicts, timeouts and PostgreSQL deadlock/serialization/lock failures map to a safe retry response. Database error details are not included in these responses.

## Product deletion stopped after inspection

The existing service `productService.deleteProduct` only checks existence and then calls `productRepository.delete`, which invokes Prisma `product.delete` directly. It has no dependency/history inspection or transaction locking. Both original and ADMIN DELETE routes are authenticated, but authentication alone does not make this deletion safe.

The current schema cascades Product deletion to ProductVariant and then Inventory, ProductImage, ProductCategory, ProductCollection, WishlistItem, CartItem, Review and CouponProduct. OrderItem references Product/Variant with Restrict; Payment references Order, so orders indirectly prevent deletion, but reviews, inventory and other linked records can still disappear when no order blocks it.

Following the user's explicit stop-on-cascade instruction, permanent Product deletion was **not enabled or implemented**. Edit Product now has a Danger Zone with a disabled Delete Product button and instructions to use the existing ARCHIVED status/save flow. There is no Product DELETE request from this UI. The existing backend Product DELETE endpoints were left unchanged; they still have the inspected risk and should not be treated as safe merely because this button is disabled.

Before enabling permanent Product deletion, audit history dependencies, decide which associated records may be deleted, add backend dependency checks/transaction locks and concurrency tests, and conservatively block deletion of products with history or unverified dependent data. No schema changes are needed for the completed attribute work.

## Files changed in this phase

- `src/components/admin/products/DeleteConfirmation.tsx` (new)
- `src/components/admin/products/ManageAttributes.tsx`
- `src/components/admin/products/AllProducts.tsx`
- `src/components/admin/products/EditProduct.tsx`
- `src/features/products/admin/product-management.ts`
- `src/lib/admin/api/attribute-errors.ts`
- `src/features/products/attributes/attribute-management.test.ts`
- `docs/admin-delete.md` (new)

Earlier uncommitted project changes were preserved.

## Verification

- TypeScript: passed (`tsc --noEmit --incremental false`).
- ESLint on changed TypeScript/TSX files: passed. Project-wide ESLint retains the existing `OrdersList.tsx:184` effect error and three unused-import warnings in login/layout/dashboard files. These unrelated files were not modified.
- 71 related mock tests passed: guarded deletion success/usage/child-category blocking, ADMIN checks, FK errors, missing records, transaction conflicts/timeouts/raw PostgreSQL conflict codes, plus existing product edit/create/activation/catalog/inventory regressions.
- Edge headless checks passed at 1440×1000 and 390×844 using actual React components/Admin Shell with mocked ADMIN APIs: all four groups, initial click, explicit confirmation, Cancel/Escape without requests, blocked deletion, API errors, success without duplicate submission, removal of stale rows/filter options, and disabled Product deletion. Screenshots were inspected; no horizontal overflow or browser errors were observed.
- Browser mock harness/screenshots are local TEMP artifacts in `kono-admin-product-qa`; they exercise components rather than a live Next authentication/database deployment. Concurrent database behavior was not integration-tested against PostgreSQL.
- `git diff --check`: passed. No real database writes/deletions, migrations, schema/env/SePay/Payment/Order changes, commits or pushes were performed.
