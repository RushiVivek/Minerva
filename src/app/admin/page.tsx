"use client";

import { FormEvent, useState } from "react";

export default function AdminPage() {
  const [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    data.delete("username");
    data.delete("password");
    setMessage("Uploading...");
    const response = await fetch("/api/admin/books", {
      method: "POST",
      body: data,
      headers: {
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Uploaded book ${result.id}` : result.error ?? "Upload failed");
  }

  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Minerva admin</h1>
      <p>Upload an EPUB and choose whether it belongs in the public or private feed.</p>
      <form onSubmit={upload} encType="multipart/form-data">
        <p>
          <label>
            Username <input name="username" type="text" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Password <input name="password" type="password" autoComplete="current-password" required />
          </label>
        </p>
        <p>
          <label>
            EPUB file{" "}
            <input name="file" type="file" accept=".epub,application/epub+zip" required />
          </label>
        </p>
        <p>
          <label>
            Visibility{" "}
            <select name="visibility" defaultValue="public">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </p>
        <button type="submit">Upload book</button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
