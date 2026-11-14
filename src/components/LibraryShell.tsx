import Link from "next/link";
import type { ReactNode } from "react";

export function LibraryShell({
  children,
  active = "library",
}: {
  children: ReactNode;
  active?: "library" | "admin";
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <span className="brand-name">Minerva</span>
        </Link>
        <div className="nav-label">Library</div>
        <Link className={`nav-link ${active === "library" ? "active" : ""}`} href="/">
          <span>▦</span> <span>Browse</span>
        </Link>
        <Link className={`nav-link ${active === "admin" ? "active" : ""}`} href="/admin">
          <span>⚙</span> <span>Manage</span>
        </Link>
        <div className="nav-label">Connect</div>
        <Link className="nav-link" href="/api/opds/2.0/catalog">
          <span>↗</span> <span>Public OPDS</span>
        </Link>
        <Link className="nav-link" href="/api/opds/private/2.0/catalog">
          <span>⌁</span> <span>Private OPDS</span>
        </Link>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
