import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => db ?? prisma;

export const paymentEventRepository = {
  async create(
    data: Prisma.PaymentEventCreateInput,
    db?: DbClient,
  ) {
    return getDb(db).paymentEvent.create({
      data,
    });
  },

  async findByProviderEventId(
    provider: string,
    eventId: string,
    db?: DbClient,
  ) {
    return getDb(db).paymentEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });
  },

  async findByTransactionId(
    transactionId: string,
    db?: DbClient,
  ) {
    return getDb(db).paymentEvent.findMany({
      where: {
        transactionId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },
};