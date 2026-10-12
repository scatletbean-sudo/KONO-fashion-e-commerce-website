# Catalog API contracts

- Public GET routes: `/api/products`, `/api/products/[id]`, `/api/products/variants`, `/api/products/variants/[id]`, `/api/products/images`, `/api/products/images/[id]`, `/api/categories`, `/api/categories/[id]`, `/api/collections`, `/api/collections/[id]`, `/api/colors`, `/api/colors/[id]`, `/api/sizes`, `/api/sizes/[id]`.
- These GET responses always use public field allowlists, including when the browser has an ADMIN session. Products must be ACTIVE; variants and catalog groups must be active. Warehouse values and cost prices are excluded; variants expose `inStock`.
- Matching `/api/admin/...` routes require an active ADMIN session and return full management data using `{ success: true, data }`. POST/PATCH/DELETE on these routes reuse existing protected handlers. The old write URLs remain ADMIN-only compatibility aliases.
- Inventory is private on both `/api/inventory...` and `/api/admin/inventory...`.
- Category/collection product entries include ordered images, base prices and variant prices, colors, sizes, and public stock availability. Existing nested `{ products: [{ product }] }` shapes remain intact.
- Variant PATCH supports SKU, colorId, sizeId, priceOverride, costPrice, barcode and isActive. Unsupported keys (including productId and inventory) return 400. Use the inventory API for stock updates.
- All inventory write services validate integer, nonnegative quantities with `reserved <= quantity`, including merged partial updates. This validation is not a stock reservation or concurrency control mechanism.
- Admin frontend call sites were checked before adding routes: current UI calls auth, dashboard and order APIs only, so no UI URL changes were needed.
