import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const dwellMs =
    typeof body?.dwellMs === "number" ? Math.round(body.dwellMs) : null;

  if (dwellMs === null || dwellMs < 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await prisma.siteVisit.updateMany({
    where: { id, dwellMs: null },
    data: { dwellMs },
  });

  return NextResponse.json({ updated: result.count });
}
