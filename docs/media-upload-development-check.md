# KONO manual Cloudinary test — development runtime ready

## Verified runtime

The local server was started using:

```powershell
node scripts/start-media-development.mjs
```

URL: http://127.0.0.1:3001

The child process alone receives the development DATABASE_URL with verify-full;
the original production URL in .env is not overwritten. channel_binding=require
is retained. The test process uses `.next-media-dev` so it does not reuse another
Next.js process's cache. Next.js added matching generated-type includes to
tsconfig.json; its runtime/database business configuration was not changed.

An opt-in instrumentation startup gate reads the actual target through the app's
Prisma client in a READ ONLY transaction before routes run. It checks:

- Project `hidden-forest-64993760`
- Branch `br-quiet-block-b38k6k1x`
- Endpoint `ep-fragrant-pine-b3qx5bzw`
- Database/schema `neondb` / `public`
- READ ONLY transaction flag and verify-full URL policy

The same actual runtime identity was independently rechecked through
`GET /api/media-dev/runtime`. The endpoint is available only in the opt-in local
development process at Host `127.0.0.1:3001`, returns no credentials, and does not
exist as an enabled diagnostic in a normal production process.

## Readiness checks passed

- `/login`: 200, email/password fields rendered.
- Unauthenticated product edit page: redirect to /login.
- Unauthenticated ADMIN product API: 401.
- Unauthenticated upload signature API: 401, with no signature issued.
- Runtime product: KONO Black Cargo Pants V2, DRAFT, 1 existing image.
- All three Cloudinary variables present in the running Next.js environment.
- Existing image ID/URL/Alt Text match the encrypted pre-media baseline.
- TypeScript and ESLint on runtime/test changes: passed.
- 41 relevant offline tests: passed, including runtime identity/production
  rejection, strict SSL, loopback-origin handling, upload verification and auth.

Positive ADMIN login and live upload remain dependent on the user's browser
actions. The assistant has no browser session/cookie and will not request the
password, forge a session, upload a file or create a synthetic image.

## User actions

1. Open http://127.0.0.1:3001/login and sign in with an existing ACTIVE ADMIN.
2. In the same browser/profile open http://127.0.0.1:3001/api/media-dev/runtime.
   Confirm success=true, adminAuthenticated=true and the exact dev branch above.
   If the identity differs, stop; do not upload. No cookie/password should be sent
   in chat. Only report the status/branch if needed.
3. Open http://127.0.0.1:3001/admin/products/cmuedw86k0000q0ufukh57s7m/edit#media-manager.
4. Choose the actual Image Type (FRONT_VIEW for a front photo, otherwise its
   appropriate type). Select exactly one real JPG/PNG/WebP, at most 10,485,760 bytes.
5. Wait for upload and server verification/save. Enter an accurate Alt Text such
   as "KONO Black Cargo Pants V2 — front view" only if the photo is a front view,
   then click Save image details. Report the Image Type and exact Alt Text saved.
6. Set Primary, move the new image up/down and open preview/zoom to check those
   actions. Do not remove an old image or change product status from DRAFT.
   If an upload succeeded remotely but attachment failed, use Retry verification
   and save instead of selecting the file again.

## Assistant follow-up after upload

```powershell
node scripts/verify-media-development-upload.mjs
```

This performs only read operations: checks Next runtime, checks the dev database
identity, reads the product/images and, for one newly saved image only, calls the
Cloudinary authenticated resource GET endpoint. It compares resource/asset IDs,
type, format, byte limit, dimensions and original delivery URL with saved metadata;
reports type/Alt Text/Primary/order; checks exactly one Primary and unique ordering;
and verifies the old ID/URL/Alt Text remain. Product must still be DRAFT. It refuses
more than one new image instead of writing corrective data or deleting anything.

It uses the existing locally encrypted snapshot, decrypted only in memory with
Windows DPAPI. It never prints credentials, cookies or image URLs, and never
connects to production. Decryption requires the same Windows account context.
Cloudinary read-only verification is not attempted before a new image exists.

## Startup issues and current status

The first startup was blocked by the runtime gate before verification completed.
Its raw database error was intentionally suppressed; the exact cause was not
established. A subsequent startup verified the correct dev identity successfully.
The initial local diagnostic returned 404 because Next's internal request URL did
not preserve the loopback origin as expected. The check now uses the exact Host
header. The media CSRF check also handles only that opt-in loopback alias while
continuing to reject cross-site/foreign origins; normal production logic is intact.

Next.js reports an unrelated warning that a package-lock.json outside the Git
repository was ignored. No dependency/config change was made to address that.

At the last check: waiting_for_manual_upload, no new ProductImage, DRAFT unchanged,
one old image retained. Server remains available for the user's manual steps.
No Cloudinary upload/delete, business-table write, commit or push was performed
by the assistant. Positive login, actual upload and visual preview results are
not yet claimed as completed.
