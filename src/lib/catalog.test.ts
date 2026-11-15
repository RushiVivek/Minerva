import { describe, expect, it } from "vitest";

import { collectionsWithBooks, isUuid } from "./catalog";

describe("catalog helpers", () => {
  it("keeps folders that only hold sub-folders with books", () => {
    const all = [
      { id: "series", parentId: null },
      { id: "volume", parentId: "series" },
      { id: "empty", parentId: null },
      { id: "empty-child", parentId: "empty" },
    ];
    expect(collectionsWithBooks(all, ["volume"]).map((item) => item.id)).toEqual([
      "series",
      "volume",
    ]);
  });

  it("survives a parent cycle", () => {
    const all = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(collectionsWithBooks(all, ["a"])).toHaveLength(2);
  });

  it("recognises uuid route params", () => {
    expect(isUuid("41f8238d-0066-434f-a7b1-83418b6b2a3b")).toBe(true);
    expect(isUuid("foo")).toBe(false);
  });
});
