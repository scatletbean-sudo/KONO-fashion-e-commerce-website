import { dashboardRepository } from "@/features/dashboard/repositories/dashboard.repository";

export const dashboardService = {
  async getSummary() {
    const summary = await dashboardRepository.getSummary();

    return {
      revenue: summary.revenue,
      ordersCount: summary.ordersCount,
      productsSold: summary.productsSold,
      customersCount: summary.customersCount,
      inventoryLowStock: summary.inventoryLowStock,
      inventoryOutOfStock: summary.inventoryOutOfStock,
    };
  },
};