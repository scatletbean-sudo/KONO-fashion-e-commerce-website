import { prisma } from "@/lib/db/prisma";

const EXCLUDED_ORDER_STATUSES = ["CANCELLED", "REFUNDED"] as const;

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
      prisma.order.count({
        where: {
          status: {
            notIn: [...EXCLUDED_ORDER_STATUSES],
          },
        },
      }),

      prisma.user.count({
        where: {
          role: "CUSTOMER",
        },
      }),

      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            status: {
              notIn: [...EXCLUDED_ORDER_STATUSES],
            },
          },
        },
      }),

      prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "PAID",
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
      revenue: revenue._sum.amount ?? 0,
      inventoryLowStock: Number(lowStockResult[0]?.count ?? 0),
      inventoryOutOfStock,
    };
  },
};