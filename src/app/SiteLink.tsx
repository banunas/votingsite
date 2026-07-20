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
