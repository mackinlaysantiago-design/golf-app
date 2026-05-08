import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function withTimeoutParams(url: string | undefined): string | undefined {
  if (!url) return url;
  if (!url.startsWith("postgres")) return url; // sqlite/file: dejarlo intacto
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "20");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return url;
  }
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const datasourceUrl = withTimeoutParams(process.env.DATABASE_URL);
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      ...(datasourceUrl ? { datasourceUrl } : {}),
    });
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const val = Reflect.get(client, prop);
    return typeof val === "function" ? val.bind(client) : val;
  },
});
