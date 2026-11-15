import { unzipSync } from "fflate";

const MAX_EPUB_BYTES = 100 * 1024 * 1024;

/** A problem with the uploaded file itself; its message is safe to show the uploader. */
export class EpubError extends Error {}

export type EpubMetadata = {
  title: string;
  language: string;
  identifier: string | null;
  creator: string | null;
  cover: { data: Uint8Array; contentType: string } | null;
};

export function validateEpub(file: File) {
  if (file.size === 0 || file.size > MAX_EPUB_BYTES) {
    throw new EpubError("EPUB must be between 1 byte and 100 MB");
  }
  if (
    file.type &&
    file.type !== "application/epub+zip" &&
    file.type !== "application/zip"
  ) {
    throw new EpubError("Only EPUB files are accepted");
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    throw new EpubError("File must have an .epub extension");
  }
}

export function extractEpubMetadata(buffer: Buffer): EpubMetadata {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new EpubError("The uploaded file is not a valid EPUB archive");
  }

  const container = readTextFile(files, "META-INF/container.xml");
  const rootfilePath = container.match(
    /<rootfile\b[^>]*full-path=["']([^"']+)["']/i,
  )?.[1];
  if (!rootfilePath) {
    throw new EpubError("EPUB container.xml does not declare a rootfile");
  }

  const content = readTextFile(files, rootfilePath);
  const title =
    content.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ??
    "Untitled";
  const language =
    content.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i)?.[1]?.trim() ??
    "en";
  const identifier =
    content.match(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/i)?.[1]?.trim() ??
    null;
  const creator =
    content.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() ??
    null;
  return {
    title: decodeXml(title),
    language: decodeXml(language).slice(0, 20) || "en",
    identifier: identifier ? decodeXml(identifier) : null,
    creator: creator ? decodeXml(creator) : null,
    cover: findCover(files, rootfilePath, content),
  };
}

/** The cover the package declares: EPUB 3's `cover-image` item, or EPUB 2's `<meta name="cover">`. */
function findCover(files: Record<string, Uint8Array>, rootfilePath: string, content: string) {
  const items = [...content.matchAll(/<item\b[^>]*>/gi)].map((match) => match[0]);
  const attribute = (tag: string, name: string) =>
    tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1];
  const metaTag = content.match(/<meta\b[^>]*\bname=["']cover["'][^>]*>/i)?.[0];
  const coverId = metaTag && attribute(metaTag, "content");
  const item =
    items.find((tag) => attribute(tag, "properties")?.split(/\s+/).includes("cover-image")) ??
    (coverId ? items.find((tag) => attribute(tag, "id") === coverId) : undefined);
  const href = item && attribute(item, "href");
  const contentType = item && attribute(item, "media-type");
  if (!href || !contentType?.startsWith("image/")) return null;
  // The href is relative to the package document.
  const path = new URL(decodeXml(href), `file:///${rootfilePath}`).pathname.slice(1);
  const data = files[decodeURIComponent(path)];
  return data ? { data, contentType } : null;
}

function readTextFile(files: Record<string, Uint8Array>, path: string) {
  const file = files[path];
  if (!file) throw new EpubError(`EPUB file is missing: ${path}`);
  return new TextDecoder().decode(file);
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
