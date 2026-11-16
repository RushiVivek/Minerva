// Copies every book in the library to a local folder, skipping the ones that
// are already there. Run it again whenever you want the folder caught up.
//
//   npm run library:sync -- ~/Books/minerva --url https://books.example.com
//
// The admin username comes from ADMIN_USERNAME; the password is asked for,
// or read from MINERVA_ADMIN_PASSWORD. Nothing local is ever deleted.
import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { config } from "dotenv";

// Earlier sources win: the real environment, then .env.local, then .env.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const baseUrl = (urlFlag >= 0 ? args.splice(urlFlag, 2)[1] : process.env.MINERVA_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const folder = args[0];
const username = process.env.ADMIN_USERNAME;
if (!folder || !username) {
  console.error("Usage: npm run library:sync -- <folder> [--url https://your-minerva]\nADMIN_USERNAME must be set in .env.local or the environment.");
  process.exit(1);
}

function askPassword() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    prompt.question(`Admin password for ${username} at ${baseUrl}: `, (answer) => {
      prompt.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    // Keep the typed password off the screen.
    prompt._writeToOutput = () => {};
  });
}

const password = process.env.MINERVA_ADMIN_PASSWORD ?? (await askPassword());
const headers = { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };

const list = await fetch(`${baseUrl}/api/admin/books/list`, { headers });
if (!list.ok) {
  console.error(list.status === 401 ? "Those admin credentials were not accepted." : `Could not list books (HTTP ${list.status}).`);
  process.exit(1);
}
const books = await list.json();

await mkdir(folder, { recursive: true });
const present = await readdir(folder);
// The id in the name is what identifies a book, so a renamed title is not downloaded twice.
const tag = (book) => `[${book.id.slice(0, 8)}].epub`;
const fileName = (book) =>
  `${[book.title, book.authors.join(", ")].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 150)} ${tag(book)}`;

let downloaded = 0;
let failed = 0;
for (const book of books) {
  if (present.some((name) => name.endsWith(tag(book)))) continue;
  try {
    const response = await fetch(`${baseUrl}/api/books/${book.id}/download`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const target = path.join(folder, fileName(book));
    // A partial download never looks like a finished book.
    await writeFile(`${target}.part`, Buffer.from(await response.arrayBuffer()));
    await rename(`${target}.part`, target);
    downloaded += 1;
    console.log(`Saved ${path.basename(target)}`);
  } catch (error) {
    failed += 1;
    console.error(`Failed: ${book.title} (${error.message})`);
  }
}
console.log(`${books.length} books in the library: ${downloaded} downloaded, ${books.length - downloaded - failed} already here, ${failed} failed.`);
process.exit(failed ? 1 : 0);
