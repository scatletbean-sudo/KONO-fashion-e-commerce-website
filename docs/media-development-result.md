# KONO Media Development verification — 2026-10-13

## Result: migration already present; no deployment performed

The approved development connection was verified directly from PostgreSQL in
READ ONLY mode with authorized TLS, not inferred from its variable name:

| Item | Verified value |
| --- | --- |
| Project | `hidden-forest-64993760` |
| Branch | `br-quiet-block-b38k6k1x` (user-supplied name KONO-MEDIA-DEV) |
| Endpoint | `ep-fragrant-pine-b3qx5bzw` |
| Direct hostname | `ep-fragrant-pine-b3qx5bzw.c-4.ap-southeast-1.aws.neon.tech` |
| Database/schema | `neondb` / `public` |
| SSL mode | `verify-full` |
| channel_binding parameter | `require`, preserved |

`20261013000000_product_image_media` was already completed on this development
branch when first inspected. Its checksum matches the reviewed migration exactly.
All four earlier migrations are also complete and content/checksum-compatible
(including CRLF/LF normalization). No failed migration or pending migration exists.
The branch may have inherited this history when created, but its creation source
was not independently verified; no assumption about cloning is needed for this result.

There was therefore no reason to run migrate deploy. No production connection
was opened and no database schema/data/history was modified in this turn.

## Explicit Prisma CLI configuration

Existing `prisma.config.ts` still reads production `DATABASE_URL` and is unchanged.
Use the new `prisma.media-dev.config.ts` explicitly for development CLI operations:

```powershell
node node_modules/prisma/build/index.js migrate status --config prisma.media-dev.config.ts
node node_modules/prisma/build/index.js generate --config prisma.media-dev.config.ts
```

The development config reads only KONO_MEDIA_DEV_DATABASE_URL, never falls back
to DATABASE_URL, rejects a production/wrong endpoint or database, converts the
approved hostname to direct, enforces verify-full, and retains channel_binding.
It references the existing schema and migration directory. Actual branch identity
was additionally verified in PostgreSQL before the CLI checks.

Verified CLI results: migration status up-to-date and full live-schema diff empty
using `migrate diff --from-config-datasource --to-schema prisma/schema.prisma
--script --config prisma.media-dev.config.ts`. Native Windows TLS required the
full execution context, with no TLS weakening or environment-file modification.

## Existing schema/data

ProductImage has all seven media columns, correct types/nullability/defaults,
both Cloudinary unique indexes, and the original primary/ordering indexes.
ProductImageType contains FRONT_VIEW, BACK_VIEW, LEFT_VIEW, RIGHT_VIEW, DETAIL,
ON_MODEL, MULTI_VIEW, SIZE_CHART, PRODUCT and LIFESTYLE.

There is one existing image. Its id, productId, URL, Alt Text, sortOrder,
isPrimary and createdAt match the locally encrypted pre-media snapshot exactly.
The comparison decrypted the local DPAPI snapshot only; it did not access the
production database. No image or Primary flag was updated.

KONO Black Cargo Pants V2 exists on development:

- ID: `cmuedw86k0000q0ufukh57s7m`
- Slug: `kono-black-cargo-pants`
- Status: DRAFT (unchanged).

## Local verification

- Prisma generate 7.10.0 using the explicit dev config: passed.
- Prisma schema validation using the explicit dev config: passed.
- TypeScript: passed.
- 81 related offline tests: passed (77 existing regression tests plus 4 dev CLI
  configuration tests covering dedicated-variable selection, no production
  fallback, rejection of a disguised production URL, direct verify-full and
  preservation of channel_binding).
- ESLint on the changed config and its tests: passed.
- Full-project ESLint still reports the existing react-hooks/set-state-in-effect
  error at OrdersList.tsx:184 and three unused-import warnings in login, layout
  and dashboard. These files were not changed; the Order code is out of scope.

## Next.js development connection: next step, not executed

Adding KONO_MEDIA_DEV_DATABASE_URL alone does **not** switch Next.js: the current
Prisma runtime still reads DATABASE_URL. No environment file was overwritten.
Use a dedicated local process with DATABASE_URL set only in that child's environment.
Run this from the repository root after reviewing the target above:

```powershell
@'
import fs from "node:fs";
import dotenv from "dotenv";
import { spawn } from "node:child_process";
const settings = dotenv.parse(fs.readFileSync(".env"));
const dev = new URL(process.env.KONO_MEDIA_DEV_DATABASE_URL ?? settings.KONO_MEDIA_DEV_DATABASE_URL);
if (!dev.hostname.endsWith(".neon.tech") || dev.hostname.split(".")[0].replace(/-pooler$/, "") !== "ep-fragrant-pine-b3qx5bzw" || decodeURIComponent(dev.pathname.slice(1)) !== "neondb") {
  throw new Error("Wrong development endpoint/database.");
}
dev.searchParams.set("sslmode", "verify-full");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3001"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: dev.toString() },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
'@ | node --input-type=module
```

This preserves the app's normal production DATABASE_URL and .env bytes. The child
URL retains channel_binding=require and can retain the dev variable's pooled
hostname for runtime pooling; the CLI config uses direct. Next.js loads other
existing environment variables normally; process environment has precedence over
.env/.env.local, so the child override wins. No development server was started here.

Open `http://127.0.0.1:3001` in a separate browser profile, sign in as an ACTIVE
ADMIN on development, and open:

`/admin/products/cmuedw86k0000q0ufukh57s7m/edit#media-manager`

## Proposed live upload test — requires separate authorization

Cloudinary cloud name, API key and API secret are all present in the existing .env.
Only presence was checked; credentials were not printed or sent to a client.

With the verified dev server and a separately approved image of KONO Black Cargo
Pants V2, upload one JPG/PNG/WebP within 10,485,760 bytes. Choose FRONT_VIEW (or
its actual category), verify server-side Cloudinary metadata before attachment,
then check Alt Text, Primary, reorder, preview and image-type display. Keep the
product DRAFT and confirm old images remain unchanged. Test MULTI_VIEW contain and
SIZE_CHART expansion/zoom separately. Any cleanup/removal requires the UI's
confirmation and retains the remote original under the current implementation.

This creates a real Cloudinary asset and ProductImage row, so it has **not** been
performed. Sharing one Cloudinary account across dev/production does not isolate
remote assets; use a dedicated development product environment if stronger
separation is required. No remote settings were changed in this turn.

No Product, Variant, Inventory, Order, Payment or SePay changes, no product status
change, no live upload, no test ProductImage, no migration-history edit and no
commit/push were performed. The original .env hash was unchanged after checks.
