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
    const book = ePub(`/api/books/${bookId}/download`);
    const rendition = book.renderTo(containerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none",
    });
    bookRef.current = book;
    renditionRef.current = rendition;
    rendition.display().then(() => setMessage("")).catch(() => setMessage("Could not open this EPUB."));
    return () => {
      rendition.destroy();
      book.destroy();
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
