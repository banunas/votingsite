import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITES } from "@/lib/sites";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : null;
  const site = typeof body?.site === "string" ? body.site : null;

  if (!visitorId || !site || !SITES.some((s) => s.id === site)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const visit = await prisma.siteVisit.create({
    data: { visitorId, site },
  });

  return NextResponse.json({ id: visit.id });
}
