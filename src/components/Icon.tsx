const PATHS = {
  library: "M4 19V5m4 14V5m4 14V5m3.5.3 4 13.4",
  settings: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4m8 2v4",
  feed: "M5 19h.01M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16",
  lock: "M6 11h12v9H6zm2 0V8a4 4 0 0 1 8 0v3",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  search: "m20 20-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0",
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  type: "M4 19 9.5 5 15 19M6 14h7m4 5 2.5-7 2.5 7m-4.2-2h3.4",
  close: "M6 6l12 12M18 6 6 18",
} as const;

/** Decorative line icon; give the surrounding control its own accessible name. */
export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
