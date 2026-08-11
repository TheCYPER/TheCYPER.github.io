import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://thecyper.github.io",
  output: "static",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-light",
      wrap: true,
    },
  },
  build: {
    format: "directory",
  },
  vite: {
    build: {
      sourcemap: false,
    },
  },
});
