import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { md5, partialMd5 } from "./md5";

const reference = (bytes: Uint8Array) => createHash("md5").update(bytes).digest("hex");

describe("md5", () => {
  it("matches the reference digest across block boundaries", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    for (const length of [55, 56, 63, 64, 65, 119, 120, 1000]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 31 + 7) % 256);
      expect(md5(bytes)).toBe(reference(bytes));
    }
  });

  it("samples a file the way KOReader does", () => {
    const file = Uint8Array.from({ length: 70_000 }, (_, index) => (index * 13) % 251);
    const samples = [0, 1024, 4096, 16384, 65536].map((start) => file.subarray(start, start + 1024));
    expect(partialMd5(file)).toBe(reference(Buffer.concat(samples)));
    expect(partialMd5(file.subarray(0, 500))).toBe(reference(file.subarray(0, 500)));
  });
});
