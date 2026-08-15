/**
 * Career, education, and the academic work that sits underneath them.
 *
 * A plain `.ts` file with no JSX. Link icons are chosen at render time from the
 * `kind` discriminant below, which is the only reason the old `resume.tsx` had
 * to be a `.tsx` file at all.
 *
 * On tone: the CV states the numbers. This page does not. Daniel asked
 * specifically that the revenue, ARR, and interaction-count figures stay off
 * the site, since anyone who wants them will read the PDF. What belongs here is
 * what he actually built, in his own framing.
 */

export type LinkKind = "github" | "site" | "paper";

export interface WorkLink {
  readonly kind: LinkKind;
  readonly label: string;
  readonly href: string;
}

export interface Role {
  readonly company: string;
  readonly title: string;
  /** Free text, e.g. "second engineering hire". Rendered next to the title. */
  readonly note?: string;
  readonly start: string;
  readonly end: string;
  /** One or two sentences. No metrics. */
  readonly description: string;
  readonly links?: readonly WorkLink[];
}

export interface School {
  readonly school: string;
  readonly degree: string;
  readonly href: string;
  readonly logoUrl: string;
  readonly start: string;
  readonly end: string;
}

/** Research and technical work. Deliberately a different register from
 *  `things`: this is evidence, not toys. */
export interface Study {
  readonly title: string;
  readonly dates: string;
  readonly description: string;
  readonly links: readonly WorkLink[];
}

export const ROLES: readonly Role[] = [
  {
    company: "Netic AI",
    title: "Founding Engineer",
    note: "second engineering hire",
    start: "November 2024",
    end: "June 2026",
    description:
      "Built the company's AI agent from scratch across voice, text, and email, handling millions of real-world interactions, while also building the underlying infrastructure and evaluation systems.",
  },
];

export const SCHOOLS: readonly School[] = [
  {
    school: "Massachusetts Institute of Technology",
    degree: "Bachelor of Science in Computer Science and Engineering",
    href: "https://www.mit.edu/",
    logoUrl: "/MIT.png",
    start: "2020",
    end: "2024",
  },
];

export const STUDIES: readonly Study[] = [
  {
    title: "Performance-Based NBA Clustering",
    dates: "May 2024",
    description:
      "A player clustering model using multidimensional scaling and k-means, describing player roles beyond traditional positional classifications.",
    links: [
      {
        kind: "paper",
        label: "Paper (PDF)",
        href: "/NBA_clustering.pdf",
      },
    ],
  },
  {
    title: "Enhancing Stable Diffusion with ControlNet",
    dates: "April 2024 - May 2024",
    description:
      "Fine-tuned Stable Diffusion by integrating ControlNet, conditioning the model on colored edge maps alongside text prompts to improve image fidelity.",
    links: [
      {
        kind: "paper",
        label: "Paper (PDF)",
        href: "/Stable_Diffusion_Paper.pdf",
      },
    ],
  },
  {
    title: "AI-Mammogram Analysis",
    dates: "March 2024 - April 2024",
    description:
      "Trained a Mask R-CNN to classify and segment mammogram images for breast cancer detection.",
    links: [
      {
        kind: "github",
        label: "Source",
        href: "https://github.com/DanielF21/cnn-mammogram",
      },
    ],
  },
  {
    title: "Computational Analysis of Hi-C and RNA-seq Datasets",
    dates: "March 2024",
    description:
      "Developed a greedy search algorithm to identify interchromosomal interactions in Hi-C data.",
    links: [
      {
        kind: "github",
        label: "Source",
        href: "https://github.com/DanielF21/Genome-DataScience",
      },
    ],
  },
];

/** Projects deliberately removed from the site rather than migrated: Health
 *  Lens, the RAG recipe chatbot, and the Quarterly Report Parser. Kept here as
 *  a note so nobody "restores" them later thinking they were dropped by
 *  accident. They live on GitHub. */
export const PRUNED = [
  "Health Lens",
  "Mexican Food Chatbot",
  "Quarterly Report Parser",
] as const;
