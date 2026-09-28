import { prisma } from "@/lib/db/prisma";

export const dashboardRepository = {
  async getSummary() {
    const [
      ordersCount,
      customersCount,
      productsSold,
      revenue,
      lowStockResult,
      inventoryOutOfStock,
    ] = await Promise.all([
      prisma.order.count(),

      prisma.user.count({
        where: {
          role: "CUSTOMER",
        },
      }),

      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
      }),

      prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
      }),

      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Inventory"
        WHERE quantity > 0
          AND quantity <= "lowStockAt"
      `,

      prisma.inventory.count({
        where: {
          quantity: 0,
        },
      }),
    ]);

    return {
      ordersCount,
      customersCount,
      productsSold: productsSold._sum.quantity ?? 0,
      revenue: revenue._sum.totalAmount ?? 0,
      inventoryLowStock: Number(lowStockResult[0]?.count ?? 0),
      inventoryOutOfStock,
    };
  },
};