import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { LibraryShell } from "@/components/LibraryShell";
import { SearchBox } from "@/components/SearchBox";
import { browseCatalog, CATALOG_PAGE_SIZE } from "@/lib/catalog";

export type BrowseSearchParams = Promise<{ q?: string | string[]; show?: string | string[] }>;

export async function BrowseCatalog({
  slug,
  searchParams,
}: {
  slug?: string;
  searchParams: BrowseSearchParams;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const requested = Number(Array.isArray(params.show) ? params.show[0] : params.show);
  const show = Number.isInteger(requested)
    ? Math.min(Math.max(requested, CATALOG_PAGE_SIZE), 450)
    : CATALOG_PAGE_SIZE;

  const view = await browseCatalog({ includePrivate: false, slug, query, limit: show });
  if (!view) notFound();
  const { collection, ancestors, folders, books, hasMore } = view;
  const path = collection ? `/browse/${encodeURIComponent(collection.slug)}` : "/";
  const count = `${books.length}${hasMore ? "+" : ""} ${books.length === 1 && !hasMore ? "book" : "books"}`;
  const moreParams = new URLSearchParams({ ...(query ? { q: query } : {}), show: String(show + CATALOG_PAGE_SIZE) });

  return (
    <LibraryShell>
      <div className="topbar">
        <div>
          {collection ? (
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">Library</Link>
              {ancestors.map((folder) => (
                <span key={folder.id}>/ <Link href={`/browse/${encodeURIComponent(folder.slug)}`}>{folder.name}</Link></span>
              ))}
            </nav>
          ) : (
            <div className="eyebrow">Your collection</div>
          )}
          <h1>{collection ? collection.name : "Good books, close by."}</h1>
          <div className="muted">
            {query
              ? `${count} matching “${query}”${collection ? " in this folder" : ""}`
              : collection?.description || `${count}${folders.length ? ` · ${folders.length} ${folders.length === 1 ? "folder" : "folders"}` : ""}`}
          </div>
        </div>
        <SearchBox key={path} defaultValue={query} />
      </div>

      {folders.length > 0 && (
        <section aria-label="Folders" className="folder-grid">
          {folders.map((folder) => (
            <Link className="folder-card" href={`/browse/${encodeURIComponent(folder.slug)}`} key={folder.id}>
              <Icon name="folder" />
              <strong>{folder.name}</strong>
              <span className="muted">{folder.description || "Folder"}</span>
            </Link>
          ))}
        </section>
      )}

      {books.length > 0 ? (
        <section aria-label="Books" className="book-grid">
          {books.map((book) => (
            <Link className="book-card" href={`/books/${book.id}`} key={book.id}>
              <div className="cover">
                {book.coverCloudinaryPublicId ? (
                  <Image src={`/api/books/${book.id}/cover`} alt="" width={300} height={450} unoptimized />
                ) : (
                  <span aria-hidden="true">{book.title}</span>
                )}
              </div>
              <div className="book-title">{book.title}</div>
              <div className="book-author">{book.authors.join(", ") || "Unknown author"}</div>
            </Link>
          ))}
        </section>
      ) : folders.length === 0 ? (
        <div className="empty">
          {query ? `Nothing matches “${query}”.` : "No books here yet. Upload an EPUB from Manage."}
        </div>
      ) : null}

      {hasMore && (
        <div className="more">
          <Link className="button secondary" href={`${path}?${moreParams}`} scroll={false}>Show more</Link>
        </div>
      )}
    </LibraryShell>
  );
}
