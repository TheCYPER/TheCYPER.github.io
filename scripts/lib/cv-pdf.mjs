import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfTextAndMetadata(bytes) {
  let document;
  try {
    const loadingTask = getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    document = await loadingTask.promise;
    const metadata = await document.getMetadata().catch(() => undefined);
    const metadataText = [
      JSON.stringify(metadata?.info ?? {}),
      metadata?.metadata?.getRaw?.() ?? "",
    ].join("\n");

    const pageText = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageText.push(
        content.items
          .filter((item) => "str" in item)
          .map((item) => item.str)
          .join(" "),
      );
      page.cleanup();
    }

    return {
      metadataText,
      extractedText: pageText.join("\n").trim(),
    };
  } finally {
    await document?.destroy();
  }
}
