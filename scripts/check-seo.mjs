import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toPosixPath, walkFiles } from "./lib/files.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = path.join(projectRoot, "dist");
const failures = [];
const expectedPublicRoutes = [
  "/",
  "/projects/",
  "/research/",
  "/research/ai-animation/",
  "/work/",
  "/work/animgen-runtime-pose-generation/",
  "/work/kimodo-capability-boundaries/",
  "/work/robust-motion-in-between/",
  "/work/ue-58-mcp-reliability/",
  "/writing/",
  "/writing/ai-animation-technology-map/",
];
const expectedHtmlRoutes = [...expectedPublicRoutes, "/404.html"].sort();
const mustBeAbsent = [
  "/about/",
  "/notes/",
  "/work/kimodo-maya-authoring-system/",
  "/writing/rebuilding-kimodo-fine-tuning-pipeline-interx/",
];
const approvedSameAs = [
  "https://github.com/TheCYPER",
  "https://linkedin.com/in/che-percy-liu",
];
const expectedAiAnimationEntries = [
  "/work/kimodo-capability-boundaries/",
  "/work/robust-motion-in-between/",
  "/writing/ai-animation-technology-map/",
  "/work/animgen-runtime-pose-generation/",
];

function pageUrl(file) {
  const relative = toPosixPath(path.relative(distRoot, file));
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

function values(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function fail(url, message) {
  failures.push(`${url}: ${message}`);
}

let htmlFiles;
try {
  htmlFiles = await walkFiles(distRoot, {
    include: (file) => path.extname(file).toLowerCase() === ".html",
  });
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error("SEO check needs a fresh build first. Run `npm run build`, then retry.");
    process.exit(1);
  }
  throw error;
}

for (const file of htmlFiles) {
  const source = await readFile(file, "utf8");
  const url = pageUrl(file);
  const titles = values(source, /<title>([\s\S]*?)<\/title>/gi);
  const descriptions = values(source, /<meta\s+name="description"\s+content="([^"]+)"\s*\/?\s*>/gi);
  const canonicals = values(source, /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?\s*>/gi);
  const languages = values(source, /<html\s+lang="([^"]+)"/gi);
  const h1Count = (source.match(/<h1(?:\s|>)/gi) ?? []).length;
  const ogImages = values(source, /<meta\s+property="og:image"\s+content="([^"]+)"\s*\/?\s*>/gi);
  const ogLocales = values(source, /<meta\s+property="og:locale"\s+content="([^"]+)"\s*\/?\s*>/gi);
  const publishedTimes = values(source, /<meta\s+property="article:published_time"\s+content="([^"]+)"\s*\/?\s*>/gi);
  const modifiedTimes = values(source, /<meta\s+property="article:modified_time"\s+content="([^"]+)"\s*\/?\s*>/gi);
  const jsonLdBlocks = values(
    source,
    /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  );

  if (titles.length !== 1 || !titles[0].trim()) fail(url, "expected one non-empty title");
  if (descriptions.length !== 1 || !descriptions[0].trim()) fail(url, "expected one meta description");
  if (canonicals.length !== 1) fail(url, "expected one canonical URL");
  if (languages.length !== 1 || !["en", "zh-CN"].includes(languages[0])) fail(url, "html lang must be en or zh-CN");
  const expectedOgLocale = languages[0] === "zh-CN" ? "zh_CN" : "en_US";
  if (ogLocales.length !== 1 || ogLocales[0] !== expectedOgLocale) {
    fail(url, `og:locale must be ${expectedOgLocale}`);
  }
  if (h1Count !== 1) fail(url, `expected one H1, found ${h1Count}`);
  if (jsonLdBlocks.length !== 1) {
    fail(url, `expected one JSON-LD block, found ${jsonLdBlocks.length}`);
  } else {
    try {
      const data = JSON.parse(jsonLdBlocks[0]);
      const types = (Array.isArray(data) ? data : [data]).map((item) => item?.["@type"]);
      if (url === "/") {
        if (!types.includes("ProfilePage")) fail(url, "homepage JSON-LD must be ProfilePage");
        if (data.mainEntity?.["@type"] !== "Person") fail(url, "ProfilePage mainEntity must be Person");
        const sameAs = [...(data.mainEntity?.sameAs ?? [])].sort();
        if (JSON.stringify(sameAs) !== JSON.stringify([...approvedSameAs].sort())) {
          fail(url, "Person.sameAs must contain only the approved GitHub and LinkedIn URLs");
        }
      }
      if (/^\/(?:work|writing)\/[^/]+\/$/.test(url)) {
        if (!types.includes("TechArticle")) fail(url, "longform JSON-LD must be TechArticle");
        if (data.inLanguage !== languages[0]) fail(url, "TechArticle.inLanguage must match html lang");
        if (data.mainEntityOfPage !== canonicals[0]) fail(url, "TechArticle mainEntityOfPage must match canonical");
        if (data.datePublished !== publishedTimes[0]) fail(url, "TechArticle datePublished must match article meta");
        const expectedModified = modifiedTimes[0] ?? publishedTimes[0];
        if (data.dateModified !== expectedModified) fail(url, "TechArticle dateModified must match article meta");
      }
    } catch (error) {
      fail(url, `JSON-LD is not valid JSON (${error.message})`);
    }
  }

  if (ogImages.length !== 1) {
    fail(url, "expected one Open Graph image");
  } else {
    const pathname = new URL(ogImages[0], "https://thecyper.github.io").pathname;
    const target = path.join(distRoot, pathname.replace(/^\/+/, ""));
    try {
      await access(target);
    } catch {
      fail(url, `Open Graph image does not exist: ${pathname}`);
    }
  }

  if (/AI Research Lab|Evidence Index/i.test(source)) fail(url, "retired site branding leaked into output");

  if (url === "/research/ai-animation/") {
    const cards = [...source.matchAll(
      /<article class="[^"]*\barticle-card--row\b[^"]*">([\s\S]*?)<\/article>/gi,
    )].map((match) => match[1]);

    if (cards.length !== expectedAiAnimationEntries.length) {
      fail(url, `expected ${expectedAiAnimationEntries.length} linked archive rows, found ${cards.length}`);
    }

    const cardLinks = cards.map((card) => {
      const anchorAttributes = card.match(/<a\b([^>]*)>/i)?.[1] ?? "";
      const href = anchorAttributes.match(/\bhref="([^"]+)"/i)?.[1];
      const classes = (anchorAttributes.match(/\bclass="([^"]+)"/i)?.[1] ?? "").split(/\s+/);
      return { href, hasRowLinkClass: classes.includes("article-card__link") };
    });

    if (JSON.stringify(cardLinks.map(({ href }) => href)) !== JSON.stringify(expectedAiAnimationEntries)) {
      fail(url, `archive row links must be ${expectedAiAnimationEntries.join(", ")}`);
    }

    cardLinks.forEach(({ href, hasRowLinkClass }) => {
      if (!hasRowLinkClass) fail(url, `${href ?? "unknown entry"} does not expose the full-row link target`);
    });
  }
}

const actualHtmlRoutes = htmlFiles.map(pageUrl).sort();
if (JSON.stringify(actualHtmlRoutes) !== JSON.stringify(expectedHtmlRoutes)) {
  failures.push(`HTML route set mismatch; expected ${expectedHtmlRoutes.join(", ")}; received ${actualHtmlRoutes.join(", ")}`);
}

for (const route of mustBeAbsent) {
  if (actualHtmlRoutes.includes(route)) failures.push(`${route}: forbidden route was generated`);
}

try {
  await access(path.join(distRoot, "about", "index.html"));
  failures.push("/about/: retired page is still generated");
} catch {
  // Expected: About was removed rather than redirected.
}

const draftSources = await walkFiles(path.join(projectRoot, "src", "content"), {
  include: (file) => [".md", ".mdx"].includes(path.extname(file).toLowerCase()),
});
const draftEntries = [];
for (const file of draftSources) {
  const source = await readFile(file, "utf8");
  if (/^draft:\s*true\s*$/m.test(source)) {
    const rawTitle = source.match(/^title:\s*(.+)\s*$/m)?.[1] ?? "";
    draftEntries.push({
      slug: path.basename(file, path.extname(file)),
      title: rawTitle.replace(/^["']|["']$/g, ""),
    });
  }
}
const builtTextFiles = await walkFiles(distRoot, {
  include: (file) => [".html", ".xml"].includes(path.extname(file).toLowerCase()),
});
for (const file of builtTextFiles) {
  const source = await readFile(file, "utf8");
  for (const entry of draftEntries) {
    if (source.includes(entry.slug) || (entry.title && source.includes(entry.title))) {
      failures.push(`${toPosixPath(path.relative(distRoot, file))}: draft metadata leaked: ${entry.slug}`);
    }
  }
}

const sitemapSource = await readFile(path.join(distRoot, "sitemap-0.xml"), "utf8");
const sitemapRoutes = values(sitemapSource, /<loc>([^<]+)<\/loc>/gi)
  .map((value) => new URL(value).pathname)
  .sort();
if (JSON.stringify(sitemapRoutes) !== JSON.stringify([...expectedPublicRoutes].sort())) {
  failures.push(`sitemap route set mismatch; received ${sitemapRoutes.join(", ")}`);
}

const rssSource = await readFile(path.join(distRoot, "rss.xml"), "utf8");
const rssItemCount = (rssSource.match(/<item>/g) ?? []).length;
if (rssItemCount !== 5) failures.push(`rss.xml: expected 5 published items, found ${rssItemCount}`);

if (failures.length > 0) {
  console.error("SEO check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`SEO check passed: ${htmlFiles.length} HTML pages; ${draftEntries.length} draft entries excluded.`);
}
