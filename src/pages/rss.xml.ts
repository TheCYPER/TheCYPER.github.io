import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { siteConfig } from "../config/site";
import {
  contentHref,
  isPublished,
  sortByPublishedDate,
  type LongformEntry,
} from "../utils/content";

export async function GET(context: { site?: URL }) {
  const [caseStudies, articles] = await Promise.all([
    getCollection("case-studies", isPublished),
    getCollection("articles", isPublished),
  ]);
  const entries = sortByPublishedDate<LongformEntry>([...caseStudies, ...articles]);

  return rss({
    title: `${siteConfig.title} — Research notes`,
    description: siteConfig.description,
    site: context.site ?? siteConfig.siteUrl,
    customData: "<language>en-us</language>",
    items: entries.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.publishedAt,
      link: contentHref(entry),
      categories: entry.data.topics,
      customData: `<language>${entry.data.language}</language>`,
    })),
  });
}
