# Che (Percy) Liu — personal research site

An English-first academic homepage and technical notebook for Che (Percy) Liu,
an MBZUAI undergraduate and student researcher working on AI agents, game
technology, and developer tools. The site is static, evidence-aware, and
intentionally separates open research questions from completed case studies.

Production URL: <https://thecyper.github.io/>

## Stack

- Astro 7 + strict TypeScript, statically generated
- Build-time Content Collections and Markdown/MDX
- Local Source Serif 4, IBM Plex Sans, IBM Plex Mono, and Noto SC fonts
- RSS, sitemap, canonical metadata, Open Graph, and JSON-LD
- GitHub Actions + GitHub Pages

There is no database, CMS, runtime GitHub API, analytics service, or required
client-side JavaScript.

## Local development

Node.js 24 is recommended (minimum 22.12).

```bash
git clone https://github.com/TheCYPER/TheCYPER.github.io.git
cd TheCYPER.github.io
npm ci
npm run dev
```

Quality commands:

```bash
npm run check          # Astro/TypeScript/schema + publication-state fixtures
npm run build          # Fresh static output in dist/
npm run audit:public   # Secrets, private paths, restricted assets, publication state
npm run check:links    # Internal routes and fragments in fresh dist/
npm run check:release  # Release-only portrait and CV asset gate
npm run check:seo      # H1, language, canonical, JSON-LD, OG, and draft leakage
npm run validate       # Runs the complete gate in the required order
npm audit --omit=dev   # Production dependency security audit
```

## Information architecture

```text
/
├── research/                    # Current/future questions + evidence archives
├── work/                        # Outcome-oriented case studies
├── projects/                    # Verified public products and repositories
├── writing/                     # Reader label: Notes; canonical stays /writing/
├── rss.xml
└── 404.html
```

Content sources:

```text
src/content/
├── case-studies/                # /work/<slug>/
├── articles/                    # /writing/<slug>/
├── research-collections/        # Evidence archive configuration
├── research-questions/          # Questions; no empty detail pages
├── projects/                    # Verified public projects
└── news.json                    # Empty until a dated public fact is verified
```

Longform frontmatter uses page-level `language`, explicit `publicationState`,
and `draft`. The build contract is bidirectional:

- `approved-for-publication` requires `draft: false`.
- `planned-after-claim-and-rights-review` requires `draft: true`.

Drafts never enter Home, indexes, related content, series navigation, RSS, or
sitemap output. A `homepage` block is curated metadata, not a generic featured
flag; the build asserts the exact two selected case studies and exact three
active research questions.

## Publishing and rights

Raw internship folders are not copied into this repository. Before any content
or media is added, separately review authorship, code license, model terms,
dataset terms, generated-output rights, personal data, and redistribution
permission. Do not commit weights, datasets, Unreal assets, FBX/BVH/NPZ files,
raw generation jobs, evaluation packages, internal screenshots, or archives.

The MIT license applies to original site code only. Editorial content and
original media remain all-rights-reserved unless a file says otherwise; see
[`CONTENT_RIGHTS.md`](./CONTENT_RIGHTS.md) and
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Release gate

Local completion is not deployment approval. Public release additionally
requires an authorized portrait, a redacted CV, the full automated and manual
rights audit, and final desktop/mobile approval. Percy approved the first
public deployment on 2026-08-11, conditional on those checks passing;
off-device backup remains a separate post-release follow-up and is not
evidence supplied by Git status.
Missing portrait, CV, or news is handled by omission—never by placeholders.

Deployment is intentionally manual-only. The GitHub Pages workflow requires a
release-gate acknowledgement, verifies the portrait and CV files, parses CV PDF
metadata and extractable text (or requires an explicit manual CV review), then
uploads the exact `dist/` directory that passed validation. Protect the
`github-pages` environment in repository settings for a second human approval.
