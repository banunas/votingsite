"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITES } from "@/lib/sites";

export async function castVote(siteId: string) {
  if (!SITES.some((s) => s.id === siteId)) {
    return;
  }

  await prisma.vote.create({ data: { site: siteId } });
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
