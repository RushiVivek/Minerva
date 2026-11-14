"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LibraryShell } from "@/components/LibraryShell";

type Publication = {
  metadata: {
    identifier: string;
    title: string;
    author?: { name: string }[];
  };
  images?: { href: string; type?: string }[];
  links?: { rel: string; href: string }[];
};
type Navigation = { title: string; subtitle?: string; links?: { href: string }[] };

function browserFolderUrl(apiUrl: string) {
  const marker = "/api/opds/2.0/catalog/";
  const index = apiUrl.indexOf(marker);
  return index >= 0 ? `/browse/${apiUrl.slice(index + marker.length)}` : apiUrl;
}

export function BrowseCatalog({
  endpoint,
  title,
  root = false,
}: {
  endpoint: string;
  title: string;
  root?: boolean;
}) {
  const [books, setBooks] = useState<Publication[]>([]);
  const [folders, setFolders] = useState<Navigation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`${endpoint}${query ? `?q=${encodeURIComponent(query)}` : ""}`)
        .then((response) => response.json())
        .then((data) => {
          setBooks(data.publications ?? []);
          setFolders(data.navigation ?? []);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [endpoint, query]);

  const subtitle = useMemo(
    () => (query ? `${books.length} results for “${query}”` : `${books.length} books here`),
    [books.length, query],
  );

  return (
    <LibraryShell>
      <div className="topbar">
        <div>
          <div className="eyebrow">{root ? "Your collection" : "Folder"}</div>
          <h1>{title}</h1>
          <div className="muted">{subtitle}</div>
        </div>
        <Link className="button" href="/admin">Manage library</Link>
      </div>
      <div className="toolbar">
        <h2>{folders.length ? "Folders and books" : "Books"}</h2>
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author..." aria-label="Search books" />
      </div>
      {loading ? <div className="empty">Loading your library...</div> : (
        <>
          {folders.length > 0 && (
            <div className="folder-grid">
              {folders.map((folder) => {
                const apiUrl = folder.links?.[0]?.href ?? "";
                return <Link className="folder-card" href={browserFolderUrl(apiUrl)} key={folder.title}><span className="folder-icon">▰</span><strong>{folder.title}</strong><span className="muted">{folder.subtitle || "Folder"}</span></Link>;
              })}
            </div>
          )}
          {books.length > 0 ? (
            <div className="book-grid">
              {books.map((book) => {
                const author = book.metadata.author?.map((item) => item.name).join(", ");
                const download = book.links?.find((link) => link.rel === "acquisition")?.href;
                const details = book.links?.find((link) => link.rel === "alternate")?.href ?? download;
                const cover = book.images?.[0]?.href;
                return <article className="book-card" key={book.metadata.identifier}>
                  <Link className="cover" href={details ?? "#"} aria-label={`View ${book.metadata.title}`}>
                    {cover ? <Image src={cover} alt="" width={400} height={600} unoptimized /> : <span>{book.metadata.title}</span>}
                  </Link>
                  <div className="book-title" title={book.metadata.title}>{book.metadata.title}</div>
                  <div className="book-author">{author || "Unknown author"}</div>
                  <Link className="badge" href={details ?? "#"}>Open book</Link>
                </article>;
              })}
            </div>
          ) : folders.length === 0 ? <div className="empty">No books found. Upload your first EPUB from Manage library.</div> : null}
        </>
      )}
    </LibraryShell>
  );
}
