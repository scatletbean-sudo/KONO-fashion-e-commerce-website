import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { argument, runTool, snapshot, requireFreshFixture, connectTestDatabase } from "./lib/sepay-test";

void runTool(async (db) => {
  const mode = argument("--case");
  if (!["rollback", "concurrency"].includes(mode)) throw new Error("Unknown test case");
  const orderId = argument("--order-id");
  const before = await snapshot(db, orderId);
  requireFreshFixture(before);
  const accountNumber = process.env.SEPAY_TEST_ACCOUNT_NUMBER;
  const gateway = process.env.SEPAY_TEST_GATEWAY;
  if (!accountNumber || !gateway) throw new Error("Receiver configuration required");
  const body = {
    id: randomInt(1_000_000_000_000, 100_000_000_000_000), gateway, accountNumber,
    subAccount: process.env.SEPAY_TEST_SUB_ACCOUNT ?? "", code: null,
    content: `Thanh toan ${before.payment!.paymentCode}`, transferType: "in" as const,
    transferAmount: 100000, referenceCode: `HARNESS-${randomUUID()}`,
  };
  if (await db.paymentEvent.findUnique({ where: { provider_eventId: { provider: "SEPAY", eventId: String(body.id) } } })) throw new Error("Event collision");
  const receiver = { accountNumber, gateway, subAccount: body.subAccount };
  const { confirmSepayPayment } = await import("../src/features/payments/services/sepay.service");
  if (mode === "rollback") {
    // Wrap only this client. The public route/service contains no fault injection.
    const injected = new Error("Expected harness rollback");
    const wrapped = new Proxy(db, { get(target, property) {
      if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: "Serializable" }) =>
        target.$transaction(async (tx) => callback(new Proxy(tx, { get(transaction, key) {
          if (key === "orderStatusHistory") return new Proxy(transaction.orderStatusHistory, { get(delegate, method) {
            if (method === "create") return async () => { throw injected; };
            return Reflect.get(delegate, method);
          } });
          return Reflect.get(transaction, key);
        } })), options);
      return Reflect.get(target, property);
    } }) as PrismaClient;
    await assert.rejects(confirmSepayPayment(wrapped, body, receiver), (error) => error === injected);
    assert.deepEqual(await snapshot(db, orderId), before);
    assert.equal(await db.paymentEvent.count({ where: { provider: "SEPAY", eventId: String(body.id) } }), 0);
    console.log("PASS: injected history failure rolled back Payment, Order, PaymentEvent and history.");
  } else {
    const other = await connectTestDatabase(true);
    try {
      // Wait for both connections before issuing competing transactions.
      await Promise.all([db.$connect(), other.$connect()]);
      const results = await Promise.allSettled([
        confirmSepayPayment(db, body, receiver), confirmSepayPayment(other, body, receiver),
      ]);
      assert.ok(results.every((result) => result.status === "fulfilled"));
      const outcomes = results.map((result) => result.status === "fulfilled" ? result.value.outcome : "failed").sort();
      assert.deepEqual(outcomes, ["confirmed", "duplicate"]);
      assert.equal((await confirmSepayPayment(db, body, receiver)).outcome, "duplicate");
      const after = await snapshot(db, orderId);
      assert.equal(after.status, "CONFIRMED");
      assert.equal(after.payment?.status, "PAID");
      assert.ok(after.payment?.paidAt);
      assert.equal(after.payment?.providerPaymentId, String(body.id));
      assert.equal(after.payment?.paymentEvents.length, 1);
      assert.equal(after.statusHistory.length, 1);
      assert.equal(after.statusHistory[0].fromStatus, "PENDING");
      assert.equal(after.statusHistory[0].toStatus, "CONFIRMED");
      console.log("PASS: concurrent transactions and repeat delivery committed one event and one history entry.");
    } finally { await other.$disconnect(); }
  }
}, true);
