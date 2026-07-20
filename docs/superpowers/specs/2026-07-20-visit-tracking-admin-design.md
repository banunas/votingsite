# Site Visit Tracking + Admin Dashboard — Design

## Background

`voting` is a fully anonymous page (no login, no accounts) that lists 4
team-member sites (`src/lib/sites.ts`) and lets visitors vote for their
favorite (`Vote { id, site, createdAt }`) and leave anonymous feedback
(`Comment`). There is currently zero click or engagement tracking — the
site links are plain `<a href target="_blank">` tags.

The user wants an admin page showing, per visitor: how many of the 4 sites
they visited, and how long they stayed on each.

## Constraint that shapes this design

All 4 sites are on different domains. Only `callting` (in this same
`week3/` workspace) is ours to modify — `bbokbbok`, `odijjm`, and `omys`
belong to other teammates and are out of reach. That means **true dwell
time on the external site cannot be measured** — there is no way to embed
tracking on a page we don't control.

Since every link opens with `target="_blank"`, clicking a link does not
unload the voting page — it just opens a new tab alongside it. That gives
us a practical, honest proxy: **use the Page Visibility API on the voting
page itself** to measure how long the tab was hidden between a link click
and the user switching back to it. This is an approximation (the user
could switch to an unrelated tab instead, or never come back), not a
ground-truth measurement, but it's the standard technique for this kind of
cross-origin dwell-time estimation and was confirmed acceptable by the
user.

Approaches considered and ruled out:
- **Embed tracking scripts in the other 3 sites** — requires coordinating
  with teammates and modifying repos we don't own. Out of scope.
- **Load sites in an iframe on our own page instead of a new tab** —
  Vercel-deployed Next.js apps commonly send frame-blocking headers by
  default, so the other 3 sites would likely refuse to render in an
  iframe. Also a bigger UX change than the current "open in new tab"
  pattern. Not pursued.

## Design

### 1. Anonymous visitor identity

On first client render, generate `crypto.randomUUID()` and store it in
`localStorage` under a fixed key (e.g. `voting-visitor-id`). No cookies, no
server session — matches the app's existing fully-anonymous posture (votes
and comments already have no visitor identity at all).

### 2. Data model

New Prisma model in `prisma/schema.prisma`:

```prisma
model SiteVisit {
  id        String   @id @default(cuid())
  visitorId String
  site      String
  clickedAt DateTime @default(now())
  dwellMs   Int?
}
```

Ships as a new Prisma migration, following the existing migration history
in `prisma/migrations/`.

### 3. Tracking flow

- The 4 site links become a small client component (replacing the current
  plain `<a>` tags in `page.tsx`) that, on click:
  1. Lets the browser proceed with its default `target="_blank"` behavior
     (opens the site in a new tab; the voting tab is untouched).
  2. Fires `fetch("/api/site-visits", { method: "POST", body: { visitorId, site } })`,
     creating a `SiteVisit` row and returning its `id`.
- A single `document.visibilitychange` listener (module-level, one per page
  load) tracks the most recent click's `visitId` and the timestamp the tab
  went `hidden`. When the tab becomes `visible` again, it computes the
  elapsed time and `PATCH`es `/api/site-visits/[id]` with `dwellMs`.
- If the user clicks a second link before returning from the first, the
  first visit's `dwellMs` is left null (ambiguous case — no reliable
  signal which site they were on). This is a known, acceptable gap given
  the approximation nature of this metric.

### 4. API routes

- `POST /api/site-visits` — body `{ visitorId: string, site: string }`,
  validates `site` against `SITES` (from `src/lib/sites.ts`), creates a
  `SiteVisit`, returns `{ id }`.
- `PATCH /api/site-visits/[id]` — body `{ dwellMs: number }`, updates the
  row. Only fills `dwellMs` if it's currently null (avoid a stale/late
  visibilitychange event overwriting a more recent one — defensive, not
  expected to trigger often given one listener per page load).

### 5. Admin page (`/admin`)

Protected the same way as `callting`'s existing `/admin`: HTTP Basic Auth
via a `proxy.ts` matcher on `/admin/:path*`, gated by an `ADMIN_PASSWORD`
env var (to be added to `voting`'s `.env` / Vercel env — it doesn't exist
yet in this project).

Shows:
- **Per-site aggregate**: click count, average and median `dwellMs` (nulls
  excluded from the average/median, but the count of null-dwell clicks is
  shown too, since that number matters for reading the average honestly).
- **Visitor funnel**: distribution of "how many distinct sites did each
  visitor click" (1 of 4, 2 of 4, 3 of 4, 4 of 4).
- **Visitor table**: one row per distinct `visitorId`, showing a truncated
  id, number of distinct sites clicked, and per-site dwell time where
  available.

### 6. Testing / verification plan

This project has a real test setup (`vitest`, see `src/lib/voteCounts.test.ts`)
unlike `callting`. Pure aggregation logic (the funnel/per-site rollups) gets
unit tests following that existing pattern. The click → visibilitychange →
PATCH flow and the admin page rendering are verified manually via the
`browse` gstack skill (same technique used throughout this session):
1. Load the voting page, click a site link, confirm a `SiteVisit` row is
   created (via the admin page or a direct query).
2. Simulate the tab hiding/showing (`document.dispatchEvent` a
   `visibilitychange` after toggling `document.hidden` via
   `Object.defineProperty`, since a real second tab can't be scripted this
   way) and confirm `dwellMs` gets filled in.
3. Load `/admin` and confirm the aggregates match what was seeded.

## Rollout

Requires a DB migration (`prisma migrate deploy`) and setting
`ADMIN_PASSWORD` in both local `.env` and Vercel's production env before
the admin page is usable in production — it doesn't exist in this project
yet, unlike `callting`.
