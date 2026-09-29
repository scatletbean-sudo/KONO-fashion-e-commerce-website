import { Prisma } from "@/generated/prisma/client";
import {
  orderRepository,
  type OrderListParams,
} from "@/features/orders/repositories/order.repository";

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
};