import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const heroSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().min(1).optional(),
  credit: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
});

const experimentSchema = z.object({
  period: z.string().min(1),
  software: z.array(z.string().min(1)).min(1),
  hardware: z.array(z.string().min(1)).min(1),
});

const verificationSchema = z.object({
  verified: z.array(z.string().min(1)).min(1),
  notVerified: z.array(z.string().min(1)).default([]),
});

const licenseSchema = z.object({
  asset: z.string().min(1),
  status: z.enum(["owned", "permitted", "linked-only", "replaced"]),
  note: z.string().min(1).optional(),
});

const languageSchema = z.enum(["en", "zh-CN"]);

const publicationStateSchema = z.enum([
  "planned-after-claim-and-rights-review",
  "approved-for-publication",
]).default("approved-for-publication");

function enforcePublicationState(
  data: {
    draft: boolean;
    publicationState: "planned-after-claim-and-rights-review" | "approved-for-publication";
  },
  context: z.RefinementCtx,
) {
  const expectedDraft = data.publicationState === "planned-after-claim-and-rights-review";
  if (data.draft !== expectedDraft) {
    context.addIssue({
      code: "custom",
      path: ["draft"],
      message:
        data.publicationState === "planned-after-claim-and-rights-review"
          ? "Planned content must remain draft: true until claim and rights review is approved."
          : "Approved content must use draft: false.",
    });
  }
}

const seriesSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
});

const homepageVisualSchema = z.enum([
  "kimodo-motion-field",
  "animgen-latent-loop",
]);

const homepageSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  visual: homepageVisualSchema,
  visualCaption: z.string().min(1),
});

const baseContentFields = {
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  publicationState: publicationStateSchema,
  language: languageSchema,
  series: seriesSchema.optional(),
  homepage: homepageSchema.optional(),
  collection: z.string().min(1).optional(),
  topics: z.array(z.string().min(1)).min(1),
  featured: z.boolean().default(false),
  hero: heroSchema.optional(),
  projectUrl: z.url().optional(),
  repoUrl: z.url().optional(),
  experiment: experimentSchema,
  verification: verificationSchema,
  licenses: z.array(licenseSchema).default([]),
};

const caseStudies = defineCollection({
  loader: glob({ base: "./src/content/case-studies", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      ...baseContentFields,
      problem: z.string().min(1),
      role: z.string().min(1),
      duration: z.string().min(1),
      stack: z.array(z.string().min(1)).min(1),
      outcomes: z.array(z.string().min(1)).min(1),
    })
    .superRefine(enforcePublicationState),
});

const articles = defineCollection({
  loader: glob({ base: "./src/content/articles", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      ...baseContentFields,
      kind: z.enum(["explainer", "tutorial", "evaluation", "field-note"]),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      prerequisites: z.array(z.string().min(1)).default([]),
    })
    .superRefine(enforcePublicationState),
});

const researchCollections = defineCollection({
  loader: glob({
    base: "./src/content/research-collections",
    pattern: "**/*.{json,yaml,yml}",
  }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    eyebrow: z.string().min(1),
    status: z.enum(["active", "archived"]),
    topics: z.array(z.string().min(1)).min(1),
    featured: z.boolean().default(false),
    order: z.number().int().nonnegative().default(0),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{json,yaml,yml}" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    url: z.url(),
    repoUrl: z.url().optional(),
    stack: z.array(z.string().min(1)).min(1),
    status: z.enum(["shipped", "active", "archived"]),
    draft: z.boolean().default(false),
    role: z.string().min(1).optional(),
    contributions: z.array(z.string().min(1)).default([]),
    featured: z.boolean().default(false),
    year: z.number().int().min(2000).max(2100).optional(),
    topics: z.array(z.string().min(1)).default([]),
    image: heroSchema.optional(),
  }),
});

const researchQuestions = defineCollection({
  loader: glob({
    base: "./src/content/research-questions",
    pattern: "**/*.{json,yaml,yml}",
  }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    status: z.enum(["active", "future", "archived"]),
    homepage: z.boolean().default(false),
    order: z.number().int().positive(),
    topics: z.array(z.string().min(1)).min(1),
    href: z.string().min(1).optional(),
  }),
});

const news = defineCollection({
  loader: file("./src/content/news.json"),
  schema: z.object({
    date: z.coerce.date(),
    title: z.string().min(1),
    summary: z.string().min(1),
    url: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  "case-studies": caseStudies,
  articles,
  "research-collections": researchCollections,
  "research-questions": researchQuestions,
  projects,
  news,
};
