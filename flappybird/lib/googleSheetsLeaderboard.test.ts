import { describe, expect, it } from "vitest";
import { entryKey, mergeByKey, normalizeName } from "@/lib/googleSheetsLeaderboard";

describe("googleSheetsLeaderboard", () => {
  it("normalizeName trims, collapses whitespace, and lowercases", () => {
    expect(normalizeName("  Alice   Bob  ")).toBe("alice bob");
  });

  it("entryKey prefers id, otherwise uses normalized name", () => {
    expect(entryKey({ id: "x" })).toBe("x");
    expect(entryKey({ name: "  A  " })).toBe("name:a");
  });

  it("mergeByKey keeps unique keys and prefers higher score", () => {
    const remote = [
      { id: "name:alice", name: "Alice", score: 10, createdAt: "2020-01-01T00:00:00.000Z" },
      { id: "name:bob", name: "Bob", score: 5, createdAt: "2020-01-01T00:00:00.000Z" },
    ];
    const local = [
      { id: "name:alice", name: "ALICE", score: 12, createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-02T00:00:00.000Z" },
      { id: "name:carol", name: "Carol", score: 7, createdAt: "2020-01-03T00:00:00.000Z" },
    ];

    const merged = mergeByKey(local as any, remote as any);
    const byId = Object.fromEntries(merged.map((e: any) => [e.id, e]));

    expect(Object.keys(byId).sort()).toEqual(["name:alice", "name:bob", "name:carol"].sort());
    expect(byId["name:alice"].score).toBe(12);
    expect(byId["name:bob"].score).toBe(5);
    expect(byId["name:carol"].score).toBe(7);
  });
});

