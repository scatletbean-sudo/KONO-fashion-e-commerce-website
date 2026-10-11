import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { validateTestEnvironment } from "./sepay-test";
import { paymentCodeService } from "../../src/features/payments/services/payment-code.service";
import { extractPaymentCode, parseTestPaymentAllowlist } from "../../src/features/payments/schemas/sepay.schema";

const host = "ep-offline-test.us-east-2.aws.neon.tech";
const env = { SEPAY_MODE: "test", SEPAY_TEST_DATABASE_HOST: host,
  DATABASE_URL: `postgresql://synthetic:synthetic@${host}/neondb`, SEPAY_AUTO_CONFIRM_ENABLED: "false" };

test("database tools fail closed for wrong mode, endpoint, inherited auto-confirm or missing write approval", () => {
  assert.doesNotThrow(() => validateTestEnvironment(env, host, false, false));
  assert.doesNotThrow(() => validateTestEnvironment(env, host, true, true));
  assert.throws(() => validateTestEnvironment(env, host, true, false));
  for (const patch of [
    { SEPAY_MODE: "live" }, { SEPAY_TEST_DATABASE_HOST: "other" }, { DATABASE_URL: "invalid" },
    { DATABASE_URL: "postgresql://synthetic:synthetic@ep-other.us-east-2.aws.neon.tech/neondb" },
    { SEPAY_AUTO_CONFIRM_ENABLED: "true" },
  ]) assert.throws(() => validateTestEnvironment({ ...env, ...patch }, host, true, true));
});

test("new fixture codes are unique and exactly recognized with a null webhook code", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const code = paymentCodeService.generate(`SEPAYTEST-${randomUUID().toUpperCase()}`);
    assert.equal(extractPaymentCode({ id: 1, accountNumber: "synthetic", gateway: "synthetic", code: null,
      content: `Thanh toan ${code}`, transferType: "in", transferAmount: 100000 }), code);
    assert.deepEqual(parseTestPaymentAllowlist(code), [code]);
    codes.add(code);
  }
  assert.equal(codes.size, 50);
});

test("allowlist rejects missing, malformed or historical codes", () => {
  for (const value of [undefined, "", "KONO-KONO-BANK-123", "KONO-SEPAYTEST-old", "*"]) {
    assert.deepEqual(parseTestPaymentAllowlist(value), []);
  }
});
