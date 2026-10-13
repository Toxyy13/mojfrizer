// Seeds the platform developer account (the seller of the product). Idempotent: safe on every deploy.
// The password comes only from SEED_DEVELOPER_PASSWORD, never from the repo.
import { hash } from "bcryptjs";
import { Role, type PrismaClient } from "@prisma/client";

export interface DeveloperSeedEnv {
  [key: string]: string | undefined;
  SEED_DEVELOPER_EMAIL?: string;
  SEED_DEVELOPER_PASSWORD?: string;
  SEED_DEVELOPER_NAME?: string;
}

export type DeveloperSeedResult = "skipped" | "created" | "promoted" | "unchanged";

type Db = Pick<PrismaClient, "user">;

export async function ensureDeveloper(db: Db, env: DeveloperSeedEnv): Promise<DeveloperSeedResult> {
  const email = env.SEED_DEVELOPER_EMAIL?.trim().toLowerCase();
  const password = env.SEED_DEVELOPER_PASSWORD;
  if (!email || !password) {
    console.log("Developer account not seeded (set SEED_DEVELOPER_EMAIL and SEED_DEVELOPER_PASSWORD).");
    return "skipped";
  }
  if (password.length < 8) throw new Error("SEED_DEVELOPER_PASSWORD must be at least 8 characters");

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing?.role === Role.DEVELOPER) return "unchanged";
  const passwordHash = await hash(password, 10);
  if (existing) {
    // An account that existed before gets the seeded password too, so nobody who registered this email first keeps access.
    await db.user.update({ where: { id: existing.id }, data: { role: Role.DEVELOPER, passwordHash, emailVerifiedAt: new Date() } });
    return "promoted";
  }
  await db.user.create({
    data: { email, name: env.SEED_DEVELOPER_NAME?.trim() || "Developer", passwordHash, role: Role.DEVELOPER, emailVerifiedAt: new Date() },
  });
  return "created";
}
