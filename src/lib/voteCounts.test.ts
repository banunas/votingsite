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
