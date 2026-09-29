import { dashboardRepository } from "@/features/dashboard/repositories/dashboard.repository";
import type { DateRange } from "@/lib/admin/query/date-range.schema";

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

  async getOverview(dateRange: DateRange = {}) {
    const [summary, aov, topProducts, recentOrders, lowStock] =
      await Promise.all([
        dashboardRepository.getSummary(dateRange),
        dashboardRepository.getAov(dateRange),
        dashboardRepository.getTopProducts(5, dateRange),
        dashboardRepository.getRecentOrders(5, dateRange),
        dashboardRepository.getLowStock(10),
      ]);

    return {
      summary: {
        revenue: summary.revenue,
        ordersCount: summary.ordersCount,
        productsSold: summary.productsSold,
        customersCount: summary.customersCount,
        inventoryLowStock: summary.inventoryLowStock,
        inventoryOutOfStock: summary.inventoryOutOfStock,
      },

      aov,

      topProducts,

      recentOrders,

      lowStock,
    };
  },
};