import { randomUUID } from "node:crypto";
import { paymentCodeService } from "../src/features/payments/services/payment-code.service";
import { extractPaymentCode } from "../src/features/payments/schemas/sepay.schema";
import { argument, runTool } from "./lib/sepay-test";

void runTool(async (db) => {
  const variantId = argument("--variant-id");
  const orderNumber = `SEPAYTEST-${randomUUID().toUpperCase()}`;
  const paymentCode = paymentCodeService.generate(orderNumber);
  if (extractPaymentCode({ id: 1, gateway: "TEST", accountNumber: "TEST", code: null,
    content: `Thanh toan ${paymentCode}`, transferType: "in", transferAmount: 100000 }) !== paymentCode) throw new Error("Code recognition failed");
  const order = await db.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant?.isActive) throw new Error("Existing active variant required");
    return tx.order.create({ data: {
      orderNumber, status: "PENDING", subtotal: 100000, totalAmount: 100000, currency: "VND",
      customerEmail: "sepay-phase2@example.invalid", customerPhone: "0000000000", customerName: "SePay Phase 2 Test",
      notes: "SEPAY_PHASE2_FIXTURE",
      items: { create: { productId: variant.productId, variantId: variant.id, productName: variant.product.name,
        sku: variant.sku, quantity: 1, unitPrice: 100000, totalPrice: 100000 } },
      payment: { create: { method: "BANK_TRANSFER", status: "PENDING", amount: 100000, paymentCode } },
      shipment: { create: { status: "PENDING", shippingAddress: "Synthetic SePay test address" } },
    }, select: { id: true, orderNumber: true, payment: { select: { id: true, paymentCode: true, amount: true } } } });
  }, { isolationLevel: "Serializable" });
  console.log(JSON.stringify(order, null, 2));
}, true);
