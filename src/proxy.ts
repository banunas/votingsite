import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return new Response("Admin dashboard is not configured", {
      status: 500,
    });
  }

  const expected = `Basic ${Buffer.from(`admin:${adminPassword}`).toString("base64")}`;
  const auth = request.headers.get("authorization");

  if (auth !== expected) {
    return new Response("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
