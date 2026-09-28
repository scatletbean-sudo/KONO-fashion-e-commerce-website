import bcrypt from "bcryptjs";

import { userRepository } from "@/features/auth/repositories/user.repository";
import { sessionService } from "@/features/auth/services/session.service";
import type { LoginInput } from "@/features/auth/schemas/auth.schema";

const INVALID_CREDENTIALS = "Invalid email or password";

export const authService = {
  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);

    if (!user || !user.passwordHash) {
      throw new Error(INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new Error(INVALID_CREDENTIALS);
    }

    if (user.status !== "ACTIVE") {
      throw new Error("Account is not active");
    }

    const session = await sessionService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
      session,
    };
  },
};