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
      cover: null,
    });

  });

  it("finds the declared cover image", () => {
    const container = strToU8(
      `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
    );
    const image = new Uint8Array([1, 2, 3]);
    const epub3 = zipSync({
      "META-INF/container.xml": container,
      "OEBPS/content.opf": strToU8(
        `<package><manifest><item id="c" href="images/my%20cover.jpg" media-type="image/jpeg" properties="cover-image"/></manifest></package>`,
      ),
      "OEBPS/images/my cover.jpg": image,
    });
    expect(extractEpubMetadata(Buffer.from(epub3)).cover).toEqual({ data: image, contentType: "image/jpeg" });

    const epub2 = zipSync({
      "META-INF/container.xml": container,
      "OEBPS/content.opf": strToU8(
        `<package><metadata><meta name="cover" content="img1"/></metadata>` +
          `<manifest><item href="../cover.png" id="img1" media-type="image/png"/></manifest></package>`,
      ),
      "cover.png": image,
    });
    expect(extractEpubMetadata(Buffer.from(epub2)).cover).toEqual({ data: image, contentType: "image/png" });
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
