export const siteConfig = {
  title: "Che (Percy) Liu",
  shortTitle: "Percy Liu",
  description:
    "Che (Percy) Liu is an MBZUAI undergraduate and student researcher working on AI agents, game technology, and developer tools.",
  defaultLanguage: "en",
  siteUrl: "https://thecyper.github.io",
  rssPath: "/rss.xml",
  socialImage: "/og/default.png",
  socialImageAlt: "Che (Percy) Liu — student researcher and builder",
  themeColor: "#2e259c",
} as const;

export const navigation = [
  { href: "/", label: "Home" },
  { href: "/research/", label: "Research" },
  { href: "/work/", label: "Work" },
  { href: "/projects/", label: "Projects" },
  { href: "/writing/", label: "Notes" },
] as const;
