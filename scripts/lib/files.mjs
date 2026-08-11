import { readdir } from "node:fs/promises";
import path from "node:path";

export async function walkFiles(root, options = {}) {
  const { excludeDirectories = new Set(), include = () => true } = options;
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirectories.has(entry.name)) {
          await visit(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && include(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  await visit(root);
  return files;
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}
