import type { CatalogBook, CatalogView } from "./catalog";

export function toOpdsPublication(book: CatalogBook, baseUrl: string) {
  return {
    metadata: {
      identifier: book.identifier ?? `urn:minerva:book:${book.id}`,
      title: book.title,
      subtitle: book.subtitle ?? undefined,
      language: [book.language],
      author: book.authors.map((name) => ({ name })),
      publisher: book.publisher ?? undefined,
      description: book.description ?? undefined,
    },
    images: book.coverCloudinaryPublicId
      ? [{ href: `${baseUrl}/api/books/${book.id}/cover`, type: "image/jpeg" }]
      : undefined,
    links: [
      {
        rel: "acquisition",
        href: `${baseUrl}/api/books/${book.id}/download`,
        type: "application/epub+zip",
      },
      {
        rel: "alternate",
        href: `${baseUrl}/books/${book.id}`,
        type: "text/html",
      },
    ],
  };
}

/**
 * Builds an OPDS 2.0 feed for one catalog page. `catalogPath` is the feed root,
 * e.g. `/api/opds/2.0/catalog`; folders live one segment below it.
 */
export function toOpdsFeed(
  view: CatalogView,
  options: {
    baseUrl: string;
    catalogPath: string;
    title: string;
    query?: string;
    offset: number;
  },
) {
  const { baseUrl, catalogPath, title, query, offset } = options;
  const folderUrl = (slug: string) => `${baseUrl}${catalogPath}/${encodeURIComponent(slug)}`;
  const feedUrl = view.collection ? folderUrl(view.collection.slug) : `${baseUrl}${catalogPath}`;
  const pageUrl = (pageOffset: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (pageOffset > 0) params.set("offset", String(pageOffset));
    return params.size ? `${feedUrl}?${params}` : feedUrl;
  };

  return {
    metadata: {
      title: view.collection ? `${title} · ${view.collection.name}` : title,
      numberOfItems: view.books.length,
    },
    links: [
      { rel: "self", href: pageUrl(offset), type: "application/opds+json" },
      { rel: "search", href: `${feedUrl}{?q}`, type: "application/opds+json", templated: true },
      ...(view.hasMore
        ? [{ rel: "next", href: pageUrl(offset + view.books.length), type: "application/opds+json" }]
        : []),
    ],
    navigation: view.folders.map((folder) => ({
      title: folder.name,
      subtitle: folder.description ?? undefined,
      links: [{ rel: "subsection", href: folderUrl(folder.slug), type: "application/opds+json" }],
    })),
    publications: view.books.map((book) => toOpdsPublication(book, baseUrl)),
  };
}

/**
 * The origin clients used to reach us. Behind a proxy such as Render's,
 * `request.url` names the internal server (e.g. https://localhost:10000), so
 * catalog links are built from the forwarded host and protocol instead.
 */
export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const first = (name: string) => request.headers.get(name)?.split(",")[0].trim();
  const host = first("x-forwarded-host") || first("host") || url.host;
  const protocol = first("x-forwarded-proto") || url.protocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}

export function opdsRequestParams(url: URL) {
  const offset = Number(url.searchParams.get("offset"));
  return {
    query: url.searchParams.get("q")?.trim() || undefined,
    offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
  };
}
