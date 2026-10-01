import { prisma } from "@/lib/db/prisma";

import {
  paymentRepository,
} from "@/features/payments/repositories/payment.repository";

import type {
  UpdatePaymentStatusInput,
} from "@/features/payments/schemas/payment.schema";

export const paymentService = {
  async getPaymentById(id: string) {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      throw new Error("Payment not found");
    }

    return payment;
  },

  async getPaymentByOrderId(orderId: string) {
    const payment =
      await paymentRepository.findByOrderId(orderId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    return payment;
  },

  async updateStatus(
    paymentId: string,
    input: UpdatePaymentStatusInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === input.status) {
        throw new Error(
          `Payment is already ${input.status}`,
        );
      }

      const allowedTransitions: Record<string, string[]> = {
        PENDING: [
          "AUTHORIZED",
          "PAID",
          "FAILED",
        ],

        AUTHORIZED: [
          "PAID",
          "FAILED",
        ],

        PAID: [
          "REFUNDED",
          "PARTIALLY_REFUNDED",
        ],

        FAILED: [
          "PENDING",
        ],

        PARTIALLY_REFUNDED: [
          "REFUNDED",
        ],

        REFUNDED: [],
      };

      const allowed =
        allowedTransitions[payment.status] ?? [];

      if (!allowed.includes(input.status)) {
        throw new Error(
          `Cannot change payment status from ${payment.status} to ${input.status}`,
        );
      }

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: input.status,

          ...(input.transactionId !== undefined
            ? {
                transactionId:
                  input.transactionId,
              }
            : {}),

          ...(input.providerPaymentId !== undefined
            ? {
                providerPaymentId:
                  input.providerPaymentId,
              }
            : {}),

          ...(input.status === "PAID"
            ? {
                paidAt: new Date(),
              }
            : {}),
        },
        include: {
          order: true,
        },
      });
    });
  },
};