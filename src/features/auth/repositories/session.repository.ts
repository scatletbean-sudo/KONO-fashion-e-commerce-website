import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => {
  return db ?? prisma;
};

export const sessionRepository = {
  async create(
    data: Prisma.SessionCreateInput,
    db?: DbClient,
  ) {
    return getDb(db).session.create({
      data,
    });
  },

  async findByTokenHash(
    tokenHash: string,
    db?: DbClient,
  ) {
    return getDb(db).session.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });
  },

  async revoke(
    id: string,
    db?: DbClient,
  ) {
    return getDb(db).session.update({
      where: {
        id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async revokeAllForUser(
    userId: string,
    db?: DbClient,
  ) {
    return getDb(db).session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async deleteExpired(
    before: Date,
    db?: DbClient,
  ) {
    return getDb(db).session.deleteMany({
      where: {
        expiresAt: {
          lt: before,
        },
      },
    });
  },
};