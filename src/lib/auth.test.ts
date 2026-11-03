import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword, verifyBearerToken, hashToken } from "./auth";

describe("authentication primitives", () => {
  it("verifies generated password hashes", () => {
    const encoded = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", encoded)).toBe(true);
    expect(verifyPassword("wrong password", encoded)).toBe(false);
  });

  it("verifies bearer tokens against their hash", () => {
    expect(
      verifyBearerToken(`Bearer secret-token`, hashToken("secret-token")),
    ).toBe(true);
    expect(verifyBearerToken("Bearer other-token", hashToken("secret-token"))).toBe(
      false,
    );
  });
});
