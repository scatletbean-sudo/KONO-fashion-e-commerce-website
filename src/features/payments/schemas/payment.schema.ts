import { z } from "zod";

const paymentMethods = [
  "COD",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "MOMO",
  "VNPAY",
  "ZALOPAY",
  "STRIPE",
] as const;

const paymentStatuses = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(paymentStatuses).optional(),
  method: z.enum(paymentMethods).optional(),
  search: z.string().trim().max(255).optional(),
});

export const updatePaymentStatusSchema = z.object({
  status: z.enum(paymentStatuses),
  transactionId: z.string().trim().max(255).optional(),
  providerPaymentId: z.string().trim().max(255).optional(),
});

export type PaymentListQuery = z.infer<
  typeof paymentListQuerySchema
>;

export type UpdatePaymentStatusInput = z.infer<
  typeof updatePaymentStatusSchema
>;