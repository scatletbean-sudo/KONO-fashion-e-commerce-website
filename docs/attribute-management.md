# KONO Attribute Management — phase 2.5

## Implemented behavior

- Manage Attributes reads the existing ADMIN APIs and supports Add New/Edit for Categories, Collections, Colors and Sizes. Each group has its own loading, error, retry, empty and mutation-result state.
- Category/Collection support name, slug, description and Active/Inactive. Deactivation updates the scalar flag and preserves product relations.
- Color supports name, slug and optional HEX. An empty HEX is sent as null to clear the existing nullable column. Size supports name, slug and an integer display order between 0 and 2,147,483,647.
- Create Product accepts selections from existing options only. Category/Collection must be ACTIVE. Empty groups link to Manage Attributes. The product remains DRAFT and no inventory is invented.
- Product creation checks referenced IDs inside the same transaction as insertion. Row share locks prevent referenced categories/collections from being deactivated or deleted before the insertion finishes.
- Names are checked case-insensitively within each group. Repository mutations recheck under a PostgreSQL transaction advisory lock. Existing slug uniqueness checks and database constraints remain in effect.
- Existing DELETE APIs lock and check usage before deletion. They return 409 for product/variant references, and Category also refuses deletion when children exist. There is no Delete button in this UI.
- Existing API aliases retain getAdminSession(); access is checked before request bodies and services are evaluated.

## Model limits

Color and Size have no isActive field. Every existing Color/Size is therefore selectable; the UI does not invent a status or expose an unsupported toggle. True ACTIVE-only filtering for these two models remains unimplemented and requires a separately authorized schema change and migration.

HEX is validated, but is not unique: different named colors can share a HEX under the existing schema. Slugs identify all four attribute types. No schema, migration, environment file, payment/order code or database data was changed during this work.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- ESLint for every changed source/test file passed. Whole-project ESLint retains the existing react-hooks/set-state-in-effect error at src/components/admin/orders/OrdersList.tsx:184 and three existing unused-import warnings.
- 50 tests passed across attribute-management, product-management, catalog-contract, public-catalog, inventory-contract and API authorization. Services, repositories and actual ADMIN handlers were exercised with explicit in-memory mocks; sourceLoader refuses unmocked database access.
- Edge headless at 1440×1000 and 390×844 passed Add/Edit for all groups, duplicate name/slug validation, HEX/order validation, server conflicts, state toggles, partial loading failure/retry, empty-state guidance, forged dropdown-ID rejection and DRAFT submission. No horizontal overflow or browser runtime errors were observed.
- Browser QA bundled the actual React components, route-page components, Admin Shell and Tailwind CSS, substituting Next navigation and all HTTP APIs. It did not exercise a live Next server or a real authenticated database session.
- No real database reads/writes or test data creation were performed. PostgreSQL lock/concurrency behavior is implemented and verified through mock calls, not a live database integration test.

Run the persisted unit tests with:

```powershell
node node_modules/tsx/dist/cli.mjs --test src/features/products/attributes/attribute-management.test.ts src/features/products/admin/product-management.test.ts src/features/products/catalog-contract.test.ts src/features/products/public-catalog.test.ts src/features/inventory/inventory-contract.test.ts src/lib/auth/api-authorization.test.ts
```

## Files changed in this phase

UI and client validation:

- src/components/admin/products/AllProducts.tsx
- src/components/admin/products/ManageAttributes.tsx
- src/components/admin/products/CreateProduct.tsx
- src/features/products/admin/attribute-management.ts (new)
- src/features/products/admin/product-management.ts

Shared backend rules and error responses:

- src/features/products/attributes/attribute-errors.ts (new)
- src/features/products/attributes/reference-validation.ts (new)
- src/features/products/attributes/guarded-delete.ts (new)
- src/features/products/attributes/unique-name-write.ts (new)
- src/lib/admin/api/attribute-errors.ts (new)

Repositories, services and supported schema contracts:

- src/features/products/categories/repositories/category.repository.ts
- src/features/products/categories/services/category.service.ts
- src/features/products/collections/repositories/collection.repository.ts
- src/features/products/collections/services/collection.service.ts
- src/features/products/colors/repositories/color.repository.ts
- src/features/products/colors/services/color.service.ts
- src/features/products/colors/schemas/color.schema.ts
- src/features/products/sizes/repositories/size.repository.ts
- src/features/products/sizes/services/size.service.ts
- src/features/products/sizes/schemas/size.schema.ts
- src/features/products/repositories/product.repository.ts
- src/features/products/services/product.service.ts

API error mapping, including handlers re-exported by ADMIN routes:

- src/app/api/categories/route.ts
- src/app/api/categories/[id]/route.ts
- src/app/api/collections/route.ts
- src/app/api/collections/[id]/route.ts
- src/app/api/colors/route.ts
- src/app/api/colors/[id]/route.ts
- src/app/api/sizes/route.ts
- src/app/api/sizes/[id]/route.ts
- src/app/api/products/route.ts

Tests and report:

- src/features/products/attributes/attribute-management.test.ts (new)
- src/features/products/admin/product-management.test.ts
- src/features/products/catalog-contract.test.ts
- docs/attribute-management.md (new)

The existing uncommitted pages/sidebar changes from earlier phases were preserved. No commit/push was performed.
