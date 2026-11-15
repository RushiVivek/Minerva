"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="main">
      <div className="empty" role="alert">
        <h1>The library is unavailable.</h1>
        <p>Minerva could not reach its database. Try again in a moment.</p>
        <button className="button" type="button" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
