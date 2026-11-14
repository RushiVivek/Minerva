import type { CatalogBook } from "./catalog";

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
