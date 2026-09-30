import { prisma } from "@/lib/db/prisma";

import {
  orderRepository,
  type OrderListParams,
} from "@/features/orders/repositories/order.repository";

import {
  orderStatusHistoryRepository,
} from "@/features/orders/repositories/order-status-history.repository";

import type {
  UpdateOrderStatusInput,
} from "@/features/orders/schemas/order.schema";

export const orderService = {
  async getOrders(params: OrderListParams = {}) {
    return orderRepository.findMany(params);
  },

  async getOrderById(id: string) {
    const order = await orderRepository.findById(id);

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  },

  async getOrderByNumber(orderNumber: string) {
    const order =
      await orderRepository.findByOrderNumber(orderNumber);

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  },

  async updateStatus(
    orderId: string,
    input: UpdateOrderStatusInput,
    changedById?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          shipment: true,
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status === input.status) {
        throw new Error(
          `Order is already ${input.status}`,
        );
      }

      const allowedTransitions: Record<
        string,
        string[]
      > = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PROCESSING", "CANCELLED"],
        PROCESSING: ["SHIPPED", "CANCELLED"],
        SHIPPED: ["DELIVERED"],
        DELIVERED: ["REFUNDED"],
        CANCELLED: [],
        REFUNDED: [],
      };

      const allowed =
        allowedTransitions[order.status] ?? [];

      if (!allowed.includes(input.status)) {
        throw new Error(
          `Cannot change order status from ${order.status} to ${input.status}`,
        );
      }

      const updatedOrder = await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: input.status,
        },
      });

      if (
        input.status === "SHIPPED" ||
        input.status === "DELIVERED"
      ) {
        if (!order.shipment) {
          throw new Error(
            "Shipment not found for this order",
          );
        }

        await tx.shipment.update({
          where: {
            orderId,
          },
          data: {
            status: input.status,

            ...(input.carrier !== undefined
              ? {
                  carrier: input.carrier,
                }
              : {}),

            ...(input.trackingNumber !== undefined
              ? {
                  trackingNumber: input.trackingNumber,
                }
              : {}),

            ...(input.status === "SHIPPED"
              ? {
                  shippedAt: new Date(),
                }
              : {}),

            ...(input.status === "DELIVERED"
              ? {
                  deliveredAt: new Date(),
                }
              : {}),
          },
        });
      }

      await orderStatusHistoryRepository.create(
        {
          order: {
            connect: {
              id: orderId,
            },
          },

          fromStatus: order.status,

          toStatus: input.status,

          note: input.note,

          ...(changedById
            ? {
                changedBy: {
                  connect: {
                    id: changedById,
                  },
                },
              }
            : {}),
        },
        tx,
      );

      return updatedOrder;
    });
  },
};