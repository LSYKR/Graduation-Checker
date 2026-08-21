import fs from "node:fs/promises";
import zlib from "node:zlib";
import XLSX from "xlsx";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];

if (!sourcePath) {
  console.error("Usage: node scripts/extract-hwp-paragraphs.mjs <source.hwp> [output.txt]");
  process.exit(1);
}

const cfb = XLSX.CFB.read(sourcePath, { type: "file" });
const headerIndex = cfb.FullPaths.findIndex((path) => path.endsWith("/FileHeader"));
const header = headerIndex >= 0 ? Buffer.from(cfb.FileIndex[headerIndex].content) : null;
const compressed = header && header.length >= 40 ? Boolean(header.readUInt32LE(36) & 1) : true;

function decodeParagraphText(payload) {
  return payload
    .toString("utf16le")
    .replace(/[\u0000-\u001f\uffff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSection(section) {
  const bytes = compressed ? zlib.inflateRawSync(section) : section;
  const paragraphs = [];
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const headerValue = bytes.readUInt32LE(offset);
    offset += 4;
    const tagId = headerValue & 0x3ff;
    let size = (headerValue >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (offset + 4 > bytes.length) break;
      size = bytes.readUInt32LE(offset);
      offset += 4;
    }
    if (offset + size > bytes.length) break;
    const payload = bytes.subarray(offset, offset + size);
    offset += size;
    // HWPTAG_PARA_TEXT = HWPTAG_BEGIN(0x10) + 51
    if (tagId !== 67) continue;
    const text = decodeParagraphText(payload);
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

const sectionIndexes = cfb.FullPaths
  .map((path, index) => ({ path, index }))
  .filter(({ path }) => /\/BodyText\/Section\d+$/.test(path))
  .sort((a, b) => Number(a.path.match(/Section(\d+)$/)?.[1] ?? 0) - Number(b.path.match(/Section(\d+)$/)?.[1] ?? 0));

if (!sectionIndexes.length) throw new Error("HWP BodyText/Section 스트림을 찾지 못했습니다.");

const paragraphs = sectionIndexes.flatMap(({ index }) => extractSection(Buffer.from(cfb.FileIndex[index].content)));
const text = `${paragraphs.join("\n")}\n`;
if (outputPath) {
  await fs.writeFile(outputPath, text, "utf8");
  console.log(`${outputPath} (${paragraphs.length} paragraphs)`);
} else {
  process.stdout.write(text);
}
