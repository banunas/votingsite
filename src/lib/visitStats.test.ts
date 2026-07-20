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
