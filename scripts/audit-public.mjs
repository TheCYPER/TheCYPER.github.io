import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfTextAndMetadata } from "./lib/cv-pdf.mjs";
import { publicationStateMatchesDraft } from "./lib/publication-state.mjs";
import { toPosixPath, walkFiles } from "./lib/files.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([
  ".git",
  ".astro",
  ".cache",
  ".gstack",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
  ".xml",
]);
const forbiddenExtensions = new Set([
  ".7z",
  ".blend",
  ".bvh",
  ".cache",
  ".ckpt",
  ".db",
  ".doc",
  ".docx",
  ".fbx",
  ".gz",
  ".ma",
  ".mb",
  ".npy",
  ".npz",
  ".onnx",
  ".pkl",
  ".pt",
  ".pth",
  ".rar",
  ".safetensors",
  ".sqlite",
  ".sqlite3",
  ".tar",
  ".tgz",
  ".uasset",
  ".umap",
  ".zip",
]);
const mediaExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".png",
  ".webm",
  ".webp",
]);
const approvedEmails = new Set(["che.liu@mbzuai.ac.ae"]);
const perMediaBudget = 10 * 1024 * 1024;
const totalMediaBudget = 100 * 1024 * 1024;
const incompleteContractValuePattern =
  /(?:^|[^a-z0-9])(?:pending|placeholder|todo|tbd|unknown|unverified|not[-_\s]+(?:independently[-_\s]+)?verified)(?:[^a-z0-9]|$)/i;
const articleMediaExtension = "(?:avif|gif|jpe?g|m4v|mov|mp4|png|svg|webm|webp)";
const absoluteArticleMediaPattern = new RegExp(
  `(?<=["'\`(])/[a-z0-9][a-z0-9._~!$&*+,;=:@%/-]*\\.${articleMediaExtension}(?:[?#][^"'\`()\\s]*)?`,
  "gi",
);
const relativeArticleMediaPattern = new RegExp(
  `(?<=["'\`(])(?:\\.{1,2}/)+[a-z0-9][a-z0-9._~!$&*+,;=:@%/-]*\\.${articleMediaExtension}(?:[?#][^"'\`()\\s]*)?`,
  "gi",
);
const embeddedArticleMediaPattern = /data:(?:image|video)\//i;
const remoteArticleMediaAttributePattern =
  /\b(?:mp4Src|poster|reducedMotionSrc|src|webmSrc)\s*=\s*["']https?:\/\//i;
const dynamicArticleMediaAttributePattern =
  /<(?:Figure|VideoFigure|img|source|video)\b[^>]*\b(?:mp4Src|poster|reducedMotionSrc|src|webmSrc)\s*=\s*\{/i;

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["GitHub token", /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/g],
  ["OpenAI-style token", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
];
const privacyPatterns = [
  ["private IPv4 address", /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g],
  ["Windows user path", /\b[A-Za-z]:\\Users\\[^\\\s"'<>]+/g],
  ["Windows absolute work path", /\b[A-Za-z]:\\(?:WorkSpace|datasets|models|wsl)\\[^\s"'<>]*/g],
  ["Unix user path", /\/(?:home|Users)\/[A-Za-z0-9._-]+\/(?:[^\s"'<>]*)?/g],
];
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const internationalPhonePattern = /(?:^|[^\w+])(\+(?:[\s().-]*\d){7,15})(?!\d)/g;

const files = await walkFiles(projectRoot, { excludeDirectories: ignoredDirectories });
const errors = [];
const warnings = [];
let totalMediaBytes = 0;

function relative(file) {
  return toPosixPath(path.relative(projectRoot, file));
}

function addError(file, message) {
  errors.push(`${relative(file)}: ${message}`);
}

async function verifyMediaDigest(file, asset, locationLabel) {
  try {
    const digest = createHash("sha256").update(await readFile(file)).digest("hex");
    if (digest !== asset.sha256) {
      addError(file, `${locationLabel} SHA-256 does not match src/data/public-media.json`);
    }
  } catch (error) {
    addError(file, `${locationLabel} media file is missing or unreadable (${error.message})`);
  }
}

async function auditPublicMediaContract() {
  const contractFile = path.join(projectRoot, "src", "data", "public-media.json");
  const approvedAssets = new Map();
  let contract;

  try {
    contract = JSON.parse(await readFile(contractFile, "utf8"));
  } catch (error) {
    addError(contractFile, `cannot read the public media contract (${error.message})`);
    return approvedAssets;
  }

  if (contract.version !== 1 || !Array.isArray(contract.assets)) {
    addError(contractFile, "expected version 1 with an assets array");
    return approvedAssets;
  }

  for (const field of ["permissionRecord", "licenseBoundary"]) {
    const value = contract[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      addError(contractFile, `top-level ${field} must be a non-empty string`);
    } else if (incompleteContractValuePattern.test(value)) {
      addError(contractFile, `top-level ${field} contains an incomplete review marker`);
    }
  }

  for (const [index, asset] of contract.assets.entries()) {
    const requiredStrings = [
      "path",
      "article",
      "articleId",
      "mediaItemId",
      "kind",
      "owner",
      "source",
      "permissionEvidence",
      "upstreamBoundary",
      "redactionReview",
      "releaseEvidence",
      "decision",
      "sha256",
    ];
    const evidenceFields = [
      "owner",
      "source",
      "permissionEvidence",
      "upstreamBoundary",
      "redactionReview",
      "releaseEvidence",
    ];
    const assetLabel = typeof asset?.path === "string" ? asset.path : `entry ${index + 1}`;
    let hasMissingField = false;

    for (const field of requiredStrings) {
      if (typeof asset?.[field] !== "string" || asset[field].trim().length === 0) {
        addError(contractFile, `${assetLabel} is missing non-empty ${field}`);
        hasMissingField = true;
      }
    }

    if (hasMissingField) {
      continue;
    }

    for (const field of evidenceFields) {
      if (incompleteContractValuePattern.test(asset[field])) {
        addError(contractFile, `${asset.path} ${field} contains an incomplete review marker`);
      }
    }

    if (!/^\/media\/articles\/[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/i.test(asset.path)) {
      addError(contractFile, `invalid public media path ${JSON.stringify(asset.path)}`);
      continue;
    }

    if (!/^[a-z0-9][a-z0-9-]*$/.test(asset.articleId)) {
      addError(contractFile, `${asset.path} has an invalid articleId`);
    }

    if (!/^[a-z0-9][a-z0-9-]*$/.test(asset.mediaItemId)) {
      addError(contractFile, `${asset.path} has an invalid mediaItemId`);
    }

    if (!/^\/[a-z0-9][a-z0-9/-]*\/$/.test(asset.article)) {
      addError(contractFile, `${asset.path} has an invalid article route`);
    } else {
      const routeArticleId = asset.article.split("/").filter(Boolean).at(-1);
      if (routeArticleId !== asset.articleId) {
        addError(contractFile, `${asset.path} articleId does not match its article route`);
      }
    }

    if (asset.decision !== "approved-for-publication") {
      addError(contractFile, `${asset.path} is not approved-for-publication`);
    }

    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) {
      addError(contractFile, `${asset.path} has an invalid SHA-256`);
      continue;
    }

    if (approvedAssets.has(asset.path)) {
      addError(contractFile, `duplicate media path ${asset.path}`);
      continue;
    }
    approvedAssets.set(asset.path, asset);

    const file = path.join(projectRoot, "public", ...asset.path.slice(1).split("/"));
    await verifyMediaDigest(file, asset, "public source");
  }

  for (const file of files) {
    const publicPath = relative(file);
    if (!publicPath.startsWith("public/media/")) continue;
    const contractPath = `/${publicPath.slice("public/".length)}`;
    if (!approvedAssets.has(contractPath)) {
      addError(file, "public media is missing from src/data/public-media.json");
    }
  }

  return approvedAssets;
}

function auditContentMediaReferences(file, source, approvedAssets) {
  const extension = path.extname(file);
  const articleId = path.basename(file, extension);
  const references = new Set(
    [...source.matchAll(absoluteArticleMediaPattern)].map((match) =>
      match[0].replace(/[.,;:]+$/, ""),
    ),
  );

  for (const reference of references) {
    if (!reference.startsWith("/media/")) {
      addError(
        file,
        `article media ${JSON.stringify(reference)} must live under /media/ and be declared in src/data/public-media.json`,
      );
      continue;
    }

    const asset = approvedAssets.get(reference);
    if (!asset) {
      addError(file, `local media reference ${JSON.stringify(reference)} is missing from src/data/public-media.json`);
      continue;
    }

    if (asset.articleId !== articleId) {
      addError(
        file,
        `local media reference ${JSON.stringify(reference)} belongs to articleId ${JSON.stringify(asset.articleId)}`,
      );
    }
  }

  for (const match of source.matchAll(relativeArticleMediaPattern)) {
    addError(
      file,
      `relative article media ${JSON.stringify(match[0])} is prohibited; use a contracted /media/ path`,
    );
  }

  if (embeddedArticleMediaPattern.test(source)) {
    addError(file, "embedded data:image or data:video media is prohibited in article content");
  }

  if (remoteArticleMediaAttributePattern.test(source)) {
    addError(file, "remote image or video embedding is prohibited; link externally or use a contracted /media/ asset");
  }

  if (dynamicArticleMediaAttributePattern.test(source)) {
    addError(file, "dynamic article media props are prohibited; use a literal contracted /media/ path");
  }
}

async function auditBuiltMediaContract(distFiles, approvedAssets) {
  const seenBuiltMedia = new Set();

  for (const file of distFiles) {
    const distPath = toPosixPath(path.relative(path.join(projectRoot, "dist"), file));
    if (!distPath.startsWith("media/")) continue;

    const contractPath = `/${distPath}`;
    const asset = approvedAssets.get(contractPath);
    if (!asset) {
      addError(file, "built media is missing from src/data/public-media.json");
      continue;
    }

    seenBuiltMedia.add(contractPath);
    await verifyMediaDigest(file, asset, "built output");
  }

  for (const [contractPath, asset] of approvedAssets) {
    if (seenBuiltMedia.has(contractPath)) continue;
    const file = path.join(projectRoot, "dist", ...contractPath.slice(1).split("/"));
    addError(file, `${asset.mediaItemId} is approved but missing from the fresh build output`);
  }
}

function frontmatter(source) {
  if (!source.startsWith("---")) return "";
  const end = source.indexOf("\n---", 3);
  return end === -1 ? "" : source.slice(3, end);
}

function auditPublicationState(file, source) {
  const metadata = frontmatter(source);
  const state = metadata.match(/^publicationState:\s*([^\s#]+)\s*$/m)?.[1] ?? "approved-for-publication";
  const draft = metadata.match(/^draft:\s*(true|false)\s*$/m)?.[1] === "true";
  if (!publicationStateMatchesDraft(state, draft)) {
    addError(file, `publicationState ${JSON.stringify(state)} is incompatible with draft: ${draft}`);
  }
}

function scanSensitiveText(file, source, prefix = "") {
  for (const [label, pattern] of [...secretPatterns, ...privacyPatterns]) {
    pattern.lastIndex = 0;
    const match = pattern.exec(source);
    if (match) {
      addError(file, `${prefix}${label} candidate: ${JSON.stringify(match[0].slice(0, 80))}`);
    }
  }

  emailPattern.lastIndex = 0;
  for (const match of source.matchAll(emailPattern)) {
    const email = match[0].toLowerCase();
    if (!approvedEmails.has(email)) {
      addError(file, `${prefix}unapproved email address: ${JSON.stringify(email)}`);
      break;
    }
  }
}

function scanCvPhoneNumbers(file, source, prefix) {
  internationalPhonePattern.lastIndex = 0;
  const match = internationalPhonePattern.exec(source);
  if (!match) return;

  const digitCount = match[1].replace(/\D/g, "").length;
  addError(file, `${prefix}international phone number candidate (${digitCount} digits)`);
}

async function auditCvPdf(file) {
  const bytes = await readFile(file);
  scanSensitiveText(file, bytes.toString("latin1"), "CV raw bytes contain ");

  try {
    const { metadataText, extractedText } = await extractPdfTextAndMetadata(bytes);
    scanSensitiveText(file, metadataText, "CV metadata contains ");
    scanCvPhoneNumbers(file, metadataText, "CV metadata contains ");

    const metadataSummary = JSON.parse(metadataText.split("\n", 1)[0]);
    if (!/^en(?:-|$)/i.test(metadataSummary.Language ?? "")) {
      addError(file, `CV document language must be English; found ${JSON.stringify(metadataSummary.Language ?? null)}`);
    }

    if (extractedText.length === 0) {
      if (process.env.CV_MANUAL_REVIEWED === "true") {
        warnings.push(`${relative(file)}: no extractable PDF text; accepted by explicit manual CV review`);
      } else {
        addError(file, "CV has no extractable text; a signed manual review is required before release");
      }
    } else {
      scanSensitiveText(file, extractedText, "CV extracted text contains ");
      scanCvPhoneNumbers(file, extractedText, "CV extracted text contains ");
    }
  } catch (error) {
    if (process.env.CV_MANUAL_REVIEWED === "true") {
      warnings.push(`${relative(file)}: PDF extraction failed; accepted by explicit manual CV review (${error.message})`);
    } else {
      addError(file, `CV PDF extraction failed; a signed manual review is required before release (${error.message})`);
    }
  }
}

const approvedPublicMedia = await auditPublicMediaContract();

for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  const fileStat = await stat(file);
  const publicPath = relative(file);

  if (forbiddenExtensions.has(extension)) {
    addError(file, `forbidden public asset type ${extension}`);
  }

  if (mediaExtensions.has(extension)) {
    totalMediaBytes += fileStat.size;
    if (fileStat.size > perMediaBudget) {
      addError(file, `media file is ${(fileStat.size / 1024 / 1024).toFixed(1)} MB; limit is 10 MB`);
    }
    if (/(^|\/)(?:internal|screenshots?|raw-jobs?)(\/|[-_.])/i.test(publicPath)) {
      addError(file, "media filename or directory indicates an internal or raw artifact");
    }
  }

  if (extension === ".pdf" && publicPath.startsWith("public/cv/")) {
    await auditCvPdf(file);
  }

  if (!textExtensions.has(extension) && !["LICENSE", ".gitignore", ".nvmrc"].includes(path.basename(file))) {
    continue;
  }

  const source = await readFile(file, "utf8");
  scanSensitiveText(file, source);

  if (/^src\/content\/(?:case-studies|articles)\//.test(publicPath) && [".md", ".mdx"].includes(extension)) {
    auditPublicationState(file, source);
  }

  if (/^src\/content\//.test(publicPath) && [".md", ".mdx"].includes(extension)) {
    auditContentMediaReferences(file, source, approvedPublicMedia);
  }

  if ([".md", ".mdx"].includes(extension) && /!\[\s*\]\([^)]+\)/g.test(source)) {
    addError(file, "Markdown image is missing alt text");
  }

  if ([".astro", ".html", ".mdx"].includes(extension)) {
    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt\s*=/.test(match[0])) {
        addError(file, "<img> is missing an alt attribute");
        break;
      }
    }

    for (const match of source.matchAll(/<video\b[^>]*>/gi)) {
      if (!/\baria-label\s*=/.test(match[0]) && !/\baria-labelledby\s*=/.test(match[0])) {
        addError(file, "<video> is missing an accessible label");
        break;
      }
    }

    for (const match of source.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
      if (!/\brel=["'][^"']*noreferrer[^"']*["']/.test(match[0])) {
        addError(file, "target=_blank link is missing rel=noreferrer");
        break;
      }
    }
  }
}

const distDirectory = path.join(projectRoot, "dist");
try {
  const distFiles = await walkFiles(distDirectory);
  for (const file of distFiles) {
    const extension = path.extname(file).toLowerCase();
    if (!textExtensions.has(extension)) continue;
    const source = await readFile(file, "utf8");
    scanSensitiveText(file, source, "built output contains ");
  }
  await auditBuiltMediaContract(distFiles, approvedPublicMedia);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  errors.push("dist is missing; run a fresh production build before the public audit");
}

if (totalMediaBytes > totalMediaBudget) {
  errors.push(
    `public media totals ${(totalMediaBytes / 1024 / 1024).toFixed(1)} MB; budget is 100 MB`,
  );
}

if (errors.length > 0) {
  console.error("Public audit failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  for (const warning of warnings) console.warn(`Public audit warning: ${warning}`);
  console.log(
    `Public audit passed: ${files.length} files scanned; ${(totalMediaBytes / 1024 / 1024).toFixed(1)} MB media.`,
  );
}
