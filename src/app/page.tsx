"use client";

import { useEffect, useMemo, useState } from "react";

import { LibraryShell } from "@/components/LibraryShell";

type Publication = {
  metadata: {
    identifier: string;
    title: string;
    author?: { name: string }[];
    language?: string[];
    description?: string;
  };
  links?: { rel: string; href: string }[];
};

export default function HomePage() {
  const [books, setBooks] = useState<Publication[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/opds/2.0/catalog${query ? `?q=${encodeURIComponent(query)}` : ""}`)
        .then((response) => response.json())
        .then((data) => setBooks(data.publications ?? []))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const subtitle = useMemo(
    () => (query ? `${books.length} results for “${query}”` : `${books.length} books in your library`),
    [books.length, query],
  );

  return (
    <LibraryShell>
      <div className="topbar">
        <div>
          <div className="eyebrow">Your collection</div>
          <h1>Good books, close by.</h1>
          <div className="muted">{subtitle}</div>
        </div>
        <a className="button" href="/admin">Manage library</a>
      </div>
      <div className="toolbar">
        <h2>All books</h2>
        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, author, description..."
          aria-label="Search books"
        />
      </div>
      {loading ? (
        <div className="empty">Loading your library...</div>
      ) : books.length === 0 ? (
        <div className="empty">No books found. Upload your first EPUB from Manage library.</div>
      ) : (
        <div className="book-grid">
          {books.map((book) => {
            const author = book.metadata.author?.map((item) => item.name).join(", ");
            const download = book.links?.find((link) => link.rel === "acquisition")?.href;
            return (
              <article className="book-card" key={book.metadata.identifier}>
                <a className="cover" href={download} aria-label={`Download ${book.metadata.title}`}>
                  <span>{book.metadata.title}</span>
                </a>
                <div className="book-title" title={book.metadata.title}>{book.metadata.title}</div>
                <div className="book-author">{author || "Unknown author"}</div>
                <span className="badge">EPUB</span>
              </article>
            );
          })}
        </div>
      )}
    </LibraryShell>
  );
}
