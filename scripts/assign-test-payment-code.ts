import "dotenv/config";

import { paymentService } from "@/features/payments/services/payment.service";

const orderId = "cmup1huc00000c4vp3hfb63jk";

async function main() {
  const payment =
    await paymentService.getPaymentByOrderId(orderId);

  console.log("Payment found:");
  console.log("Payment ID:", payment.id);
  console.log("Order Number:", payment.order.orderNumber);
  console.log("Payment Method:", payment.method);
  console.log("Payment Status:", payment.status);
  console.log("Current Payment Code:", payment.paymentCode);

  const updated =
    await paymentService.assignPaymentCode(payment.id);

  console.log("");
  console.log("Payment code assigned:");
  console.log("Payment ID:", updated.id);
  console.log("Payment Code:", updated.paymentCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});