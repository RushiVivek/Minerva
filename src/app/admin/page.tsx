"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { LibraryShell } from "@/components/LibraryShell";

type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  publisher: string | null;
  identifier: string | null;
  visibility: "public" | "private";
  coverCloudinaryPublicId: string | null;
  authors: string[];
};
type Collection = { id: string; name: string; slug: string; parentId: string | null };
type ProtectedAction = (authorization: string) => Promise<void>;
const SESSION_AUTH_KEY = "minerva.admin.authorization";

export default function AdminPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editing, setEditing] = useState<Book | null>(null);
  const [bookMessage, setBookMessage] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<ProtectedAction | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");

  const visibleBooks = useMemo(
    () =>
      books.filter((book) =>
        `${book.title} ${book.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [books, query],
  );

  function requestCredentials(label: string, action: ProtectedAction) {
    if (authorization) {
      void action(authorization);
      return;
    }
    setCredentials({ username: "", password: "" });
    setPendingLabel(label);
    setPendingAction(() => action);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedAuthorization = window.sessionStorage.getItem(SESSION_AUTH_KEY);
      if (storedAuthorization) {
        setAuthorization(storedAuthorization);
        void loadBooks(storedAuthorization);
      } else {
        requestCredentials("load the library", loadBooks);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial prompt is intentional: existing books are protected by admin auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credentials.username || !credentials.password || !pendingAction) return;
    const authorization = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
    const action = pendingAction;
    window.sessionStorage.setItem(SESSION_AUTH_KEY, authorization);
    setAuthorization(authorization);
    setPendingAction(null);
    setPendingLabel("");
    setCredentials({ username: "", password: "" });
    await action(authorization);
  }

  async function loadBooks(authorization: string) {
    const [response, collectionResponse] = await Promise.all([
      fetch("/api/admin/books/list", {
        headers: { Authorization: authorization },
      }),
      fetch("/api/admin/collections", { headers: { Authorization: authorization } }),
    ]);
    if (response.ok) {
      setBooks(await response.json());
    } else {
      setBookMessage("Could not load books. Check your admin credentials.");
    }
    if (collectionResponse.ok) {
      setCollections(await collectionResponse.json());
    } else {
      setFolderMessage("Could not load folders. Check your admin credentials.");
    }
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    requestCredentials("create this folder", async (authorization) => {
      const response = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { Authorization: authorization, "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
          parentId: form.get("parentId") || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      setFolderMessage(response.ok ? "Folder created." : result.error ?? "Could not create folder.");
      if (response.ok) {
        formElement.reset();
        await loadBooks(authorization);
      }
    });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    requestCredentials("upload this book", async (authorization) => {
      setBookMessage("Uploading and extracting metadata...");
      const response = await fetch("/api/admin/books", {
        method: "POST",
        body: data,
        headers: { Authorization: authorization },
      });
      const result = await response.json().catch(() => ({}));
      setBookMessage(response.ok ? "Book uploaded successfully." : result.error ?? "Upload failed.");
      if (response.ok) {
        formElement.reset();
        await loadBooks(authorization);
      }
    });
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const bookId = editing.id;
    requestCredentials("save these book changes", async (authorization) => {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: "PATCH",
        headers: { Authorization: authorization },
        body: form,
      });
      setBookMessage(response.ok ? "Metadata saved." : "Could not save metadata.");
      if (response.ok) {
        setEditing(null);
        await loadBooks(authorization);
      }
    });
  }

  async function deleteBook(book: Book) {
    if (!confirm(`Delete “${book.title}” permanently?`)) return;
    requestCredentials("delete this book", async (authorization) => {
      const response = await fetch(`/api/admin/books/${book.id}`, {
        method: "DELETE",
        headers: { Authorization: authorization },
      });
      setBookMessage(response.ok ? "Book deleted." : "Could not delete book.");
      if (response.ok) await loadBooks(authorization);
    });
  }

  return (
    <LibraryShell active="admin">
      <div className="topbar">
        <div>
          <div className="eyebrow">Library management</div>
          <h1>Make your shelf yours.</h1>
          <div className="muted">Upload, organize, and curate your collection.</div>
        </div>
        <Link className="button secondary" href="/">View library</Link>
      </div>

      <div className="stats">
        <div className="stat"><div className="muted">Total books</div><strong>{books.length}</strong></div>
        <div className="stat"><div className="muted">Public</div><strong>{books.filter((book) => book.visibility === "public").length}</strong></div>
        <div className="stat"><div className="muted">Private</div><strong>{books.filter((book) => book.visibility === "private").length}</strong></div>
        <div className="stat"><div className="muted">OPDS</div><strong>Ready</strong></div>
      </div>

      <section aria-labelledby="book-management">
        <div className="toolbar">
          <div>
            <div className="eyebrow">Manage</div>
            <h2 id="book-management">Book management</h2>
          </div>
          <button className="button secondary" type="button" onClick={() => requestCredentials("load the library", loadBooks)}>Load library</button>
        </div>
        <div className="panel" style={{ marginBottom: 28 }}>
          <h2>Upload a new book</h2>
          <p className="muted">EPUB metadata is extracted automatically. You can refine it after upload.</p>
          <form onSubmit={upload} encType="multipart/form-data">
            <div className="form-grid">
              <div className="field-wrap"><label>EPUB file</label><input className="field" name="file" type="file" accept=".epub,application/epub+zip" required /></div>
              <div className="field-wrap"><label>Visibility</label><select className="field" name="visibility" defaultValue="public"><option value="public">Public library</option><option value="private">Private library</option></select></div>
              <div className="field-wrap"><label>Folder</label><select className="field" name="collectionId" defaultValue=""><option value="">No folder</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.parentId ? "↳ " : ""}{collection.name}</option>)}</select></div>
            </div>
            <div className="actions"><button className="button" type="submit">Upload EPUB</button></div>
          </form>
          {bookMessage && <p className="muted" role="status">{bookMessage}</p>}
        </div>

        <div className="toolbar">
          <h2>Your books</h2>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter books..." />
        </div>
        {visibleBooks.length === 0 ? <div className="empty">No books to show yet.</div> : (
          <div className="panel table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Author</th><th>Visibility</th><th>Actions</th></tr></thead>
              <tbody>{visibleBooks.map((book) => (
                <tr key={book.id}>
                  <td><strong>{book.title}</strong><br /><span className="muted">{book.language}</span></td>
                  <td>{book.authors.join(", ") || "Unknown"}</td>
                  <td><span className="badge">{book.visibility}</span></td>
                  <td><div className="row-actions"><button className="button secondary" onClick={() => setEditing(book)}>Edit</button><button className="button danger" onClick={() => void deleteBook(book)}>Delete</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="folder-management" style={{ marginTop: 48 }}>
        <div className="toolbar">
          <div>
            <div className="eyebrow">Manage</div>
            <h2 id="folder-management">Folder management</h2>
          </div>
          <span className="muted">{collections.length} folders</span>
        </div>
        <div className="panel">
          <h2>Create a catalogue folder</h2>
          <p className="muted">Create top-level folders or nest them under an existing folder.</p>
          <form onSubmit={createCollection}>
            <div className="form-grid">
              <div className="field-wrap"><label>Name</label><input className="field" name="name" placeholder="Science Fiction" required /></div>
              <div className="field-wrap"><label>Slug</label><input className="field" name="slug" placeholder="science-fiction" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
              <div className="field-wrap full"><label>Parent folder</label><select className="field" name="parentId" defaultValue=""><option value="">Top level</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></div>
            </div>
            <div className="actions"><button className="button secondary" type="submit">Create folder</button></div>
          </form>
          {folderMessage && <p className="muted" role="status">{folderMessage}</p>}
        </div>
      </section>

      {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
        <div className="modal">
          <div className="topbar"><div><div className="eyebrow">Book editor</div><h2>Edit metadata</h2></div><button className="button secondary" type="button" onClick={(event) => { event.stopPropagation(); setEditing(null); }}>Close</button></div>
          <form onSubmit={saveBook} encType="multipart/form-data">
            <div className="form-grid">
              <div className="field-wrap full"><label>Title</label><input className="field" name="title" defaultValue={editing.title} required /></div>
              <div className="field-wrap"><label>Author</label><input className="field" name="author" defaultValue={editing.authors.join(", ")} /></div>
              <div className="field-wrap"><label>Language</label><input className="field" name="language" defaultValue={editing.language} required /></div>
              <div className="field-wrap"><label>Subtitle</label><input className="field" name="subtitle" defaultValue={editing.subtitle ?? ""} /></div>
              <div className="field-wrap"><label>Publisher</label><input className="field" name="publisher" defaultValue={editing.publisher ?? ""} /></div>
              <div className="field-wrap"><label>Identifier</label><input className="field" name="identifier" defaultValue={editing.identifier ?? ""} /></div>
              <div className="field-wrap"><label>Visibility</label><select className="field" name="visibility" defaultValue={editing.visibility}><option value="public">Public</option><option value="private">Private</option></select></div>
              <div className="field-wrap"><label>Cover image</label><input className="field" name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></div>
              <div className="field-wrap full"><label>Description</label><textarea className="field" name="description" defaultValue={editing.description ?? ""} /></div>
            </div>
            <div className="actions"><button className="button" type="submit">Save changes</button></div>
          </form>
        </div>
      </div>}

      {pendingAction && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPendingAction(null); setPendingLabel(""); } }}>
        <div className="modal">
          <div className="topbar">
            <div><div className="eyebrow">Admin authentication</div><h2>Confirm to {pendingLabel}</h2></div>
            <button className="button secondary" type="button" onClick={() => { setPendingAction(null); setPendingLabel(""); }}>Cancel</button>
          </div>
          <form onSubmit={confirmCredentials}>
            <div className="form-grid">
              <div className="field-wrap full"><label>Admin username</label><input className="field" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} autoFocus required /></div>
              <div className="field-wrap full"><label>Admin password</label><input className="field" type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} required /></div>
            </div>
            <div className="actions"><button className="button" type="submit">Continue</button></div>
          </form>
        </div>
      </div>}
    </LibraryShell>
  );
}
