import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "./route";
import { PHASE_THREE_PAYMENT_CODE } from "@/features/payments/schemas/sepay.schema";

// Synthetic credentials only; no .env loading and no database-enabled requests.
process.env.SEPAY_WEBHOOK_SECRET = "synthetic-unit-test-key";
process.env.SEPAY_AUTO_CONFIRM_ENABLED = "false";
const payload = JSON.stringify({ id: 1, gateway: "TestBank", accountNumber: "001234", code: null,
  content: "KONO-TEST-1", transferType: "in", transferAmount: 100 });
function request(raw: string, timestamp = String(Math.floor(Date.now() / 1000)), signature?: string) {
  const signed = signature ?? "sha256=" + createHmac("sha256", "synthetic-unit-test-key").update(`${timestamp}.${raw}`).digest("hex");
  return new Request("http://localhost/api/webhooks/sepay", { method: "POST", body: raw,
    headers: { "x-sepay-timestamp": timestamp, "x-sepay-signature": signed } });
}
test("HMAC rejects forged signatures and stale timestamps", async () => {
  assert.equal((await POST(request(payload, undefined, "sha256=invalid"))).status, 401);
  assert.equal((await POST(request(payload, "1"))).status, 401);
});
test("HMAC signs original body bytes, not reconstructed JSON", async () => {
  const signed = "sha256=" + createHmac("sha256", "synthetic-unit-test-key")
    .update(`${Math.floor(Date.now() / 1000)}.${payload}`).digest("hex");
  assert.equal((await POST(request(payload + " ", undefined, signed))).status, 401);
});
test("verified malformed JSON and payloads are rejected", async () => {
  assert.equal((await POST(request("{"))).status, 400);
  assert.equal((await POST(request("{}"))).status, 400);
});
test("confirmation stays disabled until writes are explicitly enabled", async () => {
  const response = await POST(request(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test("enabled test mode still rejects missing allowlist and blocks an old retry without loading Prisma", async () => {
  process.env.SEPAY_AUTO_CONFIRM_ENABLED = "true";
  process.env.SEPAY_MODE = "test";
  process.env.SEPAY_TEST_ACCOUNT_NUMBER = "001234";
  process.env.SEPAY_TEST_DATABASE_HOST = "ep-synthetic.us-east-2.aws.neon.tech";
  process.env.DATABASE_URL = "postgresql://synthetic:synthetic@ep-synthetic.us-east-2.aws.neon.tech/neondb";
  delete process.env.SEPAY_TEST_ALLOWED_PAYMENT_CODES;
  try {
    assert.equal((await POST(request(payload))).status, 503);
    process.env.SEPAY_TEST_ALLOWED_PAYMENT_CODES = "KONO-SEPAYTEST-01234567-89AB-4CDE-8FAB-0123456789AB";
    assert.equal((await POST(request(payload))).status, 503);
    process.env.SEPAY_TEST_ALLOWED_PAYMENT_CODES = `${PHASE_THREE_PAYMENT_CODE},KONO-SEPAYTEST-01234567-89AB-4CDE-8FAB-0123456789AB`;
    assert.equal((await POST(request(payload))).status, 503);
    process.env.SEPAY_TEST_ALLOWED_PAYMENT_CODES = PHASE_THREE_PAYMENT_CODE;
    const response = await POST(request(payload));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, "payment_code_not_allowed");
    for (const code of ["", null]) {
      const blocked = await POST(request(JSON.stringify({ ...JSON.parse(payload), code })));
      assert.equal(blocked.status, 200);
      assert.equal((await blocked.json()).reason, "payment_code_not_allowed");
    }
  } finally {
    process.env.SEPAY_AUTO_CONFIRM_ENABLED = "false";
  }
});
