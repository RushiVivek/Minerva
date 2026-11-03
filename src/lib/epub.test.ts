import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";

import { extractEpubMetadata, validateEpub } from "./epub";

describe("EPUB metadata extraction", () => {
  it("extracts common Dublin Core fields", () => {
    const epub = zipSync({
      "META-INF/container.xml": strToU8(
        `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
      ),
      "OEBPS/content.opf": strToU8(
        "<package><metadata><dc:title>My &amp; Book</dc:title>" +
          "<dc:language>en</dc:language><dc:identifier>isbn:123</dc:identifier>" +
          "<dc:creator>Author</dc:creator></metadata></package>",
      ),
    });
    const metadata = extractEpubMetadata(Buffer.from(epub));
    expect(metadata).toEqual({
      title: "My & Book",
      language: "en",
      identifier: "isbn:123",
      creator: "Author",
    });

  });

  it("rejects malformed EPUB archives", () => {
    expect(() =>
      extractEpubMetadata(Buffer.from("not a zip archive")),
    ).toThrow("valid EPUB archive");
  });

  it("rejects non-EPUB filenames", () => {
    expect(() => validateEpub(new File(["x"], "book.pdf"))).toThrow(
      "extension",
    );
  });
});
