# Checkout Phase 1 — Development deployment attempt

Date: 2026-10-17, Asia/Bangkok. **NOT APPLIED. Stopped after a guarded deploy failure.**

## Verified identity and scope

- Project: hidden-forest-64993760
- Branch: br-proud-field-b3xjljxh
- Endpoint: ep-lucky-fire-b3froe7u
- Database/schema: neondb/public
- Client TLS authorized with sslmode=verify-full; configured Development endpoint differs from the configured production endpoint. Production credentials/endpoint were never used for a connection or printed.
- All snapshot/diagnostic connections were READ ONLY, including default_transaction_read_only=on.

Five prior migrations were completed and their checksums matched local history. The only pending migration before deployment was `20261017000000_checkout_v1_foundation`. Live schema-to-Prisma diff matched the reviewed DDL. The original reviewed SQL was copied byte-for-byte into an isolated migration directory, with no additional pending migrations available to the deployment process.

Reviewed and attempted checksum: `00a2f7546d76215c687163e5e80f2cae0cb75a5305fe970d23aa4915062d0f5e`. The migration SQL was not edited.

## Result and failure diagnosis

Prisma migrate deploy was attempted once, at **00:50:43.083 on 2026-10-17 (+07:00)** (`started_at=2026-10-16T17:50:43.083Z`). The CLI returned a failure. The database migration record has `finished_at=null`, `rolled_back_at=null`, `applied_steps_count=0`, and no recorded error log. There is no completion timestamp to report.

READ ONLY diagnostics found `pg_stat_ssl.ssl=false`, while the client connection's TLS certificate verification was authorized. The SQL's reviewed guard requires pg_stat_ssl.ssl=true. Running only that unchanged DO guard block in an explicitly READ ONLY transaction reproduced:

```text
P0001: Checkout migration requires verified approved Neon Development with TLS
```

No DDL was executed by that diagnostic. No guard was weakened or bypassed. The initial runner preflight checked client TLS but missed independently checking the SQL's pg_stat_ssl predicate. This omission has now been fixed: future runner preflight explicitly requires the server predicate to pass before any deploy invocation. It also refuses unfinished migration history, so it will stop on the current record.

## Before/after verification

Last full comparison: **00:52:34.462 on 2026-10-17 (+07:00)**. Only aggregate counts/digests and schema metadata were exported locally, not customer information or credentials.

| Metric | Before | After |
| --- | ---: | ---: |
| Order | 7 | 7 |
| OrderItem | 7 | 7 |
| Inventory | 3 | 3 |
| Product | 2 | 2 |
| ProductVariant | 4 | 4 |
| Payment | 7 | 7 |
| Shipment | 7 | 7 |
| Cart | 1 | 1 |
| CartItem | 1 | 1 |
| Inventory total quantity | 7 | 7 |
| Inventory total reserved | 0 | 0 |

Aggregate row digests for all nine business tables match. Order/OrderItem snapshot fields, CheckoutAttempt and InventoryReservation were not created; email remains NOT NULL. Columns, constraints, indexes and foundation-enum absence match the baseline. No Order, Payment or Reservation was created. The database change from this attempt is the unfinished Prisma migration bookkeeping row; business data and schema did not change.

Ignored local evidence directory:

`.kono-backups/checkout-phase1-deploy-5162b561-80f5-4b05-b873-e9c7c0e987a8/`

Contains the immutable staged migration set/manifest, READ ONLY before snapshot, live schema diff, final failure comparison and READ ONLY guard diagnosis. It is metadata evidence, not a full data backup.

## Files prepared in this task

- `prisma.checkout-deploy.config.ts`: runner-only Development datasource configuration, no dotenv/default-config fallback.
- `scripts/checkout-phase1-deploy-guard.ts`: target separation, pinned checksum, staged-set verification and SQL TLS-predicate gate.
- `scripts/deploy-checkout-phase1-development.ts`: READ ONLY snapshots, history/checksum/drift validation, isolated migrate deploy and post-deploy verification.
- `scripts/checkout-phase1-deploy-guard.test.ts`: four offline safety tests.
- This report; a status link was added to the Phase 1 document.

No existing approved migration SQL, .env, schema, product data, Checkout UI, Order/Payment/SePay implementation or inventory behavior was changed in this task.

## Checks

- Prisma validate/generate with the offline config: PASS.
- TypeScript --noEmit: PASS.
- ESLint on all new TypeScript deployment files: PASS.
- 44 offline tests: PASS, including 11 foundation tests, four new deployment guard tests and existing Cart/Inventory/SePay regressions.
- No integration test wrote Order/Inventory data.

## Stop boundary

Do not retry deploy, use migrate dev/db push/reset, mark this migration successful or manually edit _prisma_migrations. No recovery command was run.

Continuing requires a separately reviewed decision about the SQL TLS guard, preserving verified client TLS and the exact Development identity, plus approval for guarded recovery of the unfinished migration record. A revised SQL artifact would have a new checksum and must be reviewed before application. No such SQL change or migration resolve is authorized by this report. Production has not been accessed. No commit/push or Phase 2 work was performed.
