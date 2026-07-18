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
