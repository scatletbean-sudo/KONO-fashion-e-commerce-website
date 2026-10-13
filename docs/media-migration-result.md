# KONO Media Manager migration result — 2026-10-13

**Success. Stopped before live Cloudinary/upload testing.**

## Approved and verified target

- Project: `hidden-forest-64993760`
- Branch: `br-dry-pine-b3l81xxy`
- Database/schema: `neondb` / `public`
- Endpoint: `ep-icy-butterfly-b3dbylfa`
- Direct host: `ep-icy-butterfly-b3dbylfa.c-4.ap-southeast-1.aws.neon.tech`
- SSL: `verify-full`, with authorized TLS verified before execution.

The deploy process received the direct URL only through its in-memory environment.
The application continues using its original pooled DATABASE_URL; a before/after
hash confirmed `.env` was unchanged. Credentials and connection strings are not
included in this report or logs.

## Pre-execution gates and recovery

Read-only checks verified the target using Neon settings from the database,
exactly one pending migration, no failed/incomplete migration, matching historical
migration contents (including the previously identified CRLF/LF-only difference),
and a full live-schema diff equal to the reviewed media change. The exact SHA-256
of the approved migration was checked before execution:

`e5bc796f705d7b09c02bda70bc23d39cb71669b47739a8e98a1e3fc95d70a356`

An encrypted snapshot of all old ProductImage rows, existing column/index/constraint
definitions and migration history was saved before applying DDL:

`.kono-backups/media-1791891277529/product-image-baseline.dpapi`

The backup was read back, decrypted with Windows DPAPI CurrentUser and compared
byte-for-byte to the original snapshot. It is ignored by Git. Decryption requires
the same Windows account/machine or its DPAPI recovery keys; preserve that account
and copy the encrypted backup to durable storage if desired. Recovery notes sit
beside it. Pre-execution read-only observation: `2026-10-13T11:34:35.443Z`,
LSN `0/5828460` (LSN alone does not prove a retained Neon restore point).

This is a **ProductImage-scoped recovery snapshot**, not a full-database pg_dump
or proof of active Neon PITR. No Neon Management API key or local pg_dump utility
was available, so the project's history window was not independently verified.
The DDL also uses BEGIN/COMMIT, giving transaction rollback on execution failure.
No restore or recovery DDL was executed.

## Execution

The authorized guarded helper was invoked with:

```powershell
node scripts/run-media-migration.mjs --apply
```

After the pre-execution gates, it ran the installed Prisma 7.10.0 command:

```powershell
node node_modules/prisma/build/index.js migrate deploy
```

Only `20261013000000_product_image_media` was pending and applied. No other
migration ran. No migration reset, resolve, db push, seed or dependency upgrade
was performed. The helper deliberately stops on any additional pending migration,
target mismatch, historical content change or unexpected schema diff.

## Post-execution verification

- The migration history contains one successfully completed media migration,
  with the exact reviewed checksum and no rollback marker.
- No pending local migrations remain.
- The enum contains all eight requested types plus PRODUCT/LIFESTYLE compatibility.
- ProductImage has all seven added columns with the correct types/nullability.
- imageType is NOT NULL with default PRODUCT.
- `ProductImage_cloudinaryPublicId_key` and `ProductImage_cloudinaryAssetId_key`
  are unique indexes. The existing primary key, ordering indexes and product FK remain.
- The live database's full Prisma schema diff is empty after deployment.
- Exactly **1 old image** remains. Its id, productId, URL, Alt Text, sortOrder,
  isPrimary and createdAt matched the encrypted baseline exactly.
- That row has PRODUCT and null Cloudinary/dimension/byte/format metadata.
- Its pre-existing Primary flag remains false; no automatic data repair occurred.

No Product, Variant, Inventory, Order or Payment record was created or modified.
The schema migration adds metadata only to ProductImage and Prisma records its
own migration history.

## Local verification and stopping point

- Prisma generate 7.10.0: passed.
- TypeScript: passed.
- 77 related offline tests: passed.
- ESLint for the migration helper: passed.
- Runtime application configuration file: unchanged.

No Cloudinary upload, deletion or live upload smoke test was performed. No
commit/push was made. Live upload testing requires a separately approved DRAFT
test product and explicit authorization for external asset/product-image writes.
