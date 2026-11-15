"use client";

import ePub, { type Book, type Contents, type Location, type NavItem, type Rendition } from "epubjs";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { partialMd5 } from "@/lib/md5";

import {
  forgetAccount,
  loadAccount,
  pullProgress,
  pushProgress,
  resolveXPointer,
  signIn,
  xpointerSpineIndex,
  type RemoteProgress,
  type SyncAccount,
} from "./sync";

type Settings = {
  layout: "paged" | "scroll";
  continuous: boolean;
  theme: "light" | "bookish" | "dark";
  font: "original" | "serif" | "sans" | "mono";
  fontSize: number;
  lineHeight: number;
};

const DEFAULTS: Settings = {
  layout: "paged",
  continuous: false,
  theme: "light",
  font: "serif",
  fontSize: 100,
  lineHeight: 1.6,
};
const SETTINGS_KEY = "minerva.reader.settings";
const THEMES = {
  light: { background: "#fbf7ee", color: "#221e19", link: "#b45309" },
  bookish: { background: "#eadcc2", color: "#3d3024", link: "#8a4b0f" },
  dark: { background: "#16130f", color: "#d8d0c4", link: "#f0a63a" },
};
const FONTS = {
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

// Storage can be unavailable (private windows, blocked site data); the reader
// then simply forgets between visits.
function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function loadSettings(): Settings {
  try {
    const stored = JSON.parse(readStored(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    return {
      layout: stored.layout === "scroll" ? "scroll" : DEFAULTS.layout,
      continuous: stored.continuous === true,
      theme: stored.theme && stored.theme in THEMES ? stored.theme : DEFAULTS.theme,
      font: stored.font === "original" || (stored.font && stored.font in FONTS) ? stored.font : DEFAULTS.font,
      fontSize: clamp(Number(stored.fontSize) || DEFAULTS.fontSize, 70, 220),
      lineHeight: clamp(Number(stored.lineHeight) || DEFAULTS.lineHeight, 1.2, 2.2),
    };
  } catch {
    return DEFAULTS;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function applyStyles(rendition: Rendition, settings: Settings) {
  const { themes } = rendition;
  themes.select(settings.theme);
  // Missing from the bundled type definitions.
  if (settings.font === "original") (themes as unknown as { removeOverride(name: string): void }).removeOverride("font-family");
  else themes.font(FONTS[settings.font]);
  themes.fontSize(`${settings.fontSize}%`);
  themes.override("line-height", String(settings.lineHeight), true);
}

function flattenToc(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flattenToc(item.subitems ?? [])]);
}

/** The table-of-contents entry for a spine document, ignoring `#fragment`s. */
function chapterFor(toc: NavItem[], href: string | undefined) {
  if (!href) return undefined;
  const file = href.split("#")[0];
  return flattenToc(toc).find((item) => {
    const itemFile = item.href.split("#")[0];
    return itemFile === file || itemFile.endsWith(`/${file}`) || file.endsWith(`/${itemFile}`);
  });
}

export function Reader({ bookId, title, author }: { bookId: string; title: string; author: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const positionKey = `minerva.reader.position.${bookId}`;
  const positionRef = useRef<string | null>(null);
  const applyRemoteRef = useRef<(book: Book) => void>(() => {});
  const [settings, setSettings] = useState(loadSettings);
  const [book, setBook] = useState<Book | null>(null);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [panel, setPanel] = useState<"toc" | "settings" | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [hasLocations, setHasLocations] = useState(false);
  const [account, setAccount] = useState<SyncAccount | null>(loadAccount);
  const [syncMessage, setSyncMessage] = useState("");
  const accountRef = useRef(account);
  // What the open book needs for syncing: its KOSync document id, a position
  // from another device still to be applied, and where to open instead of the
  // locally saved place.
  const documentRef = useRef<string | null>(null);
  const remoteRef = useRef<RemoteProgress | null>(null);
  const startRef = useRef<string | null>(null);

  const chapter = chapterFor(toc, location?.start.href);
  const paged = settings.layout === "paged";

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeStored(SETTINGS_KEY, JSON.stringify(next));
  }

  const move = useCallback((direction: "prev" | "next") => {
    void renditionRef.current?.[direction]();
  }, []);

  // Download and parse the book once per id.
  useEffect(() => {
    const abort = new AbortController();
    let opened: Book | undefined;
    positionRef.current = readStored(positionKey);

    async function open() {
      const response = await fetch(`/api/books/${bookId}/download`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Download failed with ${response.status}`);
      const archive = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      opened = ePub(archive);
      const navigation = await opened.loaded.navigation;
      await opened.ready;
      if (abort.signal.aborted) return;

      documentRef.current = partialMd5(new Uint8Array(archive));
      remoteRef.current = null;
      startRef.current = null;
      const account = accountRef.current;
      if (account) {
        const remote = await pullProgress(account, documentRef.current, abort.signal).catch(() => null);
        if (abort.signal.aborted) return;
        // Another device read further more recently than this browser did.
        const savedAt = Number(readStored(`${positionKey}.at`)) || 0;
        if (remote && remote.device_id !== account.deviceId && (remote.timestamp ?? 0) > savedAt) {
          const spineIndex = xpointerSpineIndex(remote.progress ?? "");
          if (remote.progress?.startsWith("epubcfi(")) positionRef.current = remote.progress;
          else {
            remoteRef.current = remote;
            if (spineIndex !== null) startRef.current = opened.spine.get(spineIndex)?.href ?? null;
          }
        }
      }
      setToc(navigation.toc);
      setBook(opened);

      // Locations turn a position into a whole-book percentage. Building them
      // walks every chapter, so do it after the first page is up and keep the
      // result for next time.
      const locationsKey = `minerva.reader.locations.${bookId}`;
      const cached = readStored(locationsKey);
      if (cached) opened.locations.load(cached);
      else {
        await opened.locations.generate(1600);
        if (abort.signal.aborted) return;
        writeStored(locationsKey, opened.locations.save());
      }
      if (abort.signal.aborted) return;
      setHasLocations(true);
      if (positionRef.current) setPercent(opened.locations.percentageFromCfi(positionRef.current));
      applyRemotePercentage(opened);
    }

    // A remote position with nothing but a percentage needs both the page and
    // the location index, whichever comes last.
    function applyRemotePercentage(target: Book) {
      const percentage = remoteRef.current?.percentage;
      if (!renditionRef.current || !target.locations.length() || !percentage) return;
      remoteRef.current = null;
      void renditionRef.current.display(target.locations.cfiFromPercentage(Math.min(percentage, 1)));
    }
    applyRemoteRef.current = applyRemotePercentage;

    open().catch((error) => {
      if (abort.signal.aborted) return;
      console.error("Failed to open EPUB", error);
      setStatus("error");
    });
    return () => {
      abort.abort();
      opened?.destroy();
    };
  }, [bookId, positionKey, attempt]);

  // Appearance changes apply to the live rendition; a new rendition reads the
  // latest settings from the ref.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    if (renditionRef.current) applyStyles(renditionRef.current, settings);
  }, [settings]);

  // Render the book. Layout changes need a fresh rendition; it reopens at the
  // position the previous one last reported.
  useEffect(() => {
    const container = containerRef.current;
    if (!book || !container) return;
    const isPaged = settings.layout === "paged";
    const rendition = book.renderTo(container, {
      width: "100%",
      height: "100%",
      spread: "none",
      manager: settings.continuous ? "continuous" : "default",
      flow: isPaged ? "paginated" : settings.continuous ? "scrolled" : "scrolled-doc",
    });
    for (const [name, theme] of Object.entries(THEMES)) {
      rendition.themes.register(name, {
        body: { color: `${theme.color} !important`, background: `${theme.background} !important` },
        // Publisher styles often hard-code black text or white boxes.
        "p, div, span, li, td, th, blockquote, h1, h2, h3, h4, h5, h6": {
          color: "inherit !important",
          "background-color": "transparent !important",
        },
        "a, a:link, a:visited": { color: `${theme.link} !important` },
        img: { "max-width": "100% !important" },
      });
    }
    renditionRef.current = rendition;

    // Opening the book reports a location too; only moves made after that
    // count as reading here, or merely opening it would overrule other devices.
    let settled = false;
    let pushTimer: number | undefined;
    function push() {
      window.clearTimeout(pushTimer);
      pushTimer = undefined;
      const cfi = positionRef.current;
      const account = accountRef.current;
      if (!account || !documentRef.current || !cfi) return;
      // Other apps compare percentages, which need the location index.
      if (!book!.locations.length()) pushTimer = window.setTimeout(push, 5000);
      else void pushProgress(account, documentRef.current, cfi, book!.locations.percentageFromCfi(cfi)).catch(() => {});
    }
    function pushIfPending() {
      if (pushTimer !== undefined && document.visibilityState === "hidden") push();
    }
    document.addEventListener("visibilitychange", pushIfPending);

    rendition.on("relocated", (next: Location) => {
      positionRef.current = next.start.cfi;
      writeStored(positionKey, next.start.cfi);
      setLocation(next);
      if (book.locations.length()) setPercent(book.locations.percentageFromCfi(next.start.cfi));
      if (!settled) return;
      writeStored(`${positionKey}.at`, String(Math.floor(Date.now() / 1000)));
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(push, 2500);
    });

    // Events inside the book's iframe never reach the window listeners below.
    rendition.on("keydown", (event: KeyboardEvent) => {
      if (handleKey(event.key, isPaged)) event.preventDefault();
    });
    let touch: { x: number; y: number } | null = null;
    rendition.on("touchstart", (event: TouchEvent) => {
      const point = event.changedTouches[0];
      touch = { x: point.screenX, y: point.screenY };
    });
    rendition.on("touchend", (event: TouchEvent) => {
      if (!touch || !isPaged) return;
      const point = event.changedTouches[0];
      const dx = point.screenX - touch.x;
      const dy = point.screenY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? "next" : "prev");
    });
    rendition.on("click", (event: MouseEvent) => {
      setPanel(null);
      const target = event.target as Element | null;
      const frame = event.view?.frameElement;
      if (!isPaged || !frame || target?.closest?.("a") || event.view?.getSelection()?.toString()) return;
      // The iframe is as wide as the whole chapter; map the click back to the
      // visible page before deciding which edge was tapped.
      const page = container.getBoundingClientRect();
      const x = (event.clientX + frame.getBoundingClientRect().left - page.left) / page.width;
      if (x < 0.25) move("prev");
      else if (x > 0.75) move("next");
    });

    function handleKey(key: string, pagedFlow: boolean) {
      if (key === "ArrowLeft") move("prev");
      else if (key === "ArrowRight") move("next");
      else if (pagedFlow && key === "PageUp") move("prev");
      else if (pagedFlow && (key === "PageDown" || key === " ")) move("next");
      else if (key === "Escape") setPanel(null);
      else return false;
      return true;
    }
    function onWindowKey(event: KeyboardEvent) {
      const target = event.target as Element | null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest("input, select, textarea") && event.key !== "Escape") return;
      if (event.key === " " && target?.closest("button, a")) return;
      if (handleKey(event.key, isPaged)) event.preventDefault();
    }
    window.addEventListener("keydown", onWindowKey);

    applyStyles(rendition, settingsRef.current);
    let stale = false;
    const start = startRef.current ?? positionRef.current ?? undefined;
    startRef.current = null;
    rendition
      .display(start)
      // A saved position can stop resolving if the file was replaced.
      .catch(() => rendition.display())
      .then(async () => {
        if (stale) return;
        setStatus("ready");
        const pointer = remoteRef.current?.progress;
        if (pointer && xpointerSpineIndex(pointer) !== null) {
          remoteRef.current = null;
          const [contents] = rendition.getContents() as unknown as Contents[];
          const element = contents && resolveXPointer(contents.document, pointer);
          if (element && element !== contents.document.body) await rendition.display(contents.cfiFromNode(element));
        } else applyRemoteRef.current(book);
        window.setTimeout(() => { settled = true; }, 800);
      })
      .catch((error) => {
        console.error("Failed to render EPUB", error);
        if (!stale) setStatus("error");
      });

    return () => {
      stale = true;
      if (pushTimer !== undefined) push();
      window.clearTimeout(pushTimer);
      document.removeEventListener("visibilitychange", pushIfPending);
      window.removeEventListener("keydown", onWindowKey);
      renditionRef.current = null;
      rendition.destroy();
    };
  }, [book, settings.layout, settings.continuous, positionKey, move]);

  function goTo(target: string) {
    setPanel(null);
    renditionRef.current?.display(target).catch((error) => console.error("Failed to navigate", error));
  }

  async function connectSync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSyncMessage("Signing in…");
    try {
      const next = await signIn(String(form.get("username")), String(form.get("password")));
      accountRef.current = next;
      setAccount(next);
      setSyncMessage("");
      // Reopen the book, so a newer position from another device is picked up.
      setStatus("loading");
      setBook(null);
      setAttempt(attempt + 1);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sign-in failed.");
    }
  }

  function renderToc(items: NavItem[]) {
    return (
      <ul className="toc-list">
        {items.map((item) => (
          <li key={item.id || item.href}>
            <button type="button" aria-current={item === chapter ? "true" : undefined} onClick={() => goTo(item.href)}>
              {item.label.trim() || "Untitled"}
            </button>
            {item.subitems?.length ? renderToc(item.subitems) : null}
          </li>
        ))}
      </ul>
    );
  }

  const percentLabel = percent === null ? "" : `${Math.round(percent * 100)}%`;

  return (
    <div className="reader-page" data-theme={settings.theme}>
      <header className="reader-bar">
        <Link className="icon-button" href={`/books/${bookId}`} aria-label="Back to book details"><Icon name="back" /></Link>
        <button className="icon-button" type="button" aria-label="Table of contents" aria-expanded={panel === "toc"} disabled={toc.length === 0} onClick={() => setPanel(panel === "toc" ? null : "toc")}><Icon name="list" /></button>
        <div className="reader-heading">
          <strong>{title}</strong>
          <span>{chapter?.label.trim() || author || " "}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Reading settings" aria-expanded={panel === "settings"} onClick={() => setPanel(panel === "settings" ? null : "settings")}><Icon name="type" /></button>
      </header>

      <div className="reader-stage">
        <button className="icon-button" type="button" aria-label={paged ? "Previous page" : "Previous chapter"} disabled={location?.atStart ?? true} onClick={() => move("prev")}><Icon name="back" /></button>
        <div className="reader-frame" ref={containerRef} />
        <button className="icon-button" type="button" aria-label={paged ? "Next page" : "Next chapter"} disabled={location?.atEnd ?? true} onClick={() => move("next")}><Icon name="forward" /></button>

        {status === "loading" && (
          <div className="reader-message" role="status"><div className="reader-spinner" />Opening book…</div>
        )}
        {status === "error" && (
          <div className="reader-message" role="alert">
            <p>This book could not be opened.</p>
            <button className="button" type="button" onClick={() => { setStatus("loading"); setBook(null); setAttempt(attempt + 1); }}>Try again</button>
          </div>
        )}

        {panel === "toc" && (
          <nav className="reader-panel toc" aria-label="Table of contents">
            <h2>Contents</h2>
            {renderToc(toc)}
          </nav>
        )}
        {panel === "settings" && (
          <div className="reader-panel" role="dialog" aria-label="Reading settings">
            <fieldset className="setting">
              <legend>Theme</legend>
              <div className="segmented">
                {(["light", "bookish", "dark"] as const).map((theme) => (
                  <button key={theme} type="button" className={`swatch-${theme}`} aria-pressed={settings.theme === theme} onClick={() => update({ theme })}>
                    {theme === "bookish" ? "Sepia" : theme === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="setting">
              <legend>Text size · {settings.fontSize}%</legend>
              <div className="segmented">
                <button type="button" aria-label="Smaller text" disabled={settings.fontSize <= 70} onClick={() => update({ fontSize: settings.fontSize - 10 })}>A−</button>
                <button type="button" aria-label="Larger text" disabled={settings.fontSize >= 220} onClick={() => update({ fontSize: settings.fontSize + 10 })}>A+</button>
              </div>
            </fieldset>
            <label className="setting">
              <span>Font</span>
              <select className="field" value={settings.font} onChange={(event) => update({ font: event.target.value as Settings["font"] })}>
                <option value="original">Book’s own font</option>
                <option value="serif">Serif</option>
                <option value="sans">Sans-serif</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <fieldset className="setting">
              <legend>Line spacing</legend>
              <div className="segmented">
                {([["Tight", 1.35], ["Normal", 1.6], ["Loose", 1.9]] as const).map(([label, value]) => (
                  <button key={label} type="button" aria-pressed={settings.lineHeight === value} onClick={() => update({ lineHeight: value })}>{label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="setting">
              <legend>Layout</legend>
              <div className="segmented">
                <button type="button" aria-pressed={paged} onClick={() => update({ layout: "paged" })}>Pages</button>
                <button type="button" aria-pressed={!paged} onClick={() => update({ layout: "scroll" })}>Scroll</button>
              </div>
              <label className="check">
                <input type="checkbox" checked={settings.continuous} onChange={(event) => update({ continuous: event.target.checked })} />
                Flow straight into the next chapter
              </label>
            </fieldset>
            {account ? (
              <fieldset className="setting">
                <legend>Sync</legend>
                <p className="setting-note">Sharing your place with Readest as <strong>{account.username}</strong>.</p>
                <button className="button secondary" type="button" onClick={() => { forgetAccount(); accountRef.current = null; setAccount(null); }}>Stop syncing</button>
              </fieldset>
            ) : (
              <form className="setting" onSubmit={connectSync}>
                <span>Sync with Readest</span>
                <p className="setting-note">Sign in with your reading sync account to continue where another device stopped.</p>
                <input className="field" name="username" aria-label="Sync username" placeholder="Username" autoComplete="username" required />
                <input className="field" name="password" type="password" aria-label="Sync password" placeholder="Password" autoComplete="current-password" required />
                <button className="button secondary" type="submit">Sign in</button>
                <p className="setting-note" role="status">{syncMessage}</p>
              </form>
            )}
          </div>
        )}
      </div>

      <footer className="reader-foot">
        <span className="chapter">{chapter?.label.trim() || title}</span>
        <span aria-live="polite">{percentLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={(percent ?? 0) * 100}
          disabled={!hasLocations || !book}
          aria-label="Position in book"
          aria-valuetext={percentLabel || "Calculating"}
          onChange={(event) => {
            const value = Number(event.target.value) / 100;
            setPercent(value);
            if (book) goTo(book.locations.cfiFromPercentage(value));
          }}
        />
      </footer>
    </div>
  );
}
