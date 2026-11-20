import { describe, expect, it } from "vitest";

import { publicOrigin } from "./opds";

describe("publicOrigin", () => {
  it("uses the forwarded host and protocol behind a proxy", () => {
    const request = new Request("https://localhost:10000/api/opds/2.0/catalog", {
      headers: {
        host: "localhost:10000",
        "x-forwarded-host": "books.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicOrigin(request)).toBe("https://books.example.com");
  });

  it("falls back to the request URL without proxy headers", () => {
    expect(publicOrigin(new Request("http://localhost:3000/api/opds/2.0/catalog"))).toBe(
      "http://localhost:3000",
    );
  });
});
