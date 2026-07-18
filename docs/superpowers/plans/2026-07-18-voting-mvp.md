# Voting MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single page listing 4 teammates' project links, letting visitors click through to each and cast an unlimited, anonymous vote for their favorite, with live results shown on the same page.

**Architecture:** Next.js App Router, one route (`/`). Server Component fetches vote tallies from Postgres via Prisma and renders 4 cards (link + vote button + result bar). A Server Action (`castVote`) inserts a vote row and revalidates the page. No auth, no vote-limiting — voting is intentionally unrestricted per product decision.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg` driver adapter — NOT the old `prisma-client-js` pattern), Tailwind v4, Vitest for unit tests.

## Global Constraints

- Prisma client is generated with `provider = "prisma-client"` to `../src/generated/prisma`. Import the client type from `@/generated/prisma/client`. Do NOT add `url`/`directUrl` fields to the `datasource` block in `prisma/schema.prisma` — Prisma 7 forbids this; connection URLs live only in `prisma.config.ts` (already configured) and the runtime adapter in `src/lib/prisma.ts` (already configured). Do not modify `prisma.config.ts` or `src/lib/prisma.ts`.
- The `Vote` model already exists and is migrated: `model Vote { id String @id @default(cuid()); site String; createdAt DateTime @default(now()) }` (see `prisma/schema.prisma`). Do not add fields to it or create new models — this plan needs nothing else.
- No authentication, no login, no per-user vote limit. Anyone can vote for any site any number of times. This is an explicit product decision, not a gap to fix.
- Import alias `@/*` maps to `src/*` (see `tsconfig.json`).
- Use Tailwind utility classes for all styling (project convention, already set up). No CSS modules, no styled-components.
- Test runner is Vitest (`npm test` runs `vitest run`). Test files live next to the source file they test, named `*.test.ts`.
- Both tasks must end with `npx tsc --noEmit` reporting zero errors.

---

### Task 1: Site config + vote-tally aggregation logic

**Files:**
- Create: `src/lib/sites.ts`
- Create: `src/lib/voteCounts.ts`
- Test: `src/lib/voteCounts.test.ts`

**Interfaces:**
- Consumes: nothing (pure logic layer, no DB, no React).
- Produces: `SITES: Site[]` from `src/lib/sites.ts` where `Site = { id: string; name: string; url: string }` — the single source of truth for the 4 teammate sites, in display order. `buildResults(tally: VoteTally[]): SiteResult[]` from `src/lib/voteCounts.ts` where `VoteTally = { site: string; count: number }` and `SiteResult = Site & { count: number }`. Task 2's page and server action import both of these exact names and shapes.

- [ ] **Step 1: Create the site config**

Create `src/lib/sites.ts`:

```ts
export type Site = {
  id: string;
  name: string;
  url: string;
};

export const SITES: Site[] = [
  { id: "callting", name: "callting", url: "https://callting.vercel.app" },
  { id: "site2", name: "팀원2 사이트 (링크 준비중)", url: "https://example.com" },
  { id: "site3", name: "팀원3 사이트 (링크 준비중)", url: "https://example.com" },
  { id: "site4", name: "팀원4 사이트 (링크 준비중)", url: "https://example.com" },
];
```

These are placeholder names/URLs for 3 of the 4 sites — real teammate links will be filled in later by editing this file directly. Leave them exactly as placeholders; do not invent real-looking URLs.

- [ ] **Step 2: Write the failing test for `buildResults`**

Create `src/lib/voteCounts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildResults } from "./voteCounts";
import { SITES } from "./sites";

describe("buildResults", () => {
  it("returns all sites with zero count when tally is empty", () => {
    const result = buildResults([]);
    expect(result).toHaveLength(SITES.length);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it("maps a tally count onto its matching site", () => {
    const result = buildResults([{ site: SITES[0].id, count: 5 }]);
    expect(result.find((r) => r.id === SITES[0].id)?.count).toBe(5);
  });

  it("ignores tally entries for unknown site ids", () => {
    const result = buildResults([{ site: "unknown-site", count: 3 }]);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it("always returns sites in SITES order, regardless of tally order", () => {
    const shuffledTally = [...SITES].reverse().map((s) => ({ site: s.id, count: 1 }));
    const result = buildResults(shuffledTally);
    expect(result.map((r) => r.id)).toEqual(SITES.map((s) => s.id));
  });

  it("includes id, name, and url alongside count for each site", () => {
    const result = buildResults([]);
    expect(result[0]).toEqual({ ...SITES[0], count: 0 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/voteCounts.test.ts`
Expected: FAIL — `voteCounts.ts` does not exist yet (module not found).

- [ ] **Step 4: Implement `buildResults`**

Create `src/lib/voteCounts.ts`:

```ts
import { SITES, type Site } from "./sites";

export type VoteTally = { site: string; count: number };
export type SiteResult = Site & { count: number };

export function buildResults(tally: VoteTally[]): SiteResult[] {
  const countBySite = new Map(tally.map((t) => [t.site, t.count]));

  return SITES.map((site) => ({
    ...site,
    count: countBySite.get(site.id) ?? 0,
  }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/voteCounts.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sites.ts src/lib/voteCounts.ts src/lib/voteCounts.test.ts
git commit -m "feat: add site config and vote-tally aggregation logic"
```

---

### Task 2: Vote page, server action, and vote button

**Files:**
- Create: `src/app/actions.ts`
- Create: `src/app/VoteButton.tsx`
- Modify: `src/app/page.tsx` (replace the entire create-next-app boilerplate content)

**Interfaces:**
- Consumes: `SITES` and `Site` from `@/lib/sites` (Task 1). `buildResults`, `VoteTally`, `SiteResult` from `@/lib/voteCounts` (Task 1). `prisma` client instance from `@/lib/prisma` (already set up — do not modify that file). Prisma's generated `Vote` model has fields `id`, `site`, `createdAt`.
- Produces: the `/` route, fully wired end to end. Nothing downstream consumes this task's exports — it's the top of the stack.

- [ ] **Step 1: Create the vote server action**

Create `src/app/actions.ts`:

```ts
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
```

- [ ] **Step 2: Create the vote button client component**

Create `src/app/VoteButton.tsx`:

```tsx
"use client";

import { useFormStatus } from "react-dom";
import { castVote } from "./actions";

function Button() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "투표 중..." : "투표하기"}
    </button>
  );
}

export default function VoteButton({ siteId }: { siteId: string }) {
  return (
    <form action={castVote.bind(null, siteId)}>
      <Button />
    </form>
  );
}
```

- [ ] **Step 3: Replace the home page**

Replace the full contents of `src/app/page.tsx` with:

```tsx
import { prisma } from "@/lib/prisma";
import { buildResults } from "@/lib/voteCounts";
import VoteButton from "./VoteButton";

export default async function Home() {
  const grouped = await prisma.vote.groupBy({
    by: ["site"],
    _count: { site: true },
  });
  const tally = grouped.map((g) => ({ site: g.site, count: g._count.site }));
  const results = buildResults(tally);
  const maxCount = Math.max(1, ...results.map((r) => r.count));

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">투표해주세요</h1>
      <p className="text-sm text-zinc-500">
        팀원 4명이 각자 만든 사이트예요. 링크로 들어가서 써보고, 제일
        좋았던 곳에 투표해주세요.
      </p>

      <ul className="flex flex-col gap-4">
        {results.map((site) => (
          <li
            key={site.id}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-indigo-600 underline underline-offset-2"
              >
                {site.name}
              </a>
              <VoteButton siteId={site.id} />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${(site.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-zinc-600">
                {site.count}표
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification (no DB unit test — this step exercises the real Postgres connection)**

Run: `npm run dev`, then in another terminal:

```bash
curl -s http://localhost:3000/ | grep -o 'callting</a>' # confirms the callting link renders
```

Then in a browser at `http://localhost:3000/`: confirm all 4 site cards render with their links, name, a "투표하기" button, and a 0-vote result bar. Click "투표하기" on one card — confirm the button shows "투표 중..." briefly, then the count for that card increments by 1 and the bar grows. Reload the page — confirm the incremented count persists (proves the vote was actually written to Postgres, not just client state).

Report the exact count observed before and after the click in your task report.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/app/VoteButton.tsx src/app/page.tsx
git commit -m "feat: add vote page with live results and vote action"
```
