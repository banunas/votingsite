# Site Visit Tracking + Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track, per anonymous visitor, which of the 4 sites they clicked and an approximate dwell time for each, and show it on a password-protected `/admin` dashboard.

**Architecture:** A new `SiteVisit` row is created when a visitor clicks a site link (`target="_blank"`, so the voting tab never unloads); a single `visibilitychange` listener fills in `dwellMs` when the tab becomes visible again. Pure aggregation functions turn the raw rows into per-site stats, a visitor funnel, and a per-visitor table, rendered on `/admin`.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (`@prisma/adapter-pg`, `schema=voting`), Postgres, React 19, Tailwind, Vitest.

## Global Constraints

- Dwell time is an approximation (Page Visibility API on the voting tab), not a ground-truth measurement — this is intentional and already agreed with the user, not a bug to "fix" later.
- Visitor identity is anonymous: a `crypto.randomUUID()` in `localStorage`, no cookies, no accounts — matches the app's existing fully-anonymous Vote/Comment model.
- No new API endpoints beyond `POST /api/site-visits` and `PATCH /api/site-visits/[id]`.
- `PATCH` only fills `dwellMs` if it is currently `null` (use `updateMany` with `dwellMs: null` in the `where` clause — atomic, no read-then-write race).
- `/admin` is protected by HTTP Basic Auth gated on an `ADMIN_PASSWORD` env var, via `src/proxy.ts` (Next.js 16's `middleware.ts` replacement — auto-detected, no config wiring needed beyond the file itself and its `config.matcher`). This env var does not exist yet in this project and must be added to `.env` (local) and Vercel's env before the admin page works.
- Follow existing code style: no comments unless explaining non-obvious "why", Tailwind utility classes inline, pure logic separated into `src/lib/*.ts` with Vitest tests next to it (`*.test.ts`), matching `src/lib/voteCounts.ts` / `voteCounts.test.ts`.
- Admin page visual style uses this project's existing dark theme tokens (`bg-ink-2`, `text-lilac`, `text-hot-pink`, `text-acid`, `border-lilac/20`, etc. — see `src/app/globals.css`), not `callting`'s light rose theme.

---

### Task 1: Add `SiteVisit` model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_site_visit/migration.sql` (auto-generated)

**Interfaces:**
- Produces: `SiteVisit { id: String, visitorId: String, site: String, clickedAt: DateTime, dwellMs: Int | null }` (Prisma model), available on `prisma.siteVisit.*` from this point on.

- [ ] **Step 1: Edit the schema**

Add to `prisma/schema.prisma` (after the existing `Comment` model):

```prisma
model SiteVisit {
  id        String   @id @default(cuid())
  visitorId String
  site      String
  clickedAt DateTime @default(now())
  dwellMs   Int?
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_site_visit`

Expected output ends with something like:
```
Applying migration `<timestamp>_add_site_visit`
...
Your database is now in sync with your schema.
```

- [ ] **Step 3: Regenerate the Prisma Client explicitly**

The `migrate dev` output in this project has been observed to not always print a "Generated Prisma Client" line even though it should. Force it:

Run: `npx prisma generate`

Expected: `✔ Generated Prisma Client (7.8.0) to ./src/generated/prisma`

- [ ] **Step 4: Verify the generated migration SQL**

Run: `cat prisma/migrations/*_add_site_visit/migration.sql`

Expected content (matches the existing `Comment` migration's style):
```sql
-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dwellMs" INTEGER,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);
```

- [ ] **Step 5: Verify the generated Prisma Client picked up the model**

Run: `grep -n "class SiteVisit" src/generated/prisma/models/SiteVisit.ts`

Expected: at least one match (this file is gitignored — regenerated, not committed).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add SiteVisit model for visit/dwell-time tracking"
```

---

### Task 2: Pure aggregation functions (`src/lib/visitStats.ts`)

**Files:**
- Create: `src/lib/visitStats.ts`
- Create: `src/lib/visitStats.test.ts`

**Interfaces:**
- Consumes: `SITES` from `src/lib/sites.ts` (already exists).
- Produces (consumed by Task 5, the admin page):
  - `type VisitRecord = { visitorId: string; site: string; dwellMs: number | null }`
  - `buildSiteStats(visits: VisitRecord[]): SiteStat[]`
  - `type SiteStat = { id: string; name: string; clickCount: number; avgDwellMs: number | null; medianDwellMs: number | null; nullDwellCount: number }`
  - `buildVisitorFunnel(visits: VisitRecord[]): FunnelBucket[]`
  - `type FunnelBucket = { sitesVisited: number; visitorCount: number }`
  - `buildVisitorTable(visits: VisitRecord[]): VisitorRow[]`
  - `type VisitorRow = { visitorId: string; distinctSiteCount: number; dwellBySite: Record<string, number | null> }`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/visitStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildSiteStats,
  buildVisitorFunnel,
  buildVisitorTable,
  type VisitRecord,
} from "./visitStats";
import { SITES } from "./sites";

describe("buildSiteStats", () => {
  it("returns all sites with zero clicks when there are no visits", () => {
    const result = buildSiteStats([]);
    expect(result).toHaveLength(SITES.length);
    expect(result.every((r) => r.clickCount === 0)).toBe(true);
    expect(result.every((r) => r.avgDwellMs === null)).toBe(true);
  });

  it("counts clicks per site and averages known dwell times", () => {
    const site = SITES[0].id;
    const visits: VisitRecord[] = [
      { visitorId: "a", site, dwellMs: 1000 },
      { visitorId: "b", site, dwellMs: 3000 },
    ];
    const result = buildSiteStats(visits);
    const stat = result.find((r) => r.id === site);
    expect(stat?.clickCount).toBe(2);
    expect(stat?.avgDwellMs).toBe(2000);
    expect(stat?.medianDwellMs).toBe(2000);
    expect(stat?.nullDwellCount).toBe(0);
  });

  it("excludes null dwellMs from the average but counts it separately", () => {
    const site = SITES[0].id;
    const visits: VisitRecord[] = [
      { visitorId: "a", site, dwellMs: 1000 },
      { visitorId: "b", site, dwellMs: null },
    ];
    const result = buildSiteStats(visits);
    const stat = result.find((r) => r.id === site);
    expect(stat?.clickCount).toBe(2);
    expect(stat?.avgDwellMs).toBe(1000);
    expect(stat?.nullDwellCount).toBe(1);
  });

  it("computes the median correctly for an even number of values", () => {
    const site = SITES[0].id;
    const visits: VisitRecord[] = [
      { visitorId: "a", site, dwellMs: 1000 },
      { visitorId: "b", site, dwellMs: 2000 },
      { visitorId: "c", site, dwellMs: 3000 },
      { visitorId: "d", site, dwellMs: 4000 },
    ];
    const result = buildSiteStats(visits);
    expect(result.find((r) => r.id === site)?.medianDwellMs).toBe(2500);
  });
});

describe("buildVisitorFunnel", () => {
  it("buckets visitors by how many distinct sites they clicked", () => {
    const visits: VisitRecord[] = [
      { visitorId: "a", site: SITES[0].id, dwellMs: null },
      { visitorId: "a", site: SITES[1].id, dwellMs: null },
      { visitorId: "b", site: SITES[0].id, dwellMs: null },
    ];
    const result = buildVisitorFunnel(visits);
    expect(result.find((b) => b.sitesVisited === 2)?.visitorCount).toBe(1);
    expect(result.find((b) => b.sitesVisited === 1)?.visitorCount).toBe(1);
  });

  it("counts a visitor once even if they clicked the same site twice", () => {
    const visits: VisitRecord[] = [
      { visitorId: "a", site: SITES[0].id, dwellMs: null },
      { visitorId: "a", site: SITES[0].id, dwellMs: null },
    ];
    const result = buildVisitorFunnel(visits);
    expect(result.find((b) => b.sitesVisited === 1)?.visitorCount).toBe(1);
  });

  it("returns a bucket for every count from 1 to SITES.length", () => {
    const result = buildVisitorFunnel([]);
    expect(result.map((b) => b.sitesVisited)).toEqual(
      Array.from({ length: SITES.length }, (_, i) => i + 1),
    );
  });
});

describe("buildVisitorTable", () => {
  it("groups visits by visitorId and counts distinct sites", () => {
    const visits: VisitRecord[] = [
      { visitorId: "a", site: SITES[0].id, dwellMs: 1000 },
      { visitorId: "a", site: SITES[1].id, dwellMs: 2000 },
    ];
    const result = buildVisitorTable(visits);
    expect(result).toHaveLength(1);
    expect(result[0].visitorId).toBe("a");
    expect(result[0].distinctSiteCount).toBe(2);
    expect(result[0].dwellBySite[SITES[0].id]).toBe(1000);
    expect(result[0].dwellBySite[SITES[1].id]).toBe(2000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- visitStats`
Expected: FAIL with "Cannot find module './visitStats'" (or similar — the file doesn't exist yet)

- [ ] **Step 3: Implement `src/lib/visitStats.ts`**

```ts
import { SITES } from "./sites";

export type VisitRecord = {
  visitorId: string;
  site: string;
  dwellMs: number | null;
};

export type SiteStat = {
  id: string;
  name: string;
  clickCount: number;
  avgDwellMs: number | null;
  medianDwellMs: number | null;
  nullDwellCount: number;
};

function median(sortedValues: number[]): number | null {
  if (sortedValues.length === 0) return null;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return sortedValues[mid];
  return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

export function buildSiteStats(visits: VisitRecord[]): SiteStat[] {
  return SITES.map((site) => {
    const siteVisits = visits.filter((v) => v.site === site.id);
    const dwellValues = siteVisits
      .map((v) => v.dwellMs)
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);

    const avgDwellMs =
      dwellValues.length > 0
        ? dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length
        : null;

    return {
      id: site.id,
      name: site.name,
      clickCount: siteVisits.length,
      avgDwellMs,
      medianDwellMs: median(dwellValues),
      nullDwellCount: siteVisits.length - dwellValues.length,
    };
  });
}

export type FunnelBucket = { sitesVisited: number; visitorCount: number };

export function buildVisitorFunnel(visits: VisitRecord[]): FunnelBucket[] {
  const distinctSitesByVisitor = new Map<string, Set<string>>();
  for (const v of visits) {
    const set = distinctSitesByVisitor.get(v.visitorId) ?? new Set<string>();
    set.add(v.site);
    distinctSitesByVisitor.set(v.visitorId, set);
  }

  const counts = new Map<number, number>();
  for (const set of distinctSitesByVisitor.values()) {
    counts.set(set.size, (counts.get(set.size) ?? 0) + 1);
  }

  return Array.from({ length: SITES.length }, (_, i) => i + 1).map((n) => ({
    sitesVisited: n,
    visitorCount: counts.get(n) ?? 0,
  }));
}

export type VisitorRow = {
  visitorId: string;
  distinctSiteCount: number;
  dwellBySite: Record<string, number | null>;
};

export function buildVisitorTable(visits: VisitRecord[]): VisitorRow[] {
  const byVisitor = new Map<string, VisitRecord[]>();
  for (const v of visits) {
    const list = byVisitor.get(v.visitorId) ?? [];
    list.push(v);
    byVisitor.set(v.visitorId, list);
  }

  return Array.from(byVisitor.entries()).map(([visitorId, records]) => {
    const dwellBySite: Record<string, number | null> = {};
    const seenSites = new Set<string>();
    for (const r of records) {
      seenSites.add(r.site);
      if (r.dwellMs !== null || !(r.site in dwellBySite)) {
        dwellBySite[r.site] = r.dwellMs;
      }
    }
    return { visitorId, distinctSiteCount: seenSites.size, dwellBySite };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- visitStats`
Expected: all tests in `visitStats.test.ts` PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/visitStats.ts src/lib/visitStats.test.ts
git commit -m "Add pure aggregation functions for site visit stats"
```

---

### Task 3: API routes (`POST /api/site-visits`, `PATCH /api/site-visits/[id]`)

**Files:**
- Create: `src/app/api/site-visits/route.ts`
- Create: `src/app/api/site-visits/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma.siteVisit` (Task 1), `SITES` from `src/lib/sites.ts`.
- Produces:
  - `POST /api/site-visits` — body `{ visitorId: string, site: string }` → `200 { id: string }` or `400 { error: "invalid_request" }`.
  - `PATCH /api/site-visits/[id]` — body `{ dwellMs: number }` → `200 { updated: number }` or `400 { error: "invalid_request" }`. Consumed by Task 4.

- [ ] **Step 1: Create the POST route**

Create `src/app/api/site-visits/route.ts`:

```ts
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
```

- [ ] **Step 2: Create the PATCH route**

Create `src/app/api/site-visits/[id]/route.ts`:

```ts
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
```

- [ ] **Step 3: Verify — start the dev server**

Run: `npm run dev` (background) then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Expected: `200`

- [ ] **Step 4: Verify — POST creates a visit and rejects invalid input**

```bash
curl -s -X POST http://localhost:3000/api/site-visits \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-1","site":"callting"}'
```
Expected: `{"id":"<some cuid>"}` — record the returned id as `<visitId>`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/site-visits \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"test-visitor-1","site":"not-a-real-site"}'
```
Expected: `400`

- [ ] **Step 5: Verify — PATCH fills dwellMs once and refuses to overwrite**

```bash
curl -s -X PATCH http://localhost:3000/api/site-visits/<visitId> \
  -H "Content-Type: application/json" \
  -d '{"dwellMs":4200}'
```
Expected: `{"updated":1}`

```bash
curl -s -X PATCH http://localhost:3000/api/site-visits/<visitId> \
  -H "Content-Type: application/json" \
  -d '{"dwellMs":9999}'
```
Expected: `{"updated":0}` (already non-null, `updateMany`'s `where` excludes it)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/site-visits
git commit -m "Add site-visits API routes for click and dwell tracking"
```

---

### Task 4: `SiteLink` client component + wire into `page.tsx`

**Files:**
- Create: `src/app/SiteLink.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/site-visits`, `PATCH /api/site-visits/[id]` (Task 3).
- Produces: `SiteLink({ site, href, className, children }): JSX.Element`, replacing the plain `<a>` tag in `page.tsx`.

- [ ] **Step 1: Create `src/app/SiteLink.tsx`**

```tsx
"use client";

const VISITOR_ID_KEY = "voting-visitor-id";

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

// Module-level so the one visibilitychange listener registered below sees
// the most recent tracked click regardless of which SiteLink instance
// triggered it (there are 4 on the page, one per site).
let pendingVisit: { id: string; hiddenAt: number } | null = null;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (pendingVisit) pendingVisit.hiddenAt = Date.now();
      return;
    }
    if (!pendingVisit) return;
    const dwellMs = Date.now() - pendingVisit.hiddenAt;
    const id = pendingVisit.id;
    pendingVisit = null;
    fetch(`/api/site-visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dwellMs }),
    }).catch(() => {});
  });
}

export default function SiteLink({
  site,
  href,
  className,
  children,
}: {
  site: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  async function handleClick() {
    try {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId(), site }),
      });
      const data = await res.json();
      if (typeof data.id === "string") {
        pendingVisit = { id: data.id, hiddenAt: Date.now() };
      }
    } catch {
      // Best-effort tracking only — the link opens normally either way.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`**

In `src/app/page.tsx`, add the import at the top:

```tsx
import SiteLink from "./SiteLink";
```

Replace this block (inside the `ranked.map` loop):

```tsx
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`truncate font-bold underline decoration-2 underline-offset-4 ${style.text}`}
                  >
                    {site.name}
                  </a>
```

with:

```tsx
                  <SiteLink
                    site={site.id}
                    href={site.url}
                    className={`truncate font-bold underline decoration-2 underline-offset-4 ${style.text}`}
                  >
                    {site.name}
                  </SiteLink>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Verify — clicking a site link records a visit**

With the dev server running, use the `browse` gstack skill:

```bash
B=/Users/banu/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:3000/
$B snapshot -i
```

Find the `@e` ref for the first site's name link (it's a link, not a button — look for `[link] "callting"` or similar in the snapshot) and click it:

```bash
$B click @eN
```

Then confirm a row was created by hitting the admin data path directly through Prisma (there's no admin UI yet — Task 5 builds it). Instead, verify via a fresh POST/PATCH pair as in Task 3, or defer full end-to-end confirmation to Task 5's verification, which reads the table back through the admin page. For this task, confirm no console errors occurred and a new tab opened:

```bash
$B console --errors
$B tabs
```
Expected: no console errors, and a second tab now open at one of the `SITES` URLs.

- [ ] **Step 5: Verify — dwellMs gets filled in when the tab regains focus**

Real tab-switching autoplay-style focus changes can't be triggered by a second real tab reliably in this harness, so simulate `visibilitychange` directly:

```bash
$B tab 1
$B js "Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); 'hidden dispatched'"
```
Wait a moment, then:
```bash
$B js "Object.defineProperty(document, 'hidden', {value: false, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); 'visible dispatched'"
```

Then confirm the PATCH request succeeded:
```bash
$B network 2>/dev/null | grep "site-visits"
```
Expected: a `POST /api/site-visits` (from the click) and a `PATCH /api/site-visits/<id>` (from the visibilitychange) both showing `200`.

- [ ] **Step 6: Commit**

```bash
git add src/app/SiteLink.tsx src/app/page.tsx
git commit -m "Track site link clicks and approximate dwell time"
```

---

### Task 5: Admin page + Basic Auth

**Files:**
- Create: `src/proxy.ts`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `prisma.siteVisit` (Task 1), `buildSiteStats` / `buildVisitorFunnel` / `buildVisitorTable` from `src/lib/visitStats.ts` (Task 2).

- [ ] **Step 1: Create `src/proxy.ts`**

```ts
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
```

- [ ] **Step 2: Add `ADMIN_PASSWORD` to local env**

Append to `/Users/banu/dev/madcamp/week3/voting/.env` and `.env.example` (value in `.env.example` should be a placeholder, not a real secret):

`.env`:
```
ADMIN_PASSWORD=changeme-local-dev
```

`.env.example`:
```
ADMIN_PASSWORD=
```

- [ ] **Step 3: Create the admin page**

Create `src/app/admin/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import {
  buildSiteStats,
  buildVisitorFunnel,
  buildVisitorTable,
} from "@/lib/visitStats";

function formatDuration(ms: number): string {
  if (ms < 1000) return "1초 미만";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-lilac/20 bg-ink-2 p-5">
      <h2 className="mb-4 text-sm font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs font-medium text-lilac">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-hot-pink to-acid"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold text-foreground">
        {count}
      </span>
    </div>
  );
}

export default async function AdminDashboard() {
  const visits = await prisma.siteVisit.findMany({
    select: { visitorId: true, site: true, dwellMs: true },
  });

  const siteStats = buildSiteStats(visits);
  const funnel = buildVisitorFunnel(visits);
  const visitorTable = buildVisitorTable(visits)
    .sort((a, b) => b.distinctSiteCount - a.distinctSiteCount)
    .slice(0, 50);

  const funnelMax = Math.max(...funnel.map((f) => f.visitorCount), 1);
  const clickMax = Math.max(...siteStats.map((s) => s.clickCount), 1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          voting 방문 지표
        </h1>
        <p className="text-sm text-lilac">
          체류시간은 근사치예요 (탭이 안 보였다가 다시 보인 시간 기준)
        </p>
      </div>

      <ChartCard title="사이트별 클릭 수 / 체류시간">
        <div className="flex flex-col gap-4">
          {siteStats.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <BarRow label={s.name} count={s.clickCount} max={clickMax} />
              <p className="pl-[5.5rem] text-[11px] text-lilac/70">
                평균 {s.avgDwellMs !== null ? formatDuration(s.avgDwellMs) : "-"}
                {" · "}
                중앙값{" "}
                {s.medianDwellMs !== null
                  ? formatDuration(s.medianDwellMs)
                  : "-"}
                {s.nullDwellCount > 0 &&
                  ` · 미확인 ${s.nullDwellCount}건`}
              </p>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="방문자 퍼널 (몇 개 사이트를 클릭했는지)">
        <div className="flex flex-col gap-2">
          {funnel.map((f) => (
            <BarRow
              key={f.sitesVisited}
              label={`${f.sitesVisited}개`}
              count={f.visitorCount}
              max={funnelMax}
            />
          ))}
        </div>
      </ChartCard>

      <ChartCard title="방문자별 상세 (상위 50명)">
        {visitorTable.length === 0 ? (
          <p className="text-sm text-lilac/70">아직 방문 기록이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-lilac/70">
                  <th className="pb-2 pr-3 font-medium">방문자</th>
                  <th className="pb-2 pr-3 font-medium">방문 수</th>
                  <th className="pb-2 font-medium">사이트별 체류</th>
                </tr>
              </thead>
              <tbody>
                {visitorTable.map((v) => (
                  <tr key={v.visitorId} className="border-t border-lilac/10">
                    <td className="py-2 pr-3 font-mono text-foreground">
                      {v.visitorId.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-3 text-foreground">
                      {v.distinctSiteCount}/4
                    </td>
                    <td className="py-2 text-lilac">
                      {Object.entries(v.dwellBySite)
                        .map(
                          ([site, dwellMs]) =>
                            `${site}: ${dwellMs !== null ? formatDuration(dwellMs) : "-"}`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Verify — unauthenticated access is rejected**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin
```
Expected: `401`

- [ ] **Step 6: Verify — authenticated access renders the dashboard with real data**

```bash
curl -s -u admin:changeme-local-dev http://localhost:3000/admin | grep -o "voting 방문 지표"
```
Expected: `voting 방문 지표`

Using `browse` (with the same test click from Task 4 already having created data):

```bash
B=/Users/banu/.claude/skills/gstack/browse/dist/browse
$B header "Authorization:Basic $(echo -n admin:changeme-local-dev | base64)"
$B goto http://localhost:3000/admin
$B text
```
Expected: page text includes "방문자 퍼널" and "사이트별 클릭 수", with at least 1 click reflected in the numbers from Task 4's test click.

- [ ] **Step 7: Commit**

```bash
git add src/proxy.ts src/app/admin/page.tsx .env.example
git commit -m "Add password-protected admin dashboard for visit stats"
```

Note: `.env` itself should already be gitignored in this project (matching `callting`'s setup) — do not add it to this commit if `git status` shows it as untracked-but-ignored. Confirm with `git check-ignore -v .env` before committing; if it's not ignored, stop and flag this instead of committing a real secret.

---

## Post-implementation

After all 5 tasks are committed and verified, stop the local dev server (`pkill -f "next dev"`), confirm `npx tsc --noEmit` and `npm run lint` are both clean and `npm test` passes in full (not just the new file), then this feature is ready to deploy: push, run `prisma migrate deploy` against the shared DB if the schema hasn't already been applied there, set `ADMIN_PASSWORD` in Vercel's production env (this project has never had that var before), and `vercel --prod`.
