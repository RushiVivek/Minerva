import { describe, expect, it } from "vitest";

import { publicOrigin, toOpdsFeed } from "./opds";

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

describe("toOpdsFeed", () => {
  it("lists sub-folders as OPDS 2.0 navigation Link Objects", () => {
    const feed = toOpdsFeed(
      {
        collection: null,
        ancestors: [],
        folders: [{ id: "c1", name: "Fan Fiction", slug: "fan-fiction", description: null, parentId: null }],
        books: [],
        hasMore: false,
      },
      { baseUrl: "https://books.example.com", catalogPath: "/api/opds/2.0/catalog", title: "Minerva", offset: 0 },
    );
    expect(feed.navigation).toEqual([
      {
        rel: "subsection",
        href: "https://books.example.com/api/opds/2.0/catalog/fan-fiction",
        type: "application/opds+json",
        title: "Fan Fiction",
      },
    ]);
  });
});
