import releaseAssets from "./release-assets.json";

export interface ProfileData {
  name: string;
  shortName: string;
  chineseName: string;
  pronouns: string;
  handle: string;
  identityLine: string;
  affiliation: string;
  locations: readonly string[];
  expectedGraduation: string;
  gpa: string;
  bio: string;
  availability: string;
  education: readonly {
    institution: string;
    program: string;
    period: string;
    detail: string;
  }[];
  interests: readonly string[];
  links: {
    github: string;
    email: string;
    linkedin: string;
  };
  portrait:
    | {
        src: string;
        alt: string;
        width: number;
        height: number;
        srcset?: string;
      }
    | undefined;
  cvUrl: string | undefined;
}

export const profile = {
  name: "Che (Percy) Liu",
  shortName: "Percy Liu",
  chineseName: "刘澈",
  pronouns: "He/Him",
  handle: "TheCYPER",
  identityLine: "Student researcher and builder working on AI agents, game technology, and developer tools.",
  affiliation: "MBZUAI undergraduate",
  locations: ["Abu Dhabi, UAE", "Beijing, China"],
  expectedGraduation: "May 2029",
  gpa: "3.82/4.00",
  bio: "I'm an undergraduate at MBZUAI and a builder across AI agents, games, robotics, and full-stack systems. I like turning uncertain technical ideas into working tools, then documenting what worked, what failed, and what remains unproven.",
  availability: "Open to research collaborations at MBZUAI during Fall 2026 and AI systems internships for Summer 2027; based in Abu Dhabi and Beijing, and open to remote opportunities or roles in Japan and the US.",
  education: [
    {
      institution: "Mohamed bin Zayed University of Artificial Intelligence",
      program: "B.Sc. in Artificial Intelligence",
      period: "Expected May 2029",
      detail: "Undergraduate · GPA 3.82/4.00",
    },
  ],
  interests: ["music and improvisation", "philosophy", "history"],
  links: {
    github: "https://github.com/TheCYPER",
    email: "che.liu@mbzuai.ac.ae",
    linkedin: "https://linkedin.com/in/che-percy-liu",
  },
  portrait: releaseAssets.portrait ?? undefined,
  cvUrl: releaseAssets.cvUrl ?? undefined,
} satisfies ProfileData;
