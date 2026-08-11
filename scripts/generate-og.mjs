import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(projectRoot, "scripts", "assets", "default-og.svg");
const outputDirectory = path.join(projectRoot, "public", "og");
const output = path.join(outputDirectory, "default.png");

await mkdir(outputDirectory, { recursive: true });
await sharp(source).png({ compressionLevel: 9, palette: true }).toFile(output);
console.log(`Generated ${path.relative(projectRoot, output)} (1200×630).`);
