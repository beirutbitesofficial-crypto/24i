import { Prisma } from "@prisma/client";
import { db } from "./db";

// Runs a serializable transaction and retries on write conflicts / unique-constraint races,
// so concurrent requests (e.g. two uploads computing the next version number) cannot collide.
export async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
      if (!retryable || i >= attempts) throw error;
    }
  }
}
