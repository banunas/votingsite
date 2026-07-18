import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// @prisma/adapter-pg (unlike the query-engine-based connection) does not
// read the `schema=` query param out of the connection string on its own —
// it must be passed explicitly, or every query silently falls back to the
// "public" schema. This project's queries must stay isolated to the
// "voting" schema (a separate, unrelated app owns "public" on this same
// database), so a missing/wrong schema is a hard error, not a silent
// fallback.
const databaseUrl = process.env.DATABASE_URL as string;
const schema = new URL(databaseUrl).searchParams.get("schema");

if (schema !== "voting") {
  throw new Error(
    `DATABASE_URL must include schema=voting (got: ${schema ?? "none"})`,
  );
}

const adapter = new PrismaPg(databaseUrl, { schema });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
