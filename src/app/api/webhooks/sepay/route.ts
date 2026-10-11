
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sepayWebhookSchema, extractPaymentCode, parseTestPaymentAllowlist, PHASE_THREE_PAYMENT_CODE } from "@/features/payments/schemas/sepay.schema";

export async function POST(request: Request) {
  try {
    // Phải dùng body gốc để xác minh chữ ký
    const rawBody = await request.text();

    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Missing SEPAY_WEBHOOK_SECRET");
      return NextResponse.json(
        { success: false, message: "Webhook not configured" },
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-sepay-signature") ?? "";
    const timestamp = request.headers.get("x-sepay-timestamp") ?? "";
    const timestampNumber = Number(timestamp);

    // Chống request cũ bị phát lại
    if (
      !timestamp ||
      !Number.isFinite(timestampNumber) ||
      Math.abs(Date.now() / 1000 - timestampNumber) > 300
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid timestamp" },
        { status: 401 }
      );
    }

    // Tính lại chữ ký theo chuẩn SePay
    const expected =
      "sha256=" +
      createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

    const receivedBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid signature" },
        { status: 401 }
      );
    }

    // Chỉ parse payload sau khi xác minh thành công
    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON" },
        { status: 400 }
      );
    }

    const parsed = sepayWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Invalid webhook payload" }, { status: 400 });
    }

    // Explicit opt-in: remain disabled until database-write testing is approved.
    const accountNumber = process.env.SEPAY_TEST_ACCOUNT_NUMBER;
    const expectedHost = process.env.SEPAY_TEST_DATABASE_HOST;
    const allowedCodes = parseTestPaymentAllowlist(process.env.SEPAY_TEST_ALLOWED_PAYMENT_CODES);
    let host: string | undefined;
    try { host = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* fail closed */ }
    if (process.env.SEPAY_AUTO_CONFIRM_ENABLED !== "true" ||
        process.env.SEPAY_MODE !== "test" || !accountNumber || !expectedHost || host !== expectedHost ||
        allowedCodes.length !== 1 || allowedCodes[0] !== PHASE_THREE_PAYMENT_CODE) {
      return NextResponse.json({ success: false, message: "Test payment confirmation disabled or misconfigured" }, { status: 503 });
    }

    // A new signing timestamp cannot make an old retried payment eligible.
    const paymentCode = extractPaymentCode(parsed.data);
    if (!paymentCode || !allowedCodes.includes(paymentCode)) {
      return NextResponse.json({ success: true, outcome: "review", reason: "payment_code_not_allowed" });
    }

    const { prisma } = await import("@/lib/db/prisma");
    const { confirmSepayPayment } = await import("@/features/payments/services/sepay.service");
    const result = await confirmSepayPayment(prisma, parsed.data, {
      accountNumber,
      gateway: process.env.SEPAY_TEST_GATEWAY,
      subAccount: process.env.SEPAY_TEST_SUB_ACCOUNT,
    });
    console.info("SePay webhook result", { eventId: parsed.data.id, ...result });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // Do not log database errors or raw payloads: they may contain credentials or PII.
    console.error("SePay webhook processing failed", { errorType: error instanceof Error ? error.name : "Unknown" });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
