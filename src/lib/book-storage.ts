import { deleteRawBook, rawAssetUrl } from "@/lib/cloudinary";

// Where a book's EPUB lives. New uploads go to Catbox, which takes files up to
// 200 MB; books uploaded earlier stay on Cloudinary. The two existing columns
// record it: `cloudinaryResourceType` is "catbox" and `cloudinaryPublicId`
// holds the file's URL, or they hold Cloudinary's own values.

const CATBOX_API = "https://catbox.moe/user/api.php";
const CATBOX_FILES = "https://files.catbox.moe/";
export const CATBOX = "catbox";

type StoredBook = { cloudinaryPublicId: string; cloudinaryResourceType: string };

async function catbox(fields: Record<string, string | Blob>, filename?: string) {
  const form = new FormData();
  // Uploads made with an account's userhash can be deleted later; anonymous ones cannot.
  if (process.env.CATBOX_USERHASH) form.set("userhash", process.env.CATBOX_USERHASH);
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string") form.set(name, value);
    else form.set(name, value, filename);
  }
  const response = await fetch(CATBOX_API, { method: "POST", body: form });
  const text = (await response.text()).trim();
  if (!response.ok) throw new Error(`Catbox request failed (${response.status}): ${text.slice(0, 200)}`);
  return text;
}

export async function storeBook(buffer: Buffer, checksum: string): Promise<StoredBook> {
  const url = await catbox(
    { reqtype: "fileupload", fileToUpload: new Blob([new Uint8Array(buffer)], { type: "application/epub+zip" }) },
    `${checksum}.epub`,
  );
  // Catbox answers 200 with a plain-text message when it refuses a file.
  if (!url.startsWith(CATBOX_FILES)) throw new Error(`Catbox refused the upload: ${url.slice(0, 200)}`);
  return { cloudinaryPublicId: url, cloudinaryResourceType: CATBOX };
}

/** A URL the server can fetch the EPUB from. Never hand it to clients: it bypasses book visibility. */
export function bookFileUrl(book: StoredBook) {
  return book.cloudinaryResourceType === CATBOX
    ? book.cloudinaryPublicId
    : rawAssetUrl(book.cloudinaryPublicId);
}

export async function deleteBookFile(book: StoredBook) {
  if (book.cloudinaryResourceType !== CATBOX) return deleteRawBook(book.cloudinaryPublicId);
  if (!process.env.CATBOX_USERHASH) return;
  await catbox({ reqtype: "deletefiles", files: book.cloudinaryPublicId.slice(CATBOX_FILES.length) });
}
