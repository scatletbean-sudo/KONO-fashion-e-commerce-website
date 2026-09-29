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

  async getOverview() {
    const [summary, aov, topProducts, recentOrders, lowStock] =
      await Promise.all([
        dashboardRepository.getSummary(),
        dashboardRepository.getAov(),
        dashboardRepository.getTopProducts(5),
        dashboardRepository.getRecentOrders(5),
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