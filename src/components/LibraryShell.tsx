import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";

export function LibraryShell({
  children,
  active = "library",
}: {
  children: ReactNode;
  active?: "library" | "admin";
}) {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">Minerva</span>
        </Link>
        <div className="nav-label">Library</div>
        <Link className={`nav-link ${active === "library" ? "active" : ""}`} href="/" aria-current={active === "library" ? "page" : undefined}>
          <Icon name="library" /> <span>Browse</span>
        </Link>
        <Link className={`nav-link ${active === "admin" ? "active" : ""}`} href="/admin" aria-current={active === "admin" ? "page" : undefined}>
          <Icon name="settings" /> <span>Manage</span>
        </Link>
        <div className="nav-label">OPDS feeds</div>
        <Link prefetch={false} className="nav-link feed" href="/api/opds/2.0/catalog" aria-label="Public OPDS feed">
          <Icon name="feed" /> <span>Public feed</span>
        </Link>
        <Link prefetch={false} className="nav-link feed" href="/api/opds/private/2.0/catalog" aria-label="Private OPDS feed">
          <Icon name="lock" /> <span>Private feed</span>
        </Link>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
