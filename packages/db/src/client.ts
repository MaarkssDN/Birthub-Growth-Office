import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/** Cliente Prisma único por processo. DATABASE_URL deve apontar para 127.0.0.1:5437. */
export function prisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.BGO_PRISMA_LOG === "1" ? ["warn", "error"] : ["error"],
    });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
