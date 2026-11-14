"use client";

import ePub, { type Book, type Rendition } from "epubjs";
import { useEffect, useRef, useState } from "react";

export function Reader({ bookId, title }: { bookId: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [message, setMessage] = useState("Opening book...");

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let rendition: Rendition | undefined;
    let book: Book | undefined;

    async function openBook() {
      try {
        const response = await fetch(`/api/books/${bookId}/download`);
        if (!response.ok) throw new Error("EPUB download failed");
        const archive = await response.arrayBuffer();
        if (cancelled || !containerRef.current) return;
        book = ePub(archive);
        rendition = book.renderTo(containerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
        });
        bookRef.current = book;
        renditionRef.current = rendition;
        await rendition.display();
        if (!cancelled) setMessage("");
      } catch {
        if (!cancelled) setMessage("Could not open this EPUB. Check the download endpoint and book file.");
      }
    }

    void openBook();
    return () => {
      cancelled = true;
      rendition?.destroy();
      book?.destroy();
      bookRef.current = null;
      renditionRef.current = null;
    };
  }, [bookId]);

  async function move(direction: "prev" | "next") {
    if (!renditionRef.current) return;
    await renditionRef.current[direction]();
  }

  return (
    <section className="reader-shell" aria-label={`Reader for ${title}`}>
      <div className="reader-toolbar">
        <button className="button secondary" onClick={() => void move("prev")}>Previous</button>
        <span className="muted">{message || "Reading"}</span>
        <button className="button secondary" onClick={() => void move("next")}>Next</button>
      </div>
      <div className="reader-frame" ref={containerRef} />
    </section>
  );
}
