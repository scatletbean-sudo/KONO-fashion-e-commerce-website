# KONO Edit Product — phase 2.5

## Route and shared form

Product names in the desktop table and mobile cards link to `/admin/products/[id]/edit`. The route uses the existing Admin layout/session guard. `EditProduct` loads `/api/admin/products/[id]`, then renders `ProductForm`. `CreateProduct` is a small wrapper around the same form.

The form loads name, slug, description, base price, category/collection IDs and names, gallery URLs/order/primary flags, variant IDs/SKUs/color/size/override price, Product status, variant enabled state and inventory quantities.

Editable through the existing ADMIN Product PATCH:

- Name, slug, description and selling price.
- Category and Collection selections.
- Existing variant SKU, color, size and numeric price override; newly added variants have no invented inventory.
- Product DRAFT/ACTIVE/ARCHIVED status. Publication conditions below apply to transitions from DRAFT/ARCHIVED to ACTIVE.

Only changed fields/variants are submitted. Existing variant IDs and enabled state are preserved. Cost price, barcode, inventory and unrelated product metadata are omitted. Inactive attributes currently linked to the product remain visible/selectable; newly selected Category/Collection IDs must exist and be ACTIVE. Color/Size still have no Active/Inactive model field.

Existing variants cannot be removed in this form. An unsaved newly added row can be removed. Images are read-only and sorted by their actual stored order; Product PATCH is never sent an images array from Edit. This avoids the existing service's delete-and-recreate gallery behavior.

## Backend publication policy

Explicit DRAFT/ARCHIVED → ACTIVE requests require:

- At least one selected ACTIVE Category. All selected Categories/Collections must be ACTIVE and exist. Collection is optional.
- Referenced Color/Size IDs must exist.
- At least one syntactically valid HTTP/HTTPS image URL without credentials, or a root-relative local image path.
- A valid whole VND base price and at least one enabled variant with a valid effective price (override when present, otherwise base price). The existing nonnegative price contract is retained: 0 through 2,147,483,647.
- At least one enabled variant with a valid effective price and `quantity - reserved > 0`. The inventory numbers must be integers and reserved must not be negative.

The transaction locks the Product row, then its existing variant and image rows and the Inventory rows. The service reloads the current Product after taking the inventory lock, validates the prospective edited values, and updates only after validation succeeds. Referenced attribute rows are also locked during existence/status checks.

Concurrent inventory updates must finish before the locked inventory snapshot is read, or wait until this transaction finishes. No inventory mutation is performed by the gate. Activation requests that also try to write inline inventory are refused; inventory must be adjusted through the dedicated inventory API first. Prisma transaction conflicts/timeouts return a generic retry response without internal diagnostics.

Incomplete DRAFT products remain editable. Existing ACTIVE products are not demoted or subjected to the new transition gate when ordinary details are edited. Creation defaults (DRAFT and KONO brand) and the variant enabled default have been removed from partial-update validation so omitted fields do not change existing values.

## Fields requiring separate work

- Gallery additions, URL/alt edits, primary-image changes and ordering need the individual image APIs (`/api/admin/products/images`, `/api/admin/products/images/[id]`). Their UI is not implemented by this Product editor.
- Variant enabled state, barcode and cost price use `/api/admin/products/variants/[id]`; inventory adjustments use the inventory APIs. These fields are displayed/preserved or left untouched here.
- Clearing an existing color, size or price override is not supported by the current Product/Variant PATCH nullable-value contracts. The form reports this clearly instead of sending an unsupported null or pretending to clear the value. This needs an API contract extension; changing to another existing attribute/numeric price works.
- Color/Size ACTIVE filtering still requires a separately authorized Prisma model change, as documented in the attribute-management report.

## Verification and limits

- TypeScript and ESLint for the changed source/test files pass.
- 69 related tests pass, including actual ADMIN handlers/services/repositories with explicit database mocks. Tests cover missing/invalid images, missing/disabled variants, unavailable stock, invalid prices, inactive Category references, successful activation from both DRAFT and ARCHIVED, a concurrent reservation applied before the locked read, unauthorized requests and preservation of old data.
- Edge headless desktop 1440×1000 and mobile 390×844 pass loading/error/retry, navigation from the product list, full hydration, retained inactive selections, validation, minimal PATCH, double-submit prevention, Cancel, rejected/successful activation and Create Product regression. No horizontal overflow or browser runtime errors were observed.
- Browser QA bundles actual React components and Admin Shell with the project's Tailwind CSS, substituting Next navigation and all HTTP APIs. It is not a live Next/database authentication test.
- PostgreSQL locking is verified through mock calls and lock/read ordering. No live database concurrency test was run, and no real database data was read or written during this phase.
- Whole-project ESLint still reports the existing OrdersList effect error and three unused-import warnings. No Order/Payment/SePay code was changed.
- No `.env`, Prisma schema, migration, storefront/homepage, commit or push changes were made.

## Files changed in this phase

- src/app/admin/products/[id]/edit/page.tsx (new)
- src/components/admin/products/EditProduct.tsx (new)
- src/components/admin/products/ProductForm.tsx (new; shared implementation extracted from CreateProduct)
- src/components/admin/products/CreateProduct.tsx
- src/components/admin/products/AllProducts.tsx
- src/components/admin/AdminHeader.tsx
- src/features/products/admin/product-edit.ts (new)
- src/features/products/admin/product-edit.test.ts (new)
- src/features/products/admin/product-management.ts
- src/features/products/admin/product-management.test.ts
- src/features/products/attributes/product-update-validation.ts (new)
- src/features/products/repositories/product.repository.ts
- src/features/products/services/product.service.ts
- src/features/products/schemas/product.schema.ts (Zod validation only)
- src/app/api/products/[id]/route.ts (also re-exported by the existing ADMIN route)
- src/lib/admin/api/attribute-errors.ts
- src/features/inventory/inventory-contract.test.ts (mock fixture update)
- docs/edit-product.md (new)

The earlier phases' uncommitted changes were preserved.
