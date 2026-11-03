import { unzipSync } from "fflate";

const MAX_EPUB_BYTES = 100 * 1024 * 1024;

export type EpubMetadata = {
  title: string;
  language: string;
  identifier: string | null;
  creator: string | null;
};

export function validateEpub(file: File) {
  if (file.size === 0 || file.size > MAX_EPUB_BYTES) {
    throw new Error("EPUB must be between 1 byte and 100 MB");
  }
  if (
    file.type &&
    file.type !== "application/epub+zip" &&
    file.type !== "application/zip"
  ) {
    throw new Error("Only EPUB files are accepted");
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    throw new Error("File must have an .epub extension");
  }
}

export function extractEpubMetadata(buffer: Buffer): EpubMetadata {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new Error("The uploaded file is not a valid EPUB archive");
  }

  const container = readTextFile(files, "META-INF/container.xml");
  const rootfilePath = container.match(
    /<rootfile\b[^>]*full-path=["']([^"']+)["']/i,
  )?.[1];
  if (!rootfilePath) {
    throw new Error("EPUB container.xml does not declare a rootfile");
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
  };
}

function readTextFile(files: Record<string, Uint8Array>, path: string) {
  const file = files[path];
  if (!file) throw new Error(`EPUB file is missing: ${path}`);
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
