# Cloudinary Media Manager

Implemented locally; the additive database migration was applied on 2026-10-13
to the explicitly approved Neon project `hidden-forest-64993760`, branch
`br-dry-pine-b3l81xxy`, database `neondb`, schema `public`.
See `docs/media-migration-result.md` for verified results and encrypted backup.
Other environments must apply the reviewed schema change before using this
generated Prisma client, which reads the new ProductImage columns.

## Configuration

Next.js loads the existing root `.env` (or `.env.local`) with
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Never use `NEXT_PUBLIC_` for the secret, commit environment files, log credentials,
or send the secret in a client response. Existing configuration was not changed.
Restart the Next.js server after configuring the variables.

No new dependency, unsigned preset, or Cloudinary SDK is required. Server code
uses Cloudinary's documented REST API and SHA-256 upload signature algorithm:

- https://cloudinary.com/documentation/authentication_signatures
- https://cloudinary.com/documentation/admin_api#get_details_of_a_single_resource_by_public_id
- https://cloudinary.com/documentation/upload_presets

## Database change

Review `prisma/migrations/20261013000000_product_image_media/migration.sql`.
It adds ProductImageType (FRONT_VIEW, BACK_VIEW, LEFT_VIEW, RIGHT_VIEW, DETAIL,
ON_MODEL, MULTI_VIEW, SIZE_CHART, plus compatibility values PRODUCT and LIFESTYLE),
Cloudinary public/asset IDs, width, height, bytes and format. Existing records
default to PRODUCT, retain their IDs, URLs, Alt Text, ordering and Primary flags,
and have null Cloudinary metadata. No data is deleted or reuploaded.
New UI uploads default to FRONT_VIEW; existing images keep PRODUCT until a human
classifies them. PRODUCT must not automatically map to FRONT_VIEW (it may be a
back, detail, multi-view or chart). LIFESTYLE can map to ON_MODEL only after
confirming a model actually appears; retain LIFESTYLE for setting/editorial images.

Prisma Client was regenerated locally after successful migration.
For other environments, obtain explicit approval for the correct Neon environment
and review all pending migrations before using the existing project workflow
(`npm exec prisma migrate deploy`). This command applies **all** pending
migrations, not just the media migration. The approved execution verified that
only the media migration was pending. No migrate dev/db push/seed was run.

## Admin workflow

1. Save a new product as DRAFT; follow **Upload product images** to its edit page.
2. Media Manager displays existing images without changing them.
3. Choose a category, then select JPG/PNG/WebP files, each at most 10,485,760 bytes
   (the UI calls this 10 MB). The 24-image limit includes all existing images.
4. Browser requests an ADMIN-only signature, then sends the file directly to
   Cloudinary `/image/upload`. All optional upload fields are fixed and signed
   server-side, with a unique per-product public ID and `overwrite=false`.
5. Browser submits the upload authorization to the image API. The server validates
   its HMAC, admin/product/resource binding and one-hour expiry, then fetches
   the original image through Cloudinary's authenticated Admin API. Only verified
   image/upload JPG, PNG and WebP resources within the size limit are stored;
   resource ID, asset ID, dimensions, byte size and canonical HTTPS delivery URL
   come from Cloudinary, never from the browser response.
6. Save Alt Text/category independently, set Primary, reorder with Move up/down,
   or open full-image preview with keyboard-accessible zoom. MULTI_VIEW and
   SIZE_CHART use contain in the storefront. Size charts also have an expandable
   panel and Expand and zoom. Legacy images can be reclassified without reupload.
7. Removing an image requires a confirmation dialog. This removes the product
   association only and retains the original file. The next image becomes Primary
   if needed. The last image of an ACTIVE product cannot be removed until that
   product is saved as DRAFT/ARCHIVED. Legacy originals are never destroyed.

Primary switches, removals, reorder and image counts run inside transactions
holding a Product row lock. Failed transactions roll back primary changes.
An exact gallery permutation is required for reorder, preventing cross-product
image IDs or omission/deletion through the reorder endpoint. Retrying attachment
after a lost response is idempotent. Existing image URLs cannot be replaced
through metadata PATCH; create/update product APIs reject inline gallery writes
and direct callers must use the verified image endpoints instead.

## Limits and external testing

The browser rejects oversized files before upload and the backend rejects
oversized originals before database attachment. Cloudinary excludes `file` from
the signature and its upload presets do not support a per-preset size limit.
Therefore a modified client may still upload an oversized file into Cloudinary
storage; it cannot attach that resource to KONO. Never claim a signed size field
or preset enforces this limit at the Cloudinary boundary.

An interrupted upload, rejected resource, expired ticket, or abandoned attachment
may leave an unattached Cloudinary asset. Automatic remote deletion is deliberately
absent to preserve originals. Review orphan assets in the `kono/products/` namespace
before manually cleaning them up. Account-level Admin API quotas can cause
verification to fail safely; the UI offers Retry verification and save for an
uploaded-but-unattached image. Tickets/signatures are bearer credentials valid
for one hour; they are not logged or stored in localStorage.

No real Cloudinary upload, resource deletion or business-record write was performed.
Only the approved ProductImage schema migration and its migration-history record
were applied to Neon. Separately authorize
a live smoke test using a named DRAFT product: upload <=10 MB JPG/PNG/WebP, verify
metadata, select Primary, reorder, save Alt Text/categories, inspect old images,
preview MULTI_VIEW/SIZE_CHART and confirm removal. This creates an external asset
and writes ProductImage records, so use an agreed test product/environment.

## Offline verification

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
node --import tsx --test --test-concurrency=1 src/features/products/images/media.test.ts src/features/products/images/media-ui.test.tsx src/lib/auth/api-authorization.test.ts src/features/products/admin/product-management.test.ts src/features/products/admin/product-edit.test.ts src/features/products/catalog-contract.test.ts src/features/products/public-catalog.test.ts src/components/storefront/catalog.test.ts
```

Tests use synthetic credentials, fake resources and in-memory transactions,
with network/database calls mocked or forbidden. Full ESLint has an existing
OrdersList set-state-in-effect error and three unused-import warnings outside
this change; Order/Payment/SePay/Inventory implementation was not modified.
