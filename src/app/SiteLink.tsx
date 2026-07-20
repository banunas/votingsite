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

type PendingVisit = {
  id: string | null;
  hiddenAt: number | null;
  dwellMs: number | null;
};

// Module-level so the one visibilitychange listener registered below sees
// the most recent tracked click regardless of which SiteLink instance
// triggered it (there are 4 on the page, one per site).
let pendingVisit: PendingVisit | null = null;

function sendPatchIfReady(visit: PendingVisit) {
  if (visit.id === null || visit.dwellMs === null) return;
  fetch(`/api/site-visits/${visit.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dwellMs: visit.dwellMs }),
  }).catch(() => {});
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!pendingVisit) return;

    if (document.hidden) {
      // The tab can hide before the click's POST resolves (opening the new
      // tab steals focus immediately; the POST needs a network round trip),
      // so this timestamp has to be captured here, synchronously, rather
      // than when the click handler eventually gets an id back.
      pendingVisit.hiddenAt = Date.now();
      return;
    }

    if (pendingVisit.hiddenAt === null) return;
    pendingVisit.dwellMs = Date.now() - pendingVisit.hiddenAt;
    const visit = pendingVisit;
    pendingVisit = null;
    // The id may not have arrived yet either (same race, other direction) —
    // sendPatchIfReady no-ops until both id and dwellMs are set, and
    // handleClick calls it again once its POST resolves.
    sendPatchIfReady(visit);
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
    const visit: PendingVisit = { id: null, hiddenAt: null, dwellMs: null };
    // Set synchronously, before the POST even starts, so a visibilitychange
    // firing before the network round trip completes still has something to
    // record the hide time onto.
    pendingVisit = visit;

    try {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId(), site }),
      });
      const data = await res.json();
      if (typeof data.id === "string") {
        visit.id = data.id;
        sendPatchIfReady(visit);
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
