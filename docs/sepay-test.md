# SePay Test Mode

Auto-confirmation is disabled by default. Do not enable it until database-write testing is approved.
Load these settings into the same PowerShell session that starts Next.js; this feature does not load an environment file itself.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing connection to the verified Neon `sepay-test` branch; never share or log this value |
| `SEPAY_WEBHOOK_SECRET` | Existing HMAC secret; never share or log this value |
| `SEPAY_MODE` | Must be `test` |
| `SEPAY_AUTO_CONFIRM_ENABLED` | Leave unset or `false` until approved; `true` enables database writes on valid webhooks |
| `SEPAY_TEST_DATABASE_HOST` | Exact hostname of the verified test endpoint, including `-pooler` if used |
| `SEPAY_TEST_ACCOUNT_NUMBER` | Required receiving account, as a string preserving leading zeroes |
| `SEPAY_TEST_GATEWAY` | Optional exact bank identifier; recommended when known |
| `SEPAY_TEST_SUB_ACCOUNT` | Optional exact VA identifier; an empty value requires no VA |
| `SEPAY_TEST_ALLOWED_PAYMENT_CODES` | Phase three: must contain only `KONO-SEPAYTEST-5FC7B6FC-D190-497F-88BC-E4148967390F`; the launcher sets this exact value |

Restart Next.js after changing process configuration. The hostname guard checks configuration consistency;
it does not query the Neon control plane to prove which branch owns the endpoint.

Only incoming VND transfers with an exact amount, a unique payment code, a pending bank-transfer Payment,
and a pending Order are confirmed. A null code is extracted from complete content tokens using the existing
`KONO-<orderNumber>` format. Conflicting or multiple codes are rejected. No partial-payment aggregation is performed.

PaymentEvent creation, Payment settlement, Order confirmation, and OrderStatusHistory creation share one
Serializable transaction. Duplicate event IDs are acknowledged only when core event data agrees. Serialization
and unique conflicts retry the complete transaction up to three times; errors then return HTTP 500.
Admin state changes use conditional writes to avoid overwriting a concurrently changed state.

Business exceptions return HTTP 200 with `success: true`, `outcome: review`, and a reason, without database writes.
This acknowledges delivery, not payment. Review results are logged without bank details or raw payloads;
there is no durable inbox for unmatched events in the current schema. Retain delivery logs for reconciliation.
Disabled/misconfigured confirmation returns 503, so SePay may retry delivery.

Offline checks (no database connection):

```powershell
npx.cmd tsc --noEmit
.\node_modules\.bin\tsx.cmd --test src/features/payments/services/sepay.service.test.ts src/app/api/webhooks/sepay/route.test.ts
```

These tests simulate transactions and concurrency; they do not prove PostgreSQL isolation or Neon adapter behavior.
After approval, verify actual transactions, simultaneous deliveries, and rollback on the test branch before production use.
No migration or seed is needed. Phase-two tools below are prepared but must not be run against a database until separately approved.

## Phase two: approval and setup

All commands below that access a database are future steps. Do not run them yet.
Keep public auto-confirm disabled during fixture creation and harness testing. The current
`start-sepay-test.ps1` forces it off by default; editing a file to `true` will not enable that launcher.
Enabling public confirmation requires separate approval, the explicit `-EnableAutoConfirm` switch,
an independently verified `-ApprovedTestHost`, a configured gateway, and a server restart.

Use a separate PowerShell session with the test settings already loaded securely. Environment variables
loaded inside the launcher process do not propagate back to another terminal. The TypeScript tools
never load `.env` or `.env.sepay-test.local`; missing settings fail closed. Do not print environment variables.
Pass `--host` using the endpoint independently verified on Neon Console as belonging to `sepay-test`.
The tools require both the configured hostname and `SEPAY_TEST_DATABASE_HOST` to match that argument.
They cannot verify branch ownership through the Neon control plane. Never pass credentials as CLI arguments.

### 1. Create isolated fixtures, after write approval

Use an existing active variant ID from the test branch. The tool does not create products or alter stock.
Run once per case (webhook success, rollback, concurrency). Each run uses a new UUID and creates a
100,000 VND Order, item, BANK_TRANSFER Payment with its code, and pending Shipment atomically.
It creates no initial status history. The output contains only test identifiers, code and amount.

```powershell
.\node_modules\.bin\tsx.cmd scripts/prepare-sepay-test.ts --host <approved-test-host> --variant-id <existing-test-variant-id> --allow-test-writes
```

Record the returned Order ID and paymentCode. Never substitute an old SePay payment code.
The fixture marker is `SEPAY_PHASE2_FIXTURE`; uniqueness is enforced by existing database constraints.

### 2. Read-only reconciliation

```powershell
.\node_modules\.bin\tsx.cmd scripts/reconcile-sepay-test.ts --host <approved-test-host> --order-id <fixture-order-id>
```

This uses a READ ONLY transaction and selects no bank payload, account details, reference code or customer details.
Before payment: Order/Payment PENDING, paidAt null, zero events/history.
After payment: Order CONFIRMED, Payment PAID, paidAt present, one SEPAY event for the correct amount/currency,
and one PENDING-to-CONFIRMED history entry with changedById null. Run after each case.

### 3. Rollback harness, after write approval

Use a fresh pending fixture reserved for rollback. Receiver account and gateway settings are required.

```powershell
.\node_modules\.bin\tsx.cmd scripts/test-sepay-database.ts --host <approved-test-host> --order-id <rollback-fixture-id> --case rollback --allow-test-writes
```

The harness calls the existing confirmation service with synthetic event data. A client wrapper throws
at history creation, after event/payment/order writes were attempted. A separate read checks the complete
selected snapshot is unchanged and the synthetic event does not exist. It does not send HTTP requests
or modify the public webhook/service to inject failures. Transactional writes are attempted even though
they must roll back, so explicit write approval is required. The fixture remains pending.

### 4. Concurrency and duplicate harness, after write approval

Use a separate fresh pending fixture; this test commits payment data.

```powershell
.\node_modules\.bin\tsx.cmd scripts/test-sepay-database.ts --host <approved-test-host> --order-id <concurrency-fixture-id> --case concurrency --allow-test-writes
```

Two connected Prisma clients compete with the same new synthetic event ID and reference. Expected outcomes
are one confirmed and one duplicate, then another duplicate on replay. Assertions verify PAID/CONFIRMED,
paidAt, provider ID, exactly one event and exactly one history entry. This tests database/service behavior;
it does not test Ngrok, HMAC, or SePay delivery. A failed assertion may leave a committed confirmation;
reconcile the fixture before continuing. No fixture is deleted or reset automatically.

### 5. Protect against old 503 retries before enabling the public webhook

Review existing SePay delivery attempts and let old retries expire or stop them through available SePay controls.
Do not rely on HMAC timestamp checks: retries can have a new signature timestamp.
For phase three, only the single fixture code documented below can be authorized.
Missing or malformed lists fail closed with 503. A verified request carrying any other code receives
200/success=true with outcome=review and reason=payment_code_not_allowed before any Prisma import.
The route requires exactly the phase-three code; other UUID codes or additional entries fail closed with 503.
Remove fixture codes after each public test and disable auto-confirm when done. Test the allowlist behavior
before permitting a successful payment. Do not authorize a code until ready: any queued webhook with that
same newly authorized code could then be processed.

After a separate approval to enable public confirmation, use a new simulated incoming transaction in
SePay Test Mode for the webhook fixture, amount 100,000 VND and exactly one code in content. Reconcile
the four models, then replay the same event with fresh signing headers to test HTTP duplicate behavior.
Do not replay captured headers older than five minutes. Share only response status/outcome and sanitized
test-model snapshots, never raw banking payloads or credentials.

## Phase three: prepared only, not enabled

Approved fixture scope:

- Order ID: `cmv3zdsl00000t0ufnnvcw8wq`
- Payment ID: `cmv3zdsng0002t0ufq3bqzkyx`
- Payment code: `KONO-SEPAYTEST-5FC7B6FC-D190-497F-88BC-E4148967390F`
- Amount: 100,000 VND

The launcher overwrites any allowlist from the file or inherited environment with this single code.
The route independently enforces the same scope, even if the launcher is bypassed.
The normal startup command keeps confirmation off. No environment file is changed by this implementation.

Before asking for approval to enable:

1. Run read-only reconciliation in the separate configured tools terminal:

   ```powershell
   .\node_modules\.bin\tsx.cmd scripts/reconcile-sepay-test.ts --host "$env:SEPAY_TEST_DATABASE_HOST" --order-id "cmv3zdsl00000t0ufnnvcw8wq"
   ```

   Confirm the exact payment ID/code, BANK_TRANSFER, VND, matching 100000 amounts,
   both states PENDING, paidAt/providerPaymentId null and empty event/history arrays.
   If this fixture was used for concurrency, it is already paid and cannot serve as a fresh success test.
2. Independently compare the endpoint hostname with Neon Console branch `sepay-test`.
3. Check SePay Test Mode delivery logs. Review pending 503 retries, particularly any carrying this exact code.
   Old codes are blocked before database access; a pending request with this authorized code can be confirmed
   immediately after enabling if its signature, payload and business checks are valid. In that case stop and
   resolve delivery retries before proceeding. This workspace cannot inspect the SePay delivery queue.
4. Confirm the Test Mode webhook URL uses the current Ngrok HTTPS address and path `/api/webhooks/sepay`,
   forwarding to port 3000, with JSON and HMAC using the test secret. Keep secret values private.
5. Request separate approval to enable this fixture, including the expected test-database writes.

Only after that approval, stop the old Next.js server and run from the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-sepay-test.ps1 -EnableAutoConfirm -ApprovedTestHost "NEON_HOST_VERIFIED_FOR_SEPAY_TEST"
```

Replace the hostname placeholder with the independently verified hostname (not a connection string).
The script checks exact hostname equality and does not change DATABASE_URL. Confirm the server actually
listens on port 3000 before keeping the Ngrok forwarding active. Enabling can allow queued eligible requests;
do not treat it as a read-only action. Sending a new simulated SePay payment is a separately approved step.

After testing, stop that server and restart without the switch:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-sepay-test.ps1
```

This forces confirmation off again. Reconcile using the separate tools terminal with auto-confirm false.
No fixture data is reset or deleted. Changing environment values in another shell cannot disable an already
running enabled server; stopping/restarting the server is required.

## Expanded offline checks

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint scripts/lib/sepay-test.ts scripts/lib/sepay-test.test.ts scripts/prepare-sepay-test.ts scripts/reconcile-sepay-test.ts scripts/test-sepay-database.ts src/features/payments/schemas/sepay.schema.ts src/app/api/webhooks/sepay/route.ts src/app/api/webhooks/sepay/route.test.ts
.\node_modules\.bin\tsx.cmd --test scripts/lib/sepay-test.test.ts src/features/payments/services/sepay.service.test.ts src/app/api/webhooks/sepay/route.test.ts
```

Only the `.test.ts` files are offline. Never include the three database CLI tools in a unit-test command.
