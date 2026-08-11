import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicRoot = path.join(projectRoot, "public");
const manifestPath = path.join(projectRoot, "src", "data", "release-assets.json");
const releaseAssets = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];

function resolvePublicAsset(value, label) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    errors.push(`${label} must be a root-relative public path`);
    return undefined;
  }

  const resolved = path.resolve(publicRoot, value.slice(1));
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    errors.push(`${label} resolves outside public/`);
    return undefined;
  }
  return resolved;
}

if (!releaseAssets.portrait || typeof releaseAssets.portrait !== "object") {
  errors.push("portrait is missing from src/data/release-assets.json");
} else {
  const { src, srcset, alt, width, height } = releaseAssets.portrait;
  const portraitPath = resolvePublicAsset(src, "portrait.src");
  if (!/\.webp$/i.test(src ?? "")) {
    errors.push("portrait.src must use the reviewed metadata-free WebP derivative");
  }
  if (typeof alt !== "string" || alt.trim().length === 0) {
    errors.push("portrait.alt must describe the approved portrait");
  }
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    errors.push("portrait width and height must be positive integers");
  }
  if (portraitPath) {
    try {
      await access(portraitPath);
    } catch {
      errors.push(`portrait file does not exist: ${src}`);
    }
  }

  const variants = typeof srcset === "string"
    ? srcset.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
  if (variants.length < 2) {
    errors.push("portrait.srcset must include the reviewed 480w and 900w derivatives");
  } else {
    const widths = new Set();
    for (const variant of variants) {
      const match = variant.match(/^(\/\S+\.webp)\s+(\d+)w$/i);
      if (!match) {
        errors.push(`portrait.srcset entry is invalid: ${variant}`);
        continue;
      }
      widths.add(Number(match[2]));
      const variantPath = resolvePublicAsset(match[1], `portrait.srcset ${match[2]}w`);
      if (variantPath) {
        try {
          await access(variantPath);
        } catch {
          errors.push(`portrait srcset file does not exist: ${match[1]}`);
        }
      }
    }
    if (!widths.has(480) || !widths.has(900)) {
      errors.push("portrait.srcset must include both 480w and 900w variants");
    }
  }
}

if (typeof releaseAssets.cvUrl !== "string" || releaseAssets.cvUrl.length === 0) {
  errors.push("redacted CV is missing from src/data/release-assets.json");
} else {
  const cvPath = resolvePublicAsset(releaseAssets.cvUrl, "cvUrl");
  if (!/^\/cv\/[^/]+\.pdf$/i.test(releaseAssets.cvUrl)) {
    errors.push("cvUrl must point to a PDF inside public/cv/");
  }
  if (cvPath) {
    try {
      await access(cvPath);
    } catch {
      errors.push(`CV file does not exist: ${releaseAssets.cvUrl}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Release asset gate failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Release asset gate passed: approved portrait and redacted CV are present.");
}
