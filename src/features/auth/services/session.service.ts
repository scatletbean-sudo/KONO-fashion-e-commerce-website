import { createHash, randomBytes } from "node:crypto";

import { sessionRepository } from "@/features/auth/repositories/session.repository";

const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

const hashToken = (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};

export const sessionService = {
  async createSession(userId: string) {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(token);

    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_MS,
    );

    await sessionRepository.create({
      user: {
        connect: {
          id: userId,
        },
      },
      tokenHash,
      expiresAt,
    });

    return {
      token,
      expiresAt,
    };
  },

  async getSessionByToken(token: string) {
    const tokenHash = hashToken(token);

    const session = await sessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    if (session.revokedAt !== null) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      return null;
    }

    return session;
  },

  async revokeSession(sessionId: string) {
    return sessionRepository.revoke(sessionId);
  },

  async revokeAllUserSessions(userId: string) {
    return sessionRepository.revokeAllForUser(userId);
  },

  async deleteExpiredSessions() {
    return sessionRepository.deleteExpired(new Date());
  },
};