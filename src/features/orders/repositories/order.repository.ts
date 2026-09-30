import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const orderInclude = {
  payment: true,
  shipment: true,
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderListParams = {
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "orderNumber" | "totalAmount";
  sortOrder?: "asc" | "desc";
  status?: Prisma.OrderWhereInput["status"];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const orderRepository = {
  async findMany(params: OrderListParams = {}) {
    const page = Math.max(params.page ?? 1, 1);

    const pageSize = Math.min(
      Math.max(params.pageSize ?? 20, 1),
      100,
    );

    const sortBy = params.sortBy ?? "createdAt";
    const sortOrder = params.sortOrder ?? "desc";

    const dateFrom = params.dateFrom
      ? new Date(`${params.dateFrom}T00:00:00+07:00`)
      : undefined;

    const dateToExclusive = params.dateTo
      ? new Date(`${params.dateTo}T00:00:00+07:00`)
      : undefined;

    if (dateToExclusive) {
      dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1);
    }

    const where: Prisma.OrderWhereInput = {
      ...(params.status
        ? {
            status: params.status,
          }
        : {}),

      ...(params.search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: params.search,
                  mode: "insensitive",
                },
              },
              {
                customerName: {
                  contains: params.search,
                  mode: "insensitive",
                },
              },
              {
                customerEmail: {
                  contains: params.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),

      ...(dateFrom || dateToExclusive
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateToExclusive ? { lt: dateToExclusive } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.OrderOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.order.count({
        where,
      }),
    ]);

    return {
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
        payment: true,
        shipment: true,
        couponUsages: true,
        user: true,
        address: true,
        statusHistory: {
          include: {
           changedBy: {
             select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              },
             },
           },
        orderBy: {
      createdAt: "asc",    
      },
    },
      },
    });
  },

  async findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
        payment: true,
        shipment: true,
        couponUsages: true,
        user: true,
        address: true,
      },
    });
  },
};