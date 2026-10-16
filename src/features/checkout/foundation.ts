import { createHash } from "node:crypto";
import { z } from "zod";

export const vndSchema = z.number().int().min(0).max(2147483647);
const positiveQuantity = z.number().int().positive().max(2147483647);
const text = z.string().trim().min(1).max(255);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const shippingSnapshotSchema = z.object({
  recipientName: text,
  recipientPhone: z.string().trim().regex(/^(?:0|\+84)[0-9]{9,10}$/),
  provinceCode: text.max(20), provinceName: text,
  wardCode: text.max(20), wardName: text,
  addressLine: text.max(500), countryCode: z.literal("VN"),
  shippingMethod: z.literal("STANDARD"), shippingAmount: vndSchema,
}).strict();

export const itemSnapshotSchema = z.object({
  productId: text, variantId: text, productName: text, sku: text,
  colorName: text.nullable(), sizeName: text.nullable(),
  quantity: positiveQuantity, unitPrice: vndSchema, totalPrice: vndSchema,
}).strict().refine(row => row.totalPrice === row.quantity * row.unitPrice, "Invalid line total");

// Input to a FUTURE server-side creation service, not a trusted public request body.
export const guestOrderFoundationSchema = z.object({
  userId: z.null().optional(), addressId: z.null().optional(),
  customerName: text, customerPhone: shippingSnapshotSchema.shape.recipientPhone,
  customerEmail: z.email().max(255).nullable().optional().transform(value => value ?? null),
  currency: z.literal("VND"), paymentMethod: z.literal("COD"),
  shipping: shippingSnapshotSchema,
  items: z.array(itemSnapshotSchema).min(1).max(50),
  subtotal: vndSchema, discountAmount: z.literal(0), taxAmount: z.literal(0), totalAmount: vndSchema,
}).strict().superRefine((order, ctx) => {
  const sum = order.items.reduce((total, row) => total + row.totalPrice, 0);
  if (sum !== order.subtotal || order.totalAmount !== sum + order.shipping.shippingAmount)
    ctx.addIssue({ code: "custom", message: "Invalid order totals" });
  if (new Set(order.items.map(row => row.variantId)).size !== order.items.length)
    ctx.addIssue({ code: "custom", message: "Duplicate variant" });
});

// Explicit development proposal only. No runtime endpoint consumes this policy.
export const developmentCheckoutProposal = Object.freeze({
  environment: "development", paymentMethod: "COD", shippingAmountVnd: 30000,
  holdHours: 24, automaticExpiry: false,
} as const);

export function proposedHoldExpiry(createdAt: Date) {
  if (!Number.isFinite(createdAt.getTime())) throw new Error("Invalid creation date");
  return new Date(createdAt.getTime() + developmentCheckoutProposal.holdHours * 60 * 60 * 1000);
}

export function hashIdempotencyKey(key: string) {
  z.string().min(16).max(256).parse(key);
  return createHash("sha256").update(key, "utf8").digest("hex");
}

// Only accepts JSON-compatible values; object-key order never changes the digest.
// Array order IS significant; future callers must sort cart lines by variantId first.
export function fingerprint(value: unknown): string {
  function canonical(input: unknown): string {
    if (input === null || typeof input === "string" || typeof input === "boolean") return JSON.stringify(input);
    if (typeof input === "number" && Number.isFinite(input)) return JSON.stringify(input);
    if (Array.isArray(input)) return `[${input.map(canonical).join(",")}]`;
    if (typeof input === "object" && input !== null && Object.getPrototypeOf(input) === Object.prototype)
      return `{${Object.keys(input).sort().map(key => `${JSON.stringify(key)}:${canonical((input as Record<string, unknown>)[key])}`).join(",")}}`;
    throw new Error("Fingerprint requires canonical JSON data");
  }
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export const checkoutAttemptSchema = z.object({
  ownerHash: digestSchema, keyHash: digestSchema,
  requestFingerprint: digestSchema, quoteFingerprint: digestSchema,
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED"]),
  orderId: text.nullable(), createdAt: z.date(), expiresAt: z.date(), completedAt: z.date().nullable(),
}).strict().superRefine((row, ctx) => {
  if (row.expiresAt <= row.createdAt || (row.status === "COMPLETED"
    ? !row.orderId || !row.completedAt || row.completedAt < row.createdAt
    : row.orderId !== null || row.completedAt !== null))
    ctx.addIssue({ code: "custom", message: "Invalid checkout attempt state" });
});
type Attempt = z.infer<typeof checkoutAttemptSchema>;

export function inspectRetry(existing: Attempt, request: Pick<Attempt, "ownerHash" | "keyHash" | "requestFingerprint" | "quoteFingerprint">, now: Date) {
  checkoutAttemptSchema.parse(existing);
  digestSchema.parse(request.ownerHash); digestSchema.parse(request.keyHash);
  digestSchema.parse(request.requestFingerprint); digestSchema.parse(request.quoteFingerprint);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid retry date");
  if (existing.ownerHash !== request.ownerHash || existing.keyHash !== request.keyHash) throw new Error("Checkout owner/key mismatch");
  if (existing.requestFingerprint !== request.requestFingerprint || existing.quoteFingerprint !== request.quoteFingerprint) throw new Error("Idempotency payload conflict");
  // A committed result remains replayable even after the quote/attempt deadline.
  if (existing.status === "COMPLETED") return { outcome: "replay", orderId: existing.orderId! } as const;
  if (existing.status === "FAILED") return { outcome: "failed" } as const;
  if (existing.status === "EXPIRED" || existing.expiresAt <= now) return { outcome: "expired" } as const;
  return { outcome: "pending" } as const;
}

export function assertAttemptTransition(from: Attempt["status"], to: Attempt["status"]) {
  z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED"]).parse(from);
  z.enum(["COMPLETED", "FAILED", "EXPIRED"]).parse(to);
  if (from !== "PENDING") throw new Error("Terminal checkout attempt cannot transition");
}

export const reservationSchema = z.object({
  id: text, orderItemId: text, inventoryId: text, quantity: positiveQuantity,
  status: z.enum(["HELD", "RELEASED", "CONSUMED"]),
  createdAt: z.date(), expiresAt: z.date(), releasedAt: z.date().nullable(), consumedAt: z.date().nullable(),
}).strict().superRefine((row, ctx) => {
  const valid = row.status === "HELD" ? row.releasedAt === null && row.consumedAt === null
    : row.status === "RELEASED" ? row.releasedAt !== null && row.releasedAt >= row.createdAt && row.consumedAt === null
      : row.consumedAt !== null && row.consumedAt >= row.createdAt && row.releasedAt === null;
  if (!valid || row.expiresAt <= row.createdAt) ctx.addIssue({ code: "custom", message: "Invalid reservation state" });
});

// Pure plan, NOT a writer. The future transaction must apply conditional HELD->terminal
// and inventory deltas together, and only when exactly one HELD row was changed.
export function planReservationTransition(raw: unknown, target: "RELEASED" | "CONSUMED", now: Date) {
  const row = reservationSchema.parse(raw);
  z.enum(["RELEASED", "CONSUMED"]).parse(target);
  if (!Number.isFinite(now.getTime()) || now < row.createdAt) throw new Error("Invalid transition date");
  if (row.status === target) return { apply: false, quantityDelta: 0, reservedDelta: 0 } as const;
  if (row.status !== "HELD") throw new Error("Reservation already finalized differently");
  return {
    apply: true,
    inventoryId: row.inventoryId,
    where: { id: row.id, status: "HELD" as const },
    data: { status: target, releasedAt: target === "RELEASED" ? now : null, consumedAt: target === "CONSUMED" ? now : null },
    quantityDelta: target === "CONSUMED" ? -row.quantity : 0, reservedDelta: -row.quantity,
  } as const;
}
