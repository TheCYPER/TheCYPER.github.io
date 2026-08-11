import type { CollectionEntry } from "astro:content";

export type LongformEntry =
  | CollectionEntry<"case-studies">
  | CollectionEntry<"articles">;

export type SupportedLanguage = LongformEntry["data"]["language"];

export function isPublished<T extends { data: { draft: boolean } }>(entry: T): boolean {
  return !entry.data.draft;
}

export function sortByPublishedDate<T extends LongformEntry>(entries: T[]): T[] {
  return [...entries].sort(
    (left, right) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function entrySlug(entry: LongformEntry): string {
  return entry.id.replace(/\.(md|mdx)$/i, "");
}

export function contentHref(entry: LongformEntry): string {
  const section = entry.collection === "case-studies" ? "work" : "writing";
  return `/${section}/${entrySlug(entry)}/`;
}

export function contentTypeLabel(entry: LongformEntry): string {
  if (entry.collection === "case-studies") {
    return "Case Study";
  }

  const labels: Record<CollectionEntry<"articles">["data"]["kind"], string> = {
    explainer: "Explainer",
    tutorial: "Tutorial",
    evaluation: "Evaluation",
    "field-note": "Field Note",
  };

  return labels[entry.data.kind];
}

export function formatDate(date: Date, language: SupportedLanguage = "en"): string {
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: language === "zh-CN" ? "2-digit" : "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function readingTime(body = ""): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~\[\]()-]/g, " ");
  const hanCount = (plain.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (plain.replace(/[\u3400-\u9fff]/g, " ").match(/[\p{L}\p{N}]+/gu) ?? [])
    .length;

  return Math.max(1, Math.ceil(hanCount / 500 + latinCount / 220));
}

export function relatedEntries(
  current: LongformEntry,
  entries: LongformEntry[],
  limit = 3,
): LongformEntry[] {
  const currentTopics = new Set(current.data.topics);

  return entries
    .filter(isPublished)
    .filter((candidate) => candidate.id !== current.id || candidate.collection !== current.collection)
    .map((candidate) => {
      const sharedTopics = candidate.data.topics.filter((topic) => currentTopics.has(topic)).length;
      const sharedCollection =
        current.data.collection && candidate.data.collection === current.data.collection ? 2 : 0;
      return { candidate, score: sharedTopics + sharedCollection };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.data.publishedAt.getTime() - left.candidate.data.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
