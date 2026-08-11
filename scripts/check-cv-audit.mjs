import assert from "node:assert/strict";
import { extractPdfTextAndMetadata } from "./lib/cv-pdf.mjs";

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function createPdfFixture({ title, text }) {
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    `<< /Title (${escapePdfText(title)}) >>`,
  ];

  let source = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n`;
  source += "0000000000 65535 f \n";
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;
  source += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(source, "ascii");
}

const fixture = createPdfFixture({
  title: "Private Candidate",
  text: "PRIVATE_CV_TEST_MARKER_6F41",
});
const { metadataText, extractedText } = await extractPdfTextAndMetadata(fixture);

assert.match(metadataText, /Private Candidate/, "PDF metadata must be extracted for sensitive-text scanning");
assert.match(extractedText, /PRIVATE_CV_TEST_MARKER_6F41/, "rendered PDF text must be extracted for sensitive-text scanning");

console.log("CV PDF extraction contract passed: metadata and rendered text are both readable.");
