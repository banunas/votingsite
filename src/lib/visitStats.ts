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
