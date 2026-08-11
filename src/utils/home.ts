import type { CollectionEntry } from "astro:content";
import { entrySlug, isPublished, type LongformEntry } from "./content";

const expectedHomepageLongform = [
  "kimodo-capability-boundaries",
  "animgen-runtime-pose-generation",
] as const;

const expectedHomepageQuestions = [
  "hardware-agent-harness",
  "kimodo-martial-arts-adapter",
  "agent-native-zero-people-company",
] as const;

function assertContinuousOrder(
  items: { id: string; order: number }[],
  expectedIds: readonly string[],
  label: string,
) {
  const orders = items.map(({ order }) => order);
  const expectedOrders = items.map((_, index) => index + 1);
  const ids = items.map(({ id }) => id);

  if (
    items.length !== expectedIds.length ||
    new Set(orders).size !== orders.length ||
    orders.some((order, index) => order !== expectedOrders[index]) ||
    ids.some((id, index) => id !== expectedIds[index])
  ) {
    throw new Error(
      `${label} contract failed. Expected ${expectedIds
        .map((id, index) => `${index + 1}:${id}`)
        .join(", ")}; received ${items.map(({ id, order }) => `${order}:${id}`).join(", ") || "none"}.`,
    );
  }
}

export function selectHomepageLongform(entries: LongformEntry[]): LongformEntry[] {
  const selected = entries
    .filter(isPublished)
    .filter(({ data }) => data.homepage)
    .sort((left, right) => left.data.homepage!.order - right.data.homepage!.order);

  assertContinuousOrder(
    selected.map((entry) => ({ id: entrySlug(entry), order: entry.data.homepage!.order })),
    expectedHomepageLongform,
    "Homepage longform",
  );

  return selected;
}

export function selectHomepageQuestions(
  entries: CollectionEntry<"research-questions">[],
): CollectionEntry<"research-questions">[] {
  const selected = entries
    .filter(({ data }) => data.status === "active" && data.homepage)
    .sort((left, right) => left.data.order - right.data.order);

  assertContinuousOrder(
    selected.map((entry) => ({ id: entry.id, order: entry.data.order })),
    expectedHomepageQuestions,
    "Homepage research questions",
  );

  return selected;
}

export function selectPublishedNews(
  entries: CollectionEntry<"news">[],
): CollectionEntry<"news">[] {
  return entries
    .filter(isPublished)
    .sort((left, right) => right.data.date.getTime() - left.data.date.getTime());
}
