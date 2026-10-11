import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { paymentRepository } from "@/features/payments/repositories/payment.repository";
import { paymentEventRepository } from "@/features/payments/repositories/payment-event.repository";
import { orderStatusHistoryRepository } from "@/features/orders/repositories/order-status-history.repository";
import { extractPaymentCode, normalizeSepayCode, type SepayWebhook } from "../schemas/sepay.schema";

export type SepayReceiver = { accountNumber: string; gateway?: string; subAccount?: string };
export type SepayResult = { outcome: "confirmed" | "duplicate" | "review"; reason?: string };

function matchesEvent(event: { paymentId: string; amount: number | null; transactionId: string | null; payload: Prisma.JsonValue | null }, body: SepayWebhook, paymentId: string) {
  const saved = event.payload as Record<string, unknown> | null;
  return event.paymentId === paymentId && event.amount === body.transferAmount &&
    event.transactionId === (body.referenceCode || null) && saved?.accountNumber === body.accountNumber &&
    saved?.gateway === body.gateway && (saved?.subAccount ?? "") === (body.subAccount ?? "") &&
    saved?.content === body.content &&
    normalizeSepayCode(typeof saved?.code === "string" ? saved.code : null) === normalizeSepayCode(body.code);
}

export async function confirmSepayPayment(db: PrismaClient, body: SepayWebhook, receiver: SepayReceiver): Promise<SepayResult> {
  const review = (reason: string): SepayResult => ({ outcome: "review", reason });
  if (body.transferType !== "in") return review("outgoing_transfer");
  if (body.accountNumber !== receiver.accountNumber ||
      (receiver.gateway !== undefined && body.gateway !== receiver.gateway) ||
      (receiver.subAccount !== undefined && (body.subAccount ?? "") !== receiver.subAccount)) return review("receiver_mismatch");
  const paymentCode = extractPaymentCode(body);
  if (!paymentCode) return review("invalid_payment_code");
  const eventId = String(body.id);

  // Retry the entire unit after a serialization conflict or a concurrent event insert.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const payment = await paymentRepository.findByPaymentCode(paymentCode, tx);
        if (!payment) return review("payment_not_found");
        const existing = await paymentEventRepository.findByProviderEventId("SEPAY", eventId, tx);
        if (existing) return matchesEvent(existing, body, payment.id)
          ? { outcome: "duplicate" as const } : review("event_conflict");
        if (payment.method !== "BANK_TRANSFER" || payment.status !== "PENDING" || payment.order.status !== "PENDING") return review("ineligible_status");
        if (payment.order.currency !== "VND") return review("currency_mismatch");
        if (body.transferAmount !== payment.amount || payment.amount !== payment.order.totalAmount) return review("amount_mismatch");
        if (body.referenceCode) {
          const previous = await paymentEventRepository.findByTransactionId(body.referenceCode, tx);
          if (previous.some((event) => {
            const payload = event.payload as Record<string, unknown> | null;
            return event.provider === "SEPAY" && payload?.accountNumber === body.accountNumber && payload?.gateway === body.gateway;
          })) return review("reference_already_used");
        }
        await paymentEventRepository.create({
          payment: { connect: { id: payment.id } }, provider: "SEPAY", eventId,
          transactionId: body.referenceCode || null, amount: body.transferAmount, currency: "VND", payload: body,
        }, tx);
        const paid = await paymentRepository.markPaidIfPending(payment.id, eventId, body.referenceCode || null, tx);
        if (paid.count !== 1) throw new Error("Concurrent payment change");
        const order = await tx.order.updateMany({ where: { id: payment.orderId, status: "PENDING" }, data: { status: "CONFIRMED" } });
        if (order.count !== 1) throw new Error("Concurrent order change");
        await orderStatusHistoryRepository.create({
          order: { connect: { id: payment.orderId } }, fromStatus: "PENDING", toStatus: "CONFIRMED",
          note: `SePay test payment confirmed: ${eventId}`,
        }, tx);
        return { outcome: "confirmed" as const };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 2 && (code === "P2034" || code === "P2002")) continue;
      throw error;
    }
  }
  throw new Error("SePay transaction retries exhausted");
}
