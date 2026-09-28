import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient;

const getDb = (db?: DbClient) => {
  return db ?? prisma;
};

export const userRepository = {
  async findByEmail(
    email: string,
    db?: DbClient,
  ) {
    return getDb(db).user.findUnique({
      where: {
        email,
      },
    });
  },

  async findById(
    id: string,
    db?: DbClient,
  ) {
    return getDb(db).user.findUnique({
      where: {
        id,
      },
    });
  },
};