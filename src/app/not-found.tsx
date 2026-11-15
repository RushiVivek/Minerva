import Link from "next/link";

import { LibraryShell } from "@/components/LibraryShell";

export default function NotFound() {
  return (
    <LibraryShell>
      <div className="empty">
        <h1>Not on the shelf.</h1>
        <p>This book or folder does not exist, or is private.</p>
        <Link className="button" href="/">Back to the library</Link>
      </div>
    </LibraryShell>
  );
}
