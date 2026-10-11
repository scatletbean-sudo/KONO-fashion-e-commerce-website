import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => db ?? prisma;

export const paymentRepository = {
  async findByPaymentCode(paymentCode: string, db: DbClient) {
    return db.payment.findUnique({ where: { paymentCode }, include: { order: true } });
  },

  async markPaidIfPending(id: string, eventId: string, transactionId: string | null, db: DbClient) {
    return db.payment.updateMany({
      where: { id, status: "PENDING", method: "BANK_TRANSFER" },
      data: { status: "PAID", providerPaymentId: eventId, transactionId, paidAt: new Date() },
    });
  },
  async findById(id: string, db?: DbClient) {
    return getDb(db).payment.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });
  },

  async findByOrderId(orderId: string, db?: DbClient) {
    return getDb(db).payment.findUnique({
      where: { orderId },
      include: {
        order: true,
      },
    });
  },

  async findByTransactionId(
    transactionId: string,
    db?: DbClient,
  ) {
    return getDb(db).payment.findFirst({
      where: { transactionId },
      include: {
        order: true,
      },
    });
  },

  async findByProviderPaymentId(
    providerPaymentId: string,
    db?: DbClient,
  ) {
    return getDb(db).payment.findFirst({
      where: { providerPaymentId },
      include: {
        order: true,
      },
    });
  },

  async create(
    data: Prisma.PaymentCreateInput,
    db?: DbClient,
  ) {
    return getDb(db).payment.create({
      data,
      include: {
        order: true,
      },
    });
  },

  async update(
    id: string,
    data: Prisma.PaymentUpdateInput,
    db?: DbClient,
  ) {
    return getDb(db).payment.update({
      where: { id },
      data,
      include: {
        order: true,
      },
    });
  },
};
