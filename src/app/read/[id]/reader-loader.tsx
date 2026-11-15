"use client";

import dynamic from "next/dynamic";

// The reader reads saved settings and drives an iframe, so it only renders in
// the browser.
export const ReaderLoader = dynamic(() => import("./reader").then((module) => module.Reader), {
  ssr: false,
  loading: () => (
    <div className="reader-page">
      <div />
      <div className="reader-message" role="status"><div className="reader-spinner" />Opening book…</div>
    </div>
  ),
});
