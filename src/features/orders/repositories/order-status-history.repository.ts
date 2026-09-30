import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => db ?? prisma;

export const orderStatusHistoryRepository = {
  async create(
    data: Prisma.OrderStatusHistoryCreateInput,
    db?: DbClient,
  ) {
    return getDb(db).orderStatusHistory.create({
      data,
    });
  },

  async findByOrderId(
    orderId: string,
    db?: DbClient,
  ) {
    return getDb(db).orderStatusHistory.findMany({
      where: {
        orderId,
      },
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
    });
  },

  async findLatest(
    orderId: string,
    db?: DbClient,
  ) {
    return getDb(db).orderStatusHistory.findFirst({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },
};