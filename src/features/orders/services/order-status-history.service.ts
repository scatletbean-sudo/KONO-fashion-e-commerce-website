import {
  orderStatusHistoryRepository,
} from "@/features/orders/repositories/order-status-history.repository";

export const orderStatusHistoryService = {
  async getOrderHistory(orderId: string) {
    return orderStatusHistoryRepository.findByOrderId(orderId);
  },

  async getLatestOrderHistory(orderId: string) {
    return orderStatusHistoryRepository.findLatest(orderId);
  },
};