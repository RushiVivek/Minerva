import { describe, expect, it } from "vitest";

import {
  hashKosyncCredential,
  validKosyncDocument,
  validKosyncUsername,
} from "./kosync";

describe("KOSync protocol helpers", () => {
  it("hashes the opaque client credential consistently", () => {
    expect(hashKosyncCredential("d41d8cd98f00b204e9800998ecf8427e")).toHaveLength(64);
    expect(hashKosyncCredential("same")).toBe(hashKosyncCredential("same"));
  });

  it("accepts protocol-safe account and document identifiers", () => {
    expect(validKosyncUsername("readest")).toBe(true);
    expect(validKosyncUsername("bad:name")).toBe(false);
    expect(validKosyncDocument("59d481d168cca6267322f150c5f6a2a3")).toBe(true);
    expect(validKosyncDocument("book-with-dash")).toBe(false);
  });
});
