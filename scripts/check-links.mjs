import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toPosixPath, walkFiles } from "./lib/files.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = path.join(projectRoot, "dist");
const siteOrigin = "https://thecyper.github.io";
const htmlFiles = await walkFiles(distRoot, {
  include: (file) => path.extname(file).toLowerCase() === ".html",
}).catch((error) => {
  if (error?.code === "ENOENT") {
    console.error("Link check needs a build first. Run `npm run build`, then retry.");
    process.exit(1);
  }
  throw error;
});

const pages = new Map();

function fileToUrl(file) {
  const relative = toPosixPath(path.relative(distRoot, file));
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

for (const file of htmlFiles) {
  const source = await readFile(file, "utf8");
  const ids = new Set([...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
  pages.set(fileToUrl(file), { file, source, ids });
}

function candidatePaths(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === "/") return [path.join(distRoot, "index.html")];
  const relative = decoded.replace(/^\/+/, "");
  if (decoded.endsWith("/")) return [path.join(distRoot, relative, "index.html")];
  if (path.extname(relative)) return [path.join(distRoot, relative)];
  return [path.join(distRoot, relative, "index.html"), path.join(distRoot, `${relative}.html`)];
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next static-output shape.
    }
  }
  return undefined;
}

const failures = [];
let checked = 0;
const attributePattern = /<(?:a|img|script|link|video|source)\b[^>]*?\b(?:href|src|poster)=["']([^"']+)["'][^>]*>/gi;

for (const [sourceUrl, page] of pages) {
  for (const match of page.source.matchAll(attributePattern)) {
    const reference = match[1].trim();
    if (
      !reference ||
      reference === "#" ||
      /^(?:https?:\/\/|mailto:|tel:|data:|javascript:)/i.test(reference)
    ) {
      continue;
    }

    let target;
    try {
      target = new URL(reference, `${siteOrigin}${sourceUrl}`);
    } catch {
      failures.push(`${sourceUrl}: invalid URL ${JSON.stringify(reference)}`);
      continue;
    }

    if (target.origin !== siteOrigin) continue;
    checked += 1;
    const targetFile = await firstExisting(candidatePaths(target.pathname));
    if (!targetFile) {
      failures.push(`${sourceUrl}: missing ${target.pathname} (from ${JSON.stringify(reference)})`);
      continue;
    }

    if (target.hash && path.extname(target.pathname).toLowerCase() !== ".svg") {
      const targetUrl = fileToUrl(targetFile);
      const targetPage = pages.get(targetUrl);
      const id = decodeURIComponent(target.hash.slice(1));
      if (targetPage && !targetPage.ids.has(id)) {
        failures.push(`${sourceUrl}: missing fragment ${target.pathname}${target.hash}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Internal link check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Internal link check passed: ${pages.size} HTML pages, ${checked} local references.`);
}
