# KONO Media migration preflight — 2026-10-13

No migration, Neon data write, Cloudinary upload/deletion, environment edit,
dependency upgrade, commit or push was performed.

## Confirmed target

The root `.env` supplies DATABASE_URL to Prisma. Next.js development and
production resolve the exact same connection. Credentials are omitted here.

| Item | Verified identifier |
| --- | --- |
| Project | `hidden-forest-64993760` |
| Branch | `br-dry-pine-b3l81xxy` |
| Compute endpoint | `ep-icy-butterfly-b3dbylfa` |
| Host | `ep-icy-butterfly-b3dbylfa-pooler.c-4.ap-southeast-1.aws.neon.tech` |
| Database / schema | `neondb` / `public` |
| Configured SSL mode | `require` |
| Audit SSL mode | `verify-full`; certificate authorized |

Project, branch and endpoint IDs were returned by the database's Neon settings
inside a `BEGIN READ ONLY` transaction, with `transaction_read_only=on`.
Human-readable project and branch names were not available; the IDs above identify
the exact targets without guessing names. The pooled endpoint maps to that branch.
The `.env` URL remains unchanged; the stricter audit URL existed only in memory.

`scripts/audit-media-migration.mjs` repeats the read-only check, including local
and database migration checksums, and suppresses raw errors and credentials.
No image URLs or row-level product/customer data are printed.

## Compatibility and existing data

Live ProductImage has exactly the old seven columns: id, productId, url, alt,
sortOrder, isPrimary, createdAt. Existing primary key, foreign key and ordering
indexes match the baseline migration. No ProductImageType or proposed new
columns/indexes exist yet.

`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
--script` was run **read-only** with strict TLS. Its complete output is
`docs/media-schema-diff.sql`. The only differences are the media enum, seven
ProductImage columns and two unique indexes; no unrelated schema drift was found.
The pending migration expresses that same change and now has BEGIN/COMMIT for
atomic application. It does not UPDATE, DELETE, INSERT, DROP or recreate any
existing table. Existing ID, URL, alt, order, Primary flag and createdAt remain
unchanged. Null Cloudinary IDs on old rows do not conflict with PostgreSQL's
unique indexes. Old rows receive imageType PRODUCT and null metadata.

Read-only counts: **1 image across 1 product**, **0 Primary flags**. No products
exceed 24 images and none have multiple primaries. The missing Primary is
pre-existing and is not repaired by migration; storefront fallback still uses
the first image. After approval, an ADMIN can explicitly set Primary in the UI.

Four previous migrations are completed; none failed or rolled back. The only
pending migration is `20261013000000_product_image_media`.
The on-disk `20260928165433_add_session` checksum differs solely due to CRLF:
normalizing it to LF matches the database checksum exactly. All other historical
checksums match directly. Historical files and migration records were not edited.

## Image Type mapping

The enum, Zod policy, metadata APIs, admin selector and public catalog support
FRONT_VIEW, BACK_VIEW, LEFT_VIEW, RIGHT_VIEW, DETAIL, ON_MODEL, MULTI_VIEW,
SIZE_CHART. PRODUCT and LIFESTYLE remain valid compatibility values.

- PRODUCT -> keep PRODUCT until visual review, then select the actual type.
  Never infer FRONT_VIEW from primary status, order or filename alone.
- LIFESTYLE -> ON_MODEL only when visual review confirms a person wearing the
  product; keep LIFESTYLE otherwise. No bulk mapping is performed.
- New UI uploads default to FRONT_VIEW; their category remains editable.
- Old unspecified public types remain accepted. Legacy URLs are not reuploaded
  or overwritten. MULTI_VIEW and SIZE_CHART continue to use contain, with hover
  scaling disabled. Size charts retain expansion and zoom.

Create/Edit behavior remains: save DRAFT first, then upload through Media Manager.
Product form saves never replace a gallery; inline images in legacy API requests
are rejected so callers must use signed-upload/verified-attachment APIs.

## Over-10-MB uploads: boundary and proposal

KONO currently uses **10,485,760 bytes (10 MiB)** under the UI label "10 MB".
Browser prevalidation and authenticated resource verification enforce the limit
before attachment to Neon. Direct signed uploads exclude file bytes from the
signature; lying about the initial size can still put a larger asset into
Cloudinary storage. An allowed_formats signature does not enforce size.
Cloudinary presets do not offer a per-preset size limit; widget maxFileSize is
also client validation. No undocumented `max_file_size` or eval exception is
treated as a guaranteed server cap.

Recommended choices, requiring separate approval for external configuration or
deletion:

1. Preserve direct upload and ask Cloudinary to configure a hard image-upload
   account/product-environment limit of 10,485,760 bytes, if supported by the plan.
   Prefer a dedicated KONO product environment so other applications are not
   affected. Verify the effective limit in Usage Limits and test the boundary.
2. If an exact provider cap is unavailable, retain current refusal to attach and
   implement scoped cleanup. Add a fixed, server-signed KONO ownership tag/context
   on future uploads; authenticate webhook notifications and fetch metadata
   independently. Queue only originals with bytes >10,485,760, exact
   `kono/products/<product-id>/<uuid>` public ID, expected account, image/upload
   resource type, proof of app-issued upload and immutable asset ID.
3. Before any deletion, re-fetch that same immutable asset ID, re-check bytes and
   ownership, and confirm no ProductImage references the asset/public ID/URL.
   Use a reviewed dry-run manifest and delete by immutable asset ID, never a
   wildcard folder/prefix. Skip any changed, missing, referenced or ambiguous
   asset. Valid <=limit files and all legacy/untagged originals are excluded.
   Prevent simultaneous attachment while a cleanup candidate is processed.
4. An unbypassable cap controlled entirely by KONO requires receiving and counting
   the stream on a server before uploading, which changes the Direct Signed Upload
   architecture. Do not implement that change without approval.

No remote cleanup code/action or Cloudinary setting change was implemented in this
preflight. The existing Media Manager removal action still retains originals.

Sources:
- https://cloudinary.com/documentation/authentication_signatures
- https://cloudinary.com/documentation/upload_presets
- https://cloudinary.com/documentation/upload_widget_reference

## Proposed migration command — NOT EXECUTED

From `C:\Users\scatl\Desktop\kono`, after approval for the target above:

```powershell
node node_modules/prisma/build/index.js migrate deploy
```

This pins execution to the installed Prisma 7.10.0 and the existing
prisma.config.ts; it downloads/upgrades nothing and applies all pending migrations.
At this audit there is exactly one pending migration, the media migration.
Re-run the read-only target/history check immediately before execution in case
DATABASE_URL or pending files changed. Schedule with code rollout because the
generated Prisma client expects the new columns. ALTER TABLE obtains a database
lock; the current table is small, but a busy application can delay that lock.
No reset, migrate dev, db push, seed or migrate resolve is proposed.

The current config uses Neon's pooled endpoint. Neon documents pooled schema
migration support with modern PgBouncer/Prisma, while current Prisma/Neon guides
recommend a direct URL for CLI operations. No datasource config was changed in
this audit. Before application, prefer a reviewed direct CLI connection to this
same project/branch/database, or explicitly approve using the verified pooled
target. Keep runtime pooling intact. The configured sslmode=require also remains
unchanged; use verify-full for the migration process (an in-memory override or a
user-managed configuration update), as used successfully by the read-only diff.

Sources:
- https://neon.com/blog/better-postgres-with-prisma-experience
- https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md

## Verification results

- TypeScript: passed.
- Prisma 7.10.0 schema validation and local client generation: passed.
- 77 related offline tests: passed, covering taxonomy parity, additive/atomic
  SQL, legacy catalog compatibility, upload security, concurrent attachment,
  Primary rollback, Create/Edit, permissions and SSR media/size-chart rendering.
- ESLint on all files changed in this preflight: passed.
- Real Neon metadata inspection and full Prisma schema diff: read-only and passed.
- A real migration and browser/Cloudinary smoke test remain unexecuted.

Prisma's native Windows TLS failed inside the restricted execution context with
P1011 (Windows security package credentials unavailable). Read-only diff succeeded
outside that restriction while retaining verify-full. This did not weaken TLS or
require an environment-file change.
