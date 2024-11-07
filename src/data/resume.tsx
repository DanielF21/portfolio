import { Icons } from "@/components/icons";
import { CodeIcon, HomeIcon, NotebookIcon, PencilLine } from "lucide-react";

export const DATA = {
  name: "Daniel Fleming",
  initials: "DF",
  url: "https://danielfleming.xyz",
  location: "Boston, MA",
  locationLink: "https://www.google.com/maps/place/boston",
  description:
    "MIT Grad | SWE | AI Engineer",
  summary:
    "In 2024, I graduated from MIT with a BS in Computer Science and Engineering. I've done data science research for the NBA and developed image processing algorithms for the Digital Humanities Lab. Talk to me about bullet chess and distance running!",
  avatarUrl: "/me.png",
  skills: [
    "React",
    "Next.js",
    "Node.js",
    "Typescript",
    "Tailwind CSS",
    "Python",
    "Flask",
    "Sklearn",
    "NumPy",
    "PyTorch",
    "OpenCV",
    "C++",
    "Assembly",
    "Google Cloud Platform",
    "AWS",
    "Supabase",
    "PostgreSQL",
    "Vector Databases",
  ],
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
    { href: "#", icon: CodeIcon, label: "Projects" },
    { href: "#", icon: PencilLine, label: "Notes" },
  ],
  contact: {
    email: "daniel11ftw@gmail.com",
    tel: "",
    social: {
      GitHub: {
        name: "GitHub",
        url: "https://github.com/DanielF21/",
        icon: Icons.github,

        navbar: true,
      },
      LinkedIn: {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/dannof/",
        icon: Icons.linkedin,

        navbar: true,
      },
      X: {
        name: "X",
        url: "https://x.com/dfleming_ai",
        icon: Icons.x,

        navbar: true,
      },
      email: {
        name: "Send Email",
        url: "#",
        icon: Icons.email,

        navbar: false,
      },
    },
  },

  work: [
  /*
    {
      company: "",
      href: "",
      badges: [],
      location: "",
      title: "",
      logoUrl: "",
      start: "",
      end: "",
      description:
        "",
    },
  */
  ],
  
  education: [
    {
      school: "Massachusetts Institute of Technology",
      href: "https://www.mit.edu/",
      degree: "Bachelor of Science in Computer Science and Engineering",
      logoUrl: "/MIT.png",
      start: "2020",
      end: "2024",
    },
    {
      school: "The Science Academy of South Texas",
      href: "https://scienceacademy.stisd.net/",
      degree: "Diploma",
      logoUrl: "/scitech.png",
      start: "2016",
      end: "2020",
    },
  ],
    projects: [
      {
        title: "Quarterly Report Parser",
        href: "https://pdfportal.vercel.app/",
        dates: "October 2024",
        active: true,
        description:
          "Developed a web application that enables users to upload PDFs of Quarterly Reports, extract financial data, and generate CSV reports, enhancing data accessibility and analysis for financial reporting.",
        technologies: [
          "Supabase",
          "Next.js",
          "OpenAI API",
          "Unstructured Data Parsing"
        ],
        links: [
          {
                type: "Github",
                href: "https://github.com/DanielF21/financial-parsing/",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/pdf.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Mexican Food Chatbot",
        href: "https://rag-recipes.vercel.app/",
        dates: "October 2024",
        active: true,
        description:
          "Built a Retrieval Augmented Generation (RAG) pipeline for personalized Mexican recipe suggestions by scraping over 3,000 webpages.",
        technologies: [
          "Next.js",
          "RAG",
          "Vector Database"
        ],
        links: [
          {
                type: "Github",
                href: "https://github.com/DanielF21/rag-recipes",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/mexican-food.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Health Lens",
        href: "https://www.healthlens.app/",
        dates: "August 2024 - October 2024",
        active: true,
        description:
          "Created a free skin and eye diagnosing service to enhance healthcare access and promote health literacy in underserved communities.",
        technologies: [
          "Node.js",
          "Flask",
          "Supabase",
          "IBM Cloud"
        ],
        links: [
          {
                type: "Website",
                href: "https://www.healthlens.app/",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/healthlens.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Spotify Insights",
        href: "https://spotify-app-six-rosy.vercel.app",
        dates: "October 2024",
        active: true,
        description:
          "This web application connects to Spotify, using Supabase for OAuth and storage, to provide users with insights and visualizations of their listening habits.",
        technologies: [
          "Next.js",
          "Supabase",
          "OAuth",
        ],
        links: [
          {
                type: "Github",
                href: "https://github.com/DanielF21/spotify-insights",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/spotify.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Chess Bot",
        href: "/chess",
        dates: "August 2024 - September 2024",
        active: true,
        description:
          "Trained and fine-tuned a CNN on 1M+ lichess games to create a chess engine that mimics my personal playing style",
        technologies: [
          "Python",
          "NumPy",
          "Tensorflow",
          "Google Cloud Platform",
          "Flask",
        ],
        links: [
          {
            type: "Github",
            href: "https://github.com/DanielF21/chess-bot/",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/chess.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Enhancing Stable Diffusion with ControlNet",
        href: "/SD-ControlNet",
        dates: "April 2024 - May 2024",
        active: true,
        description:
          "Fine-tuned Stable Diffusion by integrating ControlNet to incorporate color information by conditioning the model on colored edge maps alongside text prompts to improve image fidelity.",
        technologies: [
          "Python",
          "OpenCV",
        ],
        links: [
          {
            type: "Website",
            href: "/SD-ControlNet",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/SD.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "AI-Mammogram Analysis",
        href: "https://github.com/DanielF21/cnn-mammogram",
        dates: "March 2024 - April 2024",
        active: true,
        description:
          "Improved breast cancer detection to 93.4% validation accuracy by training a Mask R-CNN model for classifying and segmenting mammogram images.",
        technologies: [
          "Python",
          "PyTorch",
          "OpenCV",
        ],
        links: [
          {
            type: "Github",
            href: "https://github.com/DanielF21/cnn-mammogram",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/mammogram.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Computational Analysis of Hi-C and RNA-seq Datasets",
        href: "https://github.com/DanielF21/Genome-DataScience",
        dates: "March 2024",
        active: true,
        description:
          "Identified interchromosomal interactions in Hi-C data by detecting 442 high-interaction regions (p < 0.01) by developing a greedy search algorithm.",
        technologies: [
          "Python",
          "NumPy",
          "Sklearn",
          "Pandas",
        ],
        links: [
          {
            type: "Github",
            href: "https://github.com/DanielF21/Genome-DataScience",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/chromosome.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Performance-Based NBA Clustering",
        href: "/NBA-clustering",
        dates: "May 2024",
        active: true,
        description:
          "Developed a player clustering model for the NBA using advanced statistical techniques such as multidimensional scaling and k-means clustering, enhancing the understanding of player roles and contributions beyond traditional positional classifications.",
        technologies: [
          "Python",
          "NumPy",
          "Sklearn",
          "Pandas",
        ],
        links: [
          {
            type: "Website",
            href: "/NBA-clustering",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/nba_cluster.png", width: 400, height: 200},
        video:
          "",
      },
      {
        title: "Scheme Interpreter",
        href: "/scheme-interpreter",
        dates: "November 2022 - December 2022",
        active: true,
        description:
          "Developed a Python based Scheme Language Interpreter.",
        technologies: [
          "Next.js",
          "Typescript",
          "Python",
          "TailwindCSS",
          "Shadcn UI",
          "Magic UI",
        ],
        links: [
          {
                type: "Github",
                href: "https://github.com/DanielF21/Scheme-Interpreter",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/scheme.png", width: 400, height: 200},
        video:
          "",
      },
    ],

  hackathons: [
   
  ],
} as const;
