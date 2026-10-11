import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import { extractPaymentCode, sepayWebhookSchema, parseTestPaymentAllowlist, PHASE_THREE_PAYMENT_CODE, type SepayWebhook } from "../schemas/sepay.schema";

// No dotenv loading, no connection: repositories always receive the in-memory tx.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:1/test";
const service = import("./sepay.service");
const receiver = { accountNumber: "001234", gateway: "TestBank", subAccount: "" };
const body: SepayWebhook = {
  id: 42, gateway: "TestBank", accountNumber: "001234", subAccount: "",
  code: null, content: "Thanh toan KONO-KONO-BANK-123", transferType: "in",
  transferAmount: 100000, referenceCode: "REF42",
};

type Event = { paymentId: string; provider: string; eventId: string; transactionId: string | null; amount: number; payload: SepayWebhook };
function fixture(failAt?: string, retryCode?: string) {
  let state = {
    payment: { id: "p1", orderId: "o1", paymentCode: "KONO-KONO-BANK-123", method: "BANK_TRANSFER", status: "PENDING", amount: 100000,
      order: { status: "PENDING", currency: "VND", totalAmount: 100000 } },
    events: [] as Event[], history: [] as unknown[],
  };
  let attempts = 0;
  let queue = Promise.resolve();
  const db = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) {
      assert.equal(options.isolationLevel, "Serializable");
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const draft = structuredClone(state);
      try {
        attempts++;
        if (retryCode && attempts === 1) throw Object.assign(new Error("retry"), { code: retryCode });
        const tx = {
          payment: {
            findUnique: async ({ where }: { where: { paymentCode: string } }) => where.paymentCode === draft.payment.paymentCode ? draft.payment : null,
            updateMany: async () => {
              if (failAt === "payment") return { count: 0 };
              draft.payment.status = "PAID";
              return { count: 1 };
            },
          },
          paymentEvent: {
            findUnique: async ({ where }: { where: { provider_eventId: { eventId: string } } }) => draft.events.find((e) => e.eventId === where.provider_eventId.eventId) ?? null,
            findMany: async ({ where }: { where: { transactionId: string } }) => draft.events.filter((e) => e.transactionId === where.transactionId),
            create: async ({ data }: { data: Omit<Event, "paymentId"> & { payment: { connect: { id: string } } } }) => {
              if (draft.events.some((e) => e.eventId === data.eventId)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
              const event = { ...data, paymentId: data.payment.connect.id };
              draft.events.push(event);
              return event;
            },
          },
          order: { updateMany: async () => {
            if (failAt === "order") return { count: 0 };
            draft.payment.order.status = "CONFIRMED";
            return { count: 1 };
          } },
          orderStatusHistory: { create: async ({ data }: { data: unknown }) => {
            if (failAt === "history") throw new Error("history failed");
            draft.history.push(data);
            return data;
          } },
        };
        const result = await callback(tx);
        state = draft;
        return result;
      } finally { release(); }
    },
  } as unknown as PrismaClient;
  return { db, state: () => state, attempts: () => attempts };
}

test("exact code fallback rejects embedded, ambiguous and contradictory codes", () => {
  assert.equal(extractPaymentCode(body), "KONO-KONO-BANK-123");
  for (const content of ["XKONO-KONO-BANK-123", "éKONO-KONO-BANK-123", "KONO-KONO-BANK-123_X", "KONO-A KONO-B"]) {
    assert.equal(extractPaymentCode({ ...body, content }), null);
  }
  assert.equal(extractPaymentCode({ ...body, code: "KONO-OTHER" }), null);
});

test("schema rejects malformed id and unsafe/nonintegral amounts", () => {
  for (const patch of [{ id: -1 }, { transferAmount: 0 }, { transferAmount: 1.5 }, { transferAmount: 2147483648 }]) {
    assert.equal(sepayWebhookSchema.safeParse({ ...body, ...patch }).success, false);
  }
});

test("empty, null and valid explicit codes recognize the approved content; allowlist still excludes other codes", () => {
  const allowlist = parseTestPaymentAllowlist(PHASE_THREE_PAYMENT_CODE);
  for (const code of ["", "   ", null, PHASE_THREE_PAYMENT_CODE]) {
    const parsed = sepayWebhookSchema.parse({ ...body, code, content: PHASE_THREE_PAYMENT_CODE });
    assert.equal(extractPaymentCode(parsed), PHASE_THREE_PAYMENT_CODE);
    assert.ok(allowlist.includes(extractPaymentCode(parsed)!));
    if (!code?.trim()) assert.equal(parsed.code, null);
    // Direct service callers get the same fallback without schema parsing.
    assert.equal(extractPaymentCode({ ...body, code, content: PHASE_THREE_PAYMENT_CODE }), PHASE_THREE_PAYMENT_CODE);
  }
  const other = "KONO-SEPAYTEST-01234567-89AB-4CDE-8FAB-0123456789AB";
  for (const code of ["", null, other]) {
    const parsed = sepayWebhookSchema.parse({ ...body, code, content: other });
    assert.equal(allowlist.includes(extractPaymentCode(parsed)!), false);
  }
  for (const code of ["INVALID", "KONO-OTHER"]) {
    assert.equal(extractPaymentCode({ ...body, code, content: PHASE_THREE_PAYMENT_CODE }), null);
  }
  assert.equal(extractPaymentCode({ ...body, code: "", content: `${PHASE_THREE_PAYMENT_CODE} ${other}` }), null);
});

test("empty-code payment confirms in memory and null/empty retries are idempotent, including previously saved empty codes", async () => {
  const { confirmSepayPayment } = await service;
  const f = fixture();
  f.state().payment.paymentCode = PHASE_THREE_PAYMENT_CODE;
  const incoming = { ...body, code: "", content: PHASE_THREE_PAYMENT_CODE };
  assert.equal((await confirmSepayPayment(f.db, incoming, receiver)).outcome, "confirmed");
  assert.equal((await confirmSepayPayment(f.db, { ...incoming, code: null }, receiver)).outcome, "duplicate");
  assert.equal((await confirmSepayPayment(f.db, sepayWebhookSchema.parse(incoming), receiver)).outcome, "duplicate");
  assert.equal(f.state().events.length, 1);
  assert.equal(f.state().history.length, 1);
});

test("success atomically confirms all four models; retry is idempotent", async () => {
  const { confirmSepayPayment } = await service;
  const f = fixture();
  assert.equal((await confirmSepayPayment(f.db, body, receiver)).outcome, "confirmed");
  assert.equal(f.state().payment.status, "PAID");
  assert.equal(f.state().payment.order.status, "CONFIRMED");
  assert.equal((await confirmSepayPayment(f.db, body, receiver)).outcome, "duplicate");
  assert.equal(f.state().events.length, 1);
  assert.equal(f.state().history.length, 1);
  assert.equal((await confirmSepayPayment(f.db, { ...body, transferAmount: 99 }, receiver)).reason, "event_conflict");
});

test("reject wrong amount, receiver, direction, code, method, currency and statuses without writes", async () => {
  const { confirmSepayPayment } = await service;
  for (const patch of [
    { transferAmount: 99999 }, { transferAmount: 100001 }, { accountNumber: "1234" },
    { gateway: "OtherBank" }, { subAccount: "other" }, { transferType: "out" as const }, { content: "KONO-UNKNOWN" },
  ]) {
    const f = fixture();
    assert.equal((await confirmSepayPayment(f.db, { ...body, ...patch }, receiver)).outcome, "review");
    assert.equal(f.state().events.length, 0);
    assert.equal(f.state().payment.status, "PENDING");
  }
  for (const field of ["method", "paymentStatus", "orderStatus", "currency", "orderAmount"]) {
    const f = fixture();
    if (field === "method") f.state().payment.method = "COD";
    if (field === "paymentStatus") f.state().payment.status = "FAILED";
    if (field === "orderStatus") f.state().payment.order.status = "CANCELLED";
    if (field === "currency") f.state().payment.order.currency = "USD";
    if (field === "orderAmount") f.state().payment.order.totalAmount = 1;
    assert.equal((await confirmSepayPayment(f.db, body, receiver)).outcome, "review");
    assert.equal(f.state().events.length, 0);
  }
});

test("failures at payment, order or history roll back every write", async () => {
  const { confirmSepayPayment } = await service;
  for (const stage of ["payment", "order", "history"]) {
    const f = fixture(stage);
    await assert.rejects(confirmSepayPayment(f.db, body, receiver));
    assert.equal(f.state().payment.status, "PENDING");
    assert.equal(f.state().payment.order.status, "PENDING");
    assert.equal(f.state().events.length, 0);
    assert.equal(f.state().history.length, 0);
  }
});

test("concurrent deliveries produce one confirmation and one duplicate", async () => {
  const { confirmSepayPayment } = await service;
  const f = fixture();
  const results = await Promise.all([confirmSepayPayment(f.db, body, receiver), confirmSepayPayment(f.db, body, receiver)]);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ["confirmed", "duplicate"]);
  assert.equal(f.state().events.length, 1);
  assert.equal(f.state().history.length, 1);
});

test("serialization and unique conflicts retry the whole transaction", async () => {
  const { confirmSepayPayment } = await service;
  for (const code of ["P2034", "P2002"]) {
    const f = fixture(undefined, code);
    assert.equal((await confirmSepayPayment(f.db, body, receiver)).outcome, "confirmed");
    assert.equal(f.attempts(), 2);
  }
});

test("bank reference cannot be reused for another event on the same receiving account", async () => {
  const { confirmSepayPayment } = await service;
  const f = fixture();
  f.state().events.push({ paymentId: "other-payment", provider: "SEPAY", eventId: "99", transactionId: "REF42", amount: 100000, payload: body });
  assert.equal((await confirmSepayPayment(f.db, body, receiver)).reason, "reference_already_used");
  assert.equal(f.state().payment.status, "PENDING");
  assert.equal(f.state().history.length, 0);
});
