import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { DateRange } from "@/lib/admin/query/date-range.schema";

const EXCLUDED_ORDER_STATUSES = [
  "CANCELLED",
  "REFUNDED",
] as const;

function getOrderDateFilter(dateRange: DateRange = {}) {
  const dateFrom = dateRange.dateFrom
    ? new Date(`${dateRange.dateFrom}T00:00:00+07:00`)
    : undefined;

  const dateToExclusive = dateRange.dateTo
    ? new Date(`${dateRange.dateTo}T00:00:00+07:00`)
    : undefined;

  if (dateToExclusive) {
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1);
  }

  if (!dateFrom && !dateToExclusive) {
    return {};
  }

  return {
    createdAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateToExclusive ? { lt: dateToExclusive } : {}),
    },
  };
}

export const dashboardRepository = {
  async getSummary(dateRange: DateRange = {}) {
    const orderDateFilter = getOrderDateFilter(dateRange);

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
          ...orderDateFilter,
          status: {
            notIn: [...EXCLUDED_ORDER_STATUSES],
          },
        },
      }),

      prisma.user.count({
        where: {
          role: "CUSTOMER",
          ...(dateRange.dateFrom || dateRange.dateTo
            ? getOrderDateFilter(dateRange)
            : {}),
        },
      }),

      prisma.orderItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          order: {
            ...orderDateFilter,
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
          ...(dateRange.dateFrom || dateRange.dateTo
            ? getOrderDateFilter(dateRange)
            : {}),
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

  async getAov(dateRange: DateRange = {}) {
    const orderDateFilter = getOrderDateFilter(dateRange);

    const [revenue, paidOrdersCount] = await Promise.all([
      prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "PAID",
          ...orderDateFilter,
        },
      }),

      prisma.payment.count({
        where: {
          status: "PAID",
          ...orderDateFilter,
        },
      }),
    ]);

    const totalRevenue = revenue._sum.amount ?? 0;

    return paidOrdersCount > 0
      ? Math.round(totalRevenue / paidOrdersCount)
      : 0;
  },

  async getTopProducts(
    limit = 5,
    dateRange: DateRange = {},
  ) {
    const orderDateFilter = getOrderDateFilter(dateRange);

    const grouped = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      where: {
        order: {
          ...orderDateFilter,
          status: {
            notIn: [...EXCLUDED_ORDER_STATUSES],
          },
        },
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: limit,
    });

    if (grouped.length === 0) {
      return [];
    }

    const productIds = grouped.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    return grouped.map((item) => {
      const product = productMap.get(item.productId);

      return {
        productId: item.productId,
        name: product?.name ?? "Unknown Product",
        slug: product?.slug ?? null,
        status: product?.status ?? null,
        quantitySold: item._sum.quantity ?? 0,
        revenue: item._sum.totalPrice ?? 0,
      };
    });
  },

  async getRecentOrders(
    limit = 5,
    dateRange: DateRange = {},
  ) {
    const orderDateFilter = getOrderDateFilter(dateRange);

    return prisma.order.findMany({
      where: orderDateFilter,

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
      },
    });
  },

  async getLowStock(limit = 10) {
    const rows = await prisma.$queryRaw<
      Array<{
        inventoryId: string;
        variantId: string;
        sku: string;
        productId: string;
        productName: string;
        quantity: number;
        lowStockAt: number;
      }>
    >`
      SELECT
        i.id AS "inventoryId",
        pv.id AS "variantId",
        pv.sku AS sku,
        p.id AS "productId",
        p.name AS "productName",
        i.quantity AS quantity,
        i."lowStockAt" AS "lowStockAt"
      FROM "Inventory" i
      INNER JOIN "ProductVariant" pv
        ON pv.id = i."variantId"
      INNER JOIN "Product" p
        ON p.id = pv."productId"
      WHERE i.quantity > 0
        AND i.quantity <= i."lowStockAt"
      ORDER BY i.quantity ASC, p.name ASC
      LIMIT ${limit}
    `;

    return rows;
  },
};