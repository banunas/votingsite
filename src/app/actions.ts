"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITES } from "@/lib/sites";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

async function getIpHash(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function castVote(siteId: string) {
  if (!SITES.some((s) => s.id === siteId)) {
    return;
  }

  const ipHash = await getIpHash();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const recentAttempts = await prisma.voteAttempt.count({
    where: { ipHash, createdAt: { gte: windowStart } },
  });

  if (recentAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    // Silently drop the vote — same as an invalid siteId above, this
    // action has no error-display UI, and a bot doesn't need to be told
    // it was caught.
    return;
  }

  await prisma.voteAttempt.create({ data: { ipHash } });
  await prisma.vote.create({ data: { site: siteId } });

  // Nothing else prunes this table, so trim old rows here on every write
  // instead of needing a separate cron job.
  await prisma.voteAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
  });

  revalidatePath("/");
}

export async function postComment(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();

  if (!body || body.length > 200) {
    return;
  }

  await prisma.comment.create({ data: { body } });
  revalidatePath("/");
}
