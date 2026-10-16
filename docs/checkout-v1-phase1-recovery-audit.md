# Checkout Phase 1 — Failed migration recovery audit

Audit date: 2026-10-17 (+07:00). **READ ONLY; recovery is BLOCKED pending runner/TLS changes and approval.** No recovery command was executed. This document proposes changes; the active migration and deployment configuration remain unchanged.

## Verified database and evidence

Fresh observation: `2026-10-16T17:57:06.615Z` (00:57:06.615 on 17 October, +07).

| Property | Verified value |
| --- | --- |
| Project | hidden-forest-64993760 |
| Branch | br-proud-field-b3xjljxh |
| Endpoint | ep-lucky-fire-b3froe7u |
| Database/schema | neondb/public |
| Transaction read-only | on |

Evidence: `.kono-backups/checkout-phase1-deploy-5162b561-80f5-4b05-b873-e9c7c0e987a8/recovery-audit-readonly.json`, compared with the saved pre-deploy snapshot. Only metadata, counts and aggregate digests were saved; no customer records or connection strings were exported. This is comparison evidence, not a complete database backup.

## A. TLS diagnosis

**PASS — observed node-postgres connection:** configured Development URL is pooled (`-pooler`), with `sslmode=require`. The preflight/deploy URL builder removes `-pooler` and sets `sslmode=verify-full`, so the attempted migration was configured to use the direct endpoint. Direct does not mean bypassing Neon's network proxy. Neon documents the pooler suffix and recommends direct connections for migrations: https://neon.com/docs/connect/connection-pooling

Fresh `pg` inspection verified the actual driver host matches the approved direct hostname, encrypted socket, TLS 1.3, certificate authorization, and explicit hostname verification. `rejectUnauthorized` was not disabled; no global TLS bypass or custom CA/root override was configured. The peer certificate was within its validity period. Channel binding was requested; negotiation of SCRAM-PLUS was not independently measured.

**WARNING — backend TLS observation:** the same backend reports `pg_stat_ssl.ssl=false`, with null protocol/cipher. PostgreSQL exposes the connection at that backend, not the entire external client path: https://www.postgresql.org/docs/current/monitoring-stats.html

Neon describes its proxy between client and compute, and the proxy's official implementation documents certificate/key configuration for incoming PostgreSQL connections: https://neon.com/docs/reference/glossary and https://github.com/neondatabase/neon/blob/main/proxy/README.md . Observed verified TLS at the client combined with no TLS at the backend is consistent with TLS termination before the PostgreSQL backend. This is an inference supported by those observations and architecture; it does not establish every private-network hop or its controls. Pooling itself is not the explanation: the effective connection is direct. We do not treat `ssl=false` as proof of safety or claim end-to-end client-to-backend TLS.

**Root cause:** the SQL guard demanded backend `pg_stat_ssl.ssl=true` before its first DDL. That predicate failed despite the separately verified `pg` client TLS leg. The unchanged guard was previously reproduced in a read-only transaction with error P0001. The original preflight incorrectly treated client TLS verification as sufficient evidence that this SQL predicate would pass.

**BLOCKER — native Prisma CLI TLS:** the migration CLI uses the installed native schema engine, not the application's PrismaPg adapter. Its TLS semantics must be checked separately from the successful `pg` probe. At installed engine revision `0edf323efd1d98336f3f0a68684b56f689b900d3`, the PostgreSQL parser recognizes sslmode `disable`, `prefer`, `require`; an unsupported value such as `verify-full` falls back to `prefer`. Its default sslaccept is `accept_invalid_certs`. Thus the existing URL does not prove strict certificate validation for the failed native CLI attempt, and this audit cannot retroactively certify that attempt's transport.

Primary implementation evidence: https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/quaint/src/connector/postgres/url.rs and https://github.com/prisma/prisma-engines/blob/0edf323efd1d98336f3f0a68684b56f689b900d3/quaint/src/connector/postgres/native/mod.rs . The latter builds the native TLS connector and enables invalid-certificate acceptance according to sslaccept.

Proposed native CLI parameters are `sslmode=require&sslaccept=strict`; the `pg` probe should retain its separately validated strict configuration. Before approval to write, verify this native-engine path read-only, including a negative certificate/hostname validation check in an isolated fixture, and confirm no transport fallback. No such native-engine proof or recovery configuration was implemented in this audit. BLOCKER remains open.

## B. Failed migration and partial-change audit

**PASS — history:** five previous successful migrations match local checksums. Exactly one unfinished target record exists: `20261017000000_checkout_v1_foundation`, started `2026-10-16T17:50:43.083Z`, finished null, rolled_back null, applied_steps_count 0, logs null.

Target database/local SHA-256: `00a2f7546d76215c687163e5e80f2cae0cb75a5305fe970d23aa4915062d0f5e`.

**PASS — no partial schema:** all compared columns, indexes and constraints equal the pre-deploy snapshot. Both Checkout enums and both new tables (`CheckoutAttempt`, `InventoryReservation`) are absent; all nine proposed Order columns and both proposed OrderItem columns are absent; customerEmail remains NOT NULL. Proposed six indexes, three foreign keys and eight CHECK constraints have not appeared. This conclusion uses catalog comparisons, not only the zero applied-step count. The migration begins with BEGIN and its failing guard precedes all DDL.

| Business metric | Before | Fresh audit |
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
| Inventory quantity sum | 7 | 7 |
| Inventory reserved sum | 0 | 0 |

All nine aggregate business-row digests match the baseline. No Reservation table exists. The only observed change caused by the attempted deployment is Prisma's unfinished history record.

## C. Proposed replacement guard

1. Read only the explicit Development setting, never fall back to DATABASE_URL. Parse the configured production endpoint solely to establish it differs; never connect to it. Reject missing settings, alternate host/hostaddr overrides, duplicate or contradictory TLS parameters and TLS bypass flags.
2. Pin the approved direct Neon hostname/endpoint, database/public schema and installed engine version. Verify project/branch/endpoint through the actual read-only PostgreSQL connection. A successful current connection alone does not prove that a branch cannot expire later; recheck immediately before every authorized action and stop on failure.
3. Use separate, driver-correct strict TLS settings for `pg` and the native CLI. Verify client certificate/hostname and fail closed. Do not claim a `pg` socket proves another process's TLS. Never use the native parser's permissive defaults.
4. Keep SQL guards for current_database, current_schema and all three exact Neon settings, using IS DISTINCT FROM so missing settings fail closed. Retain BEGIN and lock/statement timeouts. Do not use pg_stat_ssl as a proxy for external-client TLS.
5. Runner must independently gate every write command, permit only the named failed attempt for resolve and only the single approved pending migration for deploy. Pin revised SQL checksum and immutable prior migration checksums in an isolated migration set. Do not reuse the old runner unchanged: it intentionally rejects unfinished/rolled-back histories, pins the original hash, and requires the old SQL TLS predicate.
6. Re-run read-only snapshot/catalog/history/drift checks immediately before resolve and deploy, then compare after each operation. A discrepancy stops the process. Preserve evidence and surface sanitized errors.

Proposed SQL diff only; **not applied to the migration file**:

```diff
 -- Intentionally pinned to approved Neon Development. Never deploy to production.
+-- External client TLS must be verified by the guarded deployment runner.
 DO $$
 BEGIN
   IF current_database() <> 'neondb' OR current_schema() <> 'public'
     OR current_setting('neon.project_id', true) IS DISTINCT FROM 'hidden-forest-64993760'
     OR current_setting('neon.branch_id', true) IS DISTINCT FROM 'br-proud-field-b3xjljxh'
     OR current_setting('neon.endpoint_id', true) IS DISTINCT FROM 'ep-lucky-fire-b3froe7u'
-    OR NOT EXISTS (SELECT 1 FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl)
-  THEN RAISE EXCEPTION 'Checkout migration requires verified approved Neon Development with TLS';
+  THEN RAISE EXCEPTION 'Checkout migration requires approved Neon Development identity';
   END IF;
 END $$;
```

No DDL, constraints, business writes, reservation policy or COD behavior would change. This design requires approval of verified client-to-Neon TLS plus Neon's managed internal transport model; it is insufficient if policy demands externally proven TLS for every internal hop.

## D. Proposed recovery and checksums

Prisma v7's documented failed-migration procedure permits marking a failed migration rolled back, fixing its cause and redeploying. Resolve changes migration bookkeeping; it does not undo partially applied DDL. Official procedure: https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing

After separate approval, the proposed sequence is:

1. Prepare and review a Development-only recovery runner/config and driver-specific TLS tests; clear the TLS BLOCKER. Preserve the original failed SQL and hash. Reconfirm no partial changes, no unrelated pending migrations and exact identity.
2. With the original SQL preserved, mark only this failed attempt rolled back through guarded Prisma resolve. Verify that only the expected bookkeeping changed.
3. Install the approved SQL diff locally, compute and review its exact SHA-256, and update the runner's pinned checksum/manifest. The old failed row retains the old checksum; do not rewrite it manually. Do not edit the five successfully applied migrations.
4. History verification must explicitly allow this one historical rolled-back failed row with its original checksum, while pinning the retry to the revised SQL checksum. Do not globally ignore checksum mismatches or accept arbitrary rolled-back rows. A successful retry should produce a new completed attempt for the same migration name and revised checksum.
5. Deploy the isolated migration set, with exactly this one pending migration. Recheck all catalogs, history, checksums, business counts/digests and inventory totals. No seed or write integration tests.

Underlying commands proposed for the future guarded runner:

```powershell
# REVIEW ONLY. The recovery config below DOES NOT EXIST yet.
# It must fail unless called by the reviewed runner after fresh preflight.
.\node_modules\.bin\prisma.cmd migrate resolve --rolled-back 20261017000000_checkout_v1_foundation --config prisma.checkout-recovery.config.ts
.\node_modules\.bin\prisma.cmd migrate deploy --config prisma.checkout-recovery.config.ts
```

These are not ready-to-run commands. The existing deploy config does not permit resolve, and using the default config is not an acceptable substitute. Neither command was executed. Never use resolve --applied, manual history edits, reset, migrate dev or db push for this recovery.

## E. Decision and remaining risks

| Area | Result |
| --- | --- |
| Exact Development identity/read-only audit | PASS |
| Actual pg client TLS/certificate/hostname | PASS |
| Failed history/checksum and unchanged business/schema | PASS |
| Treating backend ssl=false as external TLS evidence | WARNING — invalid inference |
| Existing Prisma-native strict TLS guarantee | BLOCKER |
| Existing runner usable unchanged for recovery | BLOCKER |
| Revised SQL/runner checksum and recovery execution | Pending separate review/approval |

Decisions required: approve preparing the driver-specific strict-TLS runner/config and offline/readonly validation; approve the proposed SQL guard model/diff after that evidence; then separately approve resolve --rolled-back and redeploy with the final pinned checksum. Approval of this audit is not execution permission.

Residual risks: schema locks/timeouts during DDL, data drift between observations, branch availability, differing Node/Windows native trust stores, and unobserved private-network transport. If native strict TLS or the accepted transport model cannot be established, remain blocked. No new tests were run because executable code was unchanged; previously reported offline checks do not certify this proposed recovery.

No production connection, database write, .env/schema/active migration modification, Order/Payment/Reservation creation, Inventory mutation, commit/push or Phase 2 work occurred in this audit. Stop here awaiting approval.
