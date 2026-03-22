import { describe, expect, it } from "vitest";
import { moveSessionInOrder, reindexSessions, sortSessionsByOrder } from "../src/sessionOrdering";

describe("session ordering", () => {
  it("falls back to updatedAt descending when no manual order exists", () => {
    const sorted = sortSessionsByOrder([
      { id: "older", updatedAt: 10 },
      { id: "newer", updatedAt: 20 },
    ]);

    expect(sorted.map((session) => session.id)).toEqual(["newer", "older"]);
  });

  it("moves a dragged session after a target session", () => {
    const moved = moveSessionInOrder(
      [
        { id: "a" },
        { id: "b" },
        { id: "c" },
      ],
      "a",
      "c",
      "after"
    );

    expect(moved.map((session) => session.id)).toEqual(["b", "c", "a"]);
  });

  it("reindexes sessions into a stable sequential manual order", () => {
    const reindexed = reindexSessions([
      { id: "b", updatedAt: 2, sortIndex: 5 },
      { id: "a", updatedAt: 1, sortIndex: 3 },
    ]);

    expect(reindexed).toEqual([
      { id: "a", updatedAt: 1, sortIndex: 0 },
      { id: "b", updatedAt: 2, sortIndex: 1 },
    ]);
  });
});
