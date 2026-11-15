import { describe, expect, it } from "vitest";

import { clientKey } from "./rate-limit";

describe("clientKey", () => {
  it("uses the first forwarded address and keeps scopes apart", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientKey(headers, "api")).toBe("api:203.0.113.7");
    expect(clientKey(headers, "kosync")).toBe("kosync:203.0.113.7");
    expect(clientKey(new Headers(), "api")).toBe("api:unknown");
  });
});
