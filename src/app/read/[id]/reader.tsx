"use client";

import ePub, { type Book, type Rendition } from "epubjs";
import { useEffect, useRef, useState } from "react";

export function Reader({ bookId, title }: { bookId: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [message, setMessage] = useState("Opening book...");
  const [layout, setLayout] = useState<"paged" | "scroll">("paged");
  const [theme, setTheme] = useState<"light" | "dark" | "bookish">("light");
  const [font, setFont] = useState<"serif" | "sans" | "mono">("serif");
  const [fontSize, setFontSize] = useState("100%");
  const [continuous, setContinuous] = useState(false);

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
        rendition.themes.register("light", { body: { color: "#222", background: "#f7f3e8" } });
        rendition.themes.register("dark", { body: { color: "#e8e8e8", background: "#151720" } });
        rendition.themes.register("bookish", { body: { color: "#3d3024", background: "#eadcc2" } });
        rendition.themes.select("light");
        rendition.themes.font("Georgia, serif");
        rendition.themes.fontSize("100%");
        rendition.flow("paginated");
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        void move("prev");
      } else if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        void move("next");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function applyReaderSetting(
    nextLayout: "paged" | "scroll",
    nextTheme: "light" | "dark" | "bookish",
    nextFont: "serif" | "sans" | "mono",
    nextFontSize: string,
  ) {
    setLayout(nextLayout);
    setTheme(nextTheme);
    setFont(nextFont);
    setFontSize(nextFontSize);
    const rendition = renditionRef.current;
    if (!rendition) return;
    const families = { serif: "Georgia, serif", sans: "Arial, sans-serif", mono: "monospace" };
    rendition.flow(nextLayout === "scroll" ? (continuous ? "scrolled-doc" : "scrolled") : "paginated");
    rendition.themes.select(nextTheme);
    rendition.themes.font(families[nextFont]);
    rendition.themes.fontSize(nextFontSize);
  }

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
      <div className="reader-settings">
        <label>Layout <select value={layout} onChange={(event) => applyReaderSetting(event.target.value as "paged" | "scroll", theme, font, fontSize)}><option value="paged">Paged</option><option value="scroll">Scroll</option></select></label>
        <label><input type="checkbox" checked={continuous} onChange={(event) => { setContinuous(event.target.checked); if (layout === "scroll") renditionRef.current?.flow(event.target.checked ? "scrolled-doc" : "scrolled"); }} /> Continuous chapters</label>
        <label>Theme <select value={theme} onChange={(event) => applyReaderSetting(layout, event.target.value as "light" | "dark" | "bookish", font, fontSize)}><option value="light">Light</option><option value="dark">Dark</option><option value="bookish">Bookish</option></select></label>
        <label>Font <select value={font} onChange={(event) => applyReaderSetting(layout, theme, event.target.value as "serif" | "sans" | "mono", fontSize)}><option value="serif">Serif</option><option value="sans">Sans</option><option value="mono">Monospace</option></select></label>
        <label>Size <select value={fontSize} onChange={(event) => applyReaderSetting(layout, theme, font, event.target.value)}><option value="85%">Small</option><option value="100%">Medium</option><option value="120%">Large</option><option value="140%">Extra large</option></select></label>
      </div>
      <div className={`reader-frame reader-${theme}`} ref={containerRef} />
    </section>
  );
}
